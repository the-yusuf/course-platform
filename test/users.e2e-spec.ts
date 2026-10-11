import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import type { Test } from 'supertest';
import { createTestApp, type TestApp } from './utils/app.js';
import { makeFixtures, type Fixtures } from './utils/fixtures.js';
import {
  bearer,
  data,
  login,
  newAdmin,
  newStudent,
  PASSWORD,
  uid,
  unknownId,
  type Session,
} from './utils/helpers.js';

let t: TestApp;
let admin: Session;
let student: Session;
let img: Fixtures;

beforeAll(async () => {
  t = await createTestApp();
  admin = await newAdmin(t);
  student = await newStudent(t);
  img = await makeFixtures();
});
afterAll(() => t.close());

const asAdmin = (req: Test) => req.set(bearer(admin.token));
const urlPath = (url: string) => new URL(url).pathname;
const onDisk = (url: string) =>
  existsSync(path.join(t.uploadDir, urlPath(url).replace(/^\/uploads\//, '')));

async function createUser(prefix = 'target') {
  const username = uid(prefix);
  const res = await asAdmin(t.http.post('/api/users')).send({
    username,
    email: `${username}@example.com`,
    password: PASSWORD,
  });
  expect(res.status).toBe(201);
  return { ...data(res), username } as { id: string; username: string };
}

describe('access control', () => {
  it('requires a token (401) and the admin role (403) on every route', async () => {
    const id = student.user.id;
    const routes: [string, string][] = [
      ['get', '/api/users'],
      ['get', `/api/users/${id}`],
      ['post', '/api/users'],
      ['patch', `/api/users/${id}/update-info`],
      ['put', `/api/users/${id}/update-password`],
      ['put', `/api/users/${id}/update-photo`],
      ['delete', `/api/users/${id}`],
    ];
    for (const [method, url] of routes) {
      expect(
        (await (t.http as any)[method](url)).status,
        `${method} ${url}`,
      ).toBe(401);
      expect(
        (await (t.http as any)[method](url).set(bearer(student.token))).status,
        `${method} ${url} as student`,
      ).toBe(403);
    }
  });
});

describe('read', () => {
  it('lists users without password hashes', async () => {
    const res = await asAdmin(t.http.get('/api/users'));
    expect(res.status).toBe(200);
    expect(data(res).length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(res.body)).not.toMatch(/password|hash|argon/i);
  });

  it('gets one user, 400 on a bad UUID, 404 when missing', async () => {
    const res = await asAdmin(t.http.get(`/api/users/${student.user.id}`));
    expect(res.status).toBe(200);
    expect(data(res).id).toBe(student.user.id);
    expect((await asAdmin(t.http.get('/api/users/123'))).status).toBe(400);
    expect(
      (await asAdmin(t.http.get(`/api/users/${unknownId()}`))).status,
    ).toBe(404);
  });
});

describe('POST /api/users', () => {
  it('creates a student', async () => {
    const user = await createUser();
    expect(user).toMatchObject({ role: 'student' });
  });

  it('rejects duplicates (409) and invalid input (400)', async () => {
    const existing = await createUser();
    const post = (body: object) =>
      asAdmin(t.http.post('/api/users')).send(body);
    expect(
      (
        await post({
          username: existing.username,
          email: `${uid('e')}@x.co`,
          password: PASSWORD,
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await post({
          username: uid('n'),
          email: `${existing.username}@example.com`,
          password: PASSWORD,
        })
      ).status,
    ).toBe(409);
    expect(
      (await post({ username: 'a', email: 'x', password: '1' })).status,
    ).toBe(400);
    expect(
      (
        await post({
          username: uid('n'),
          email: `${uid('e')}@x.co`,
          password: PASSWORD,
          role: 'admin',
        })
      ).status,
    ).toBe(400);
  });
});

describe('PATCH /api/users/:id/update-info', () => {
  it('updates username and email (lowercased)', async () => {
    const user = await createUser();
    const name = uid('renamed');
    let res = await asAdmin(
      t.http.patch(`/api/users/${user.id}/update-info`),
    ).send({ username: name });
    expect(res.status).toBe(200);
    expect(data(res).username).toBe(name);

    res = await asAdmin(t.http.patch(`/api/users/${user.id}/update-info`)).send(
      { email: `NEW.${name}@EXAMPLE.COM` },
    );
    expect(res.status).toBe(200);
    expect(data(res).email).toBe(`new.${name}@example.com`);

    res = await asAdmin(t.http.patch(`/api/users/${user.id}/update-info`)).send(
      {},
    );
    expect(res.status).toBe(200);
  });

  it('rejects duplicates, bad input, forbidden fields and unknown users', async () => {
    const user = await createUser();
    const patch = (id: string, body: object) =>
      asAdmin(t.http.patch(`/api/users/${id}/update-info`)).send(body);
    expect(
      (await patch(user.id, { email: `${student.username}@example.com` }))
        .status,
    ).toBe(409);
    expect((await patch(user.id, { username: student.username })).status).toBe(
      409,
    );
    expect((await patch(user.id, { username: 'ab' })).status).toBe(400);
    expect((await patch(user.id, { password: 'hacked123' })).status).toBe(400);
    expect((await patch(user.id, { role: 'admin' })).status).toBe(400);
    expect((await patch(unknownId(), { username: uid('z') })).status).toBe(404);
  });
});

describe('PUT /api/users/:id/update-password (admin reset)', () => {
  it('resets the password without the current one and ends the user’s session', async () => {
    const user = await createUser();
    const session = await login(t, user.username);
    const put = (id: string, body: object) =>
      asAdmin(t.http.put(`/api/users/${id}/update-password`)).send(body);

    // the admin doesn't know (or send) the user's current password
    expect(
      (
        await put(user.id, {
          current_password: PASSWORD,
          new_password: 'newpass123',
        })
      ).status,
    ).toBe(400);
    expect((await put(user.id, { new_password: '1234567' })).status).toBe(400);
    expect((await put(user.id, {})).status).toBe(400);
    expect(
      (await put(unknownId(), { new_password: 'newpass123' })).status,
    ).toBe(404);

    const res = await put(user.id, { new_password: 'newpass123' });
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toMatch(/password|hash/i);

    expect(
      (await t.http.get('/api/auth/me').set(bearer(session.token))).status,
    ).toBe(401);
    expect(
      (
        await t.http
          .post('/api/auth/login')
          .send({ username: user.username, password: PASSWORD })
      ).status,
    ).toBe(401);
    expect(
      (
        await t.http
          .post('/api/auth/login')
          .send({ username: user.username, password: 'newpass123' })
      ).status,
    ).toBe(200);
  });
});

describe('PUT /api/users/:id/update-photo', () => {
  let user: { id: string };
  const photo = (id: string) =>
    asAdmin(t.http.put(`/api/users/${id}/update-photo`));
  beforeAll(async () => {
    user = await createUser('photo');
  });

  it('stores the image as WebP, replaces the old file and serves it safely', async () => {
    const first = await photo(user.id).attach('avatar', img.png, {
      filename: 'a.png',
      contentType: 'image/png',
    });
    expect(first.status).toBe(200);
    const firstUrl: string = data(first).avatar;
    expect(firstUrl).toMatch(
      /^http:\/\/e2e\.test\/uploads\/users\/[0-9a-f-]+\.webp$/,
    );

    const served = await t.http.get(urlPath(firstUrl));
    expect(served.status).toBe(200);
    expect(served.headers['content-type']).toBe('image/webp');
    expect(served.headers['x-content-type-options']).toBe('nosniff');
    expect(served.body.subarray(8, 12).toString()).toBe('WEBP');

    const second = await photo(user.id).attach('avatar', img.jpg, {
      filename: 'a.jpg',
      contentType: 'image/jpeg',
    });
    expect(second.status).toBe(200);
    expect(data(second).avatar).not.toBe(firstUrl);
    expect((await t.http.get(urlPath(firstUrl))).status).toBe(404);

    const third = await photo(user.id).attach('avatar', img.webp, {
      filename: 'a.webp',
      contentType: 'image/webp',
    });
    expect(third.status).toBe(200);
  });

  it.each([
    ['no file', (r: any) => r, 400],
    [
      'a text file named .png',
      (r: any) => r.attach('avatar', img.fake, 'fake.png'),
      400,
    ],
    [
      'a corrupted PNG',
      (r: any) => r.attach('avatar', img.corrupt, 'c.png'),
      400,
    ],
    ['a GIF', (r: any) => r.attach('avatar', img.gif, 'a.gif'), 400],
    ['an SVG', (r: any) => r.attach('avatar', img.svg, 'x.svg'), 400],
    ['a 6 MB file', (r: any) => r.attach('avatar', img.big, 'big.png'), 413],
    [
      'the wrong field name',
      (r: any) => r.attach('photo', img.png, 'a.png'),
      400,
    ],
    [
      'an extra text field',
      (r: any) => r.field('username', 'hax').attach('avatar', img.png, 'a.png'),
      400,
    ],
    [
      'two files',
      (r: any) =>
        r.attach('avatar', img.png, 'a.png').attach('avatar', img.png, 'b.png'),
      400,
    ],
    ['JSON instead of multipart', (r: any) => r.send({ avatar: 'x' }), 400],
  ])('rejects %s', async (_, build, status) => {
    expect((await build(photo(user.id))).status).toBe(status);
  });

  it('404s for an unknown user and leaves no orphan files behind', async () => {
    const res = await photo(unknownId()).attach('avatar', img.png, 'a.png');
    expect(res.status).toBe(404);
    // only the current avatar of `user` remains
    expect(await readdir(path.join(t.uploadDir, 'users'))).toHaveLength(1);
  });
});

describe('DELETE /api/users/:id', () => {
  it('deletes the user, their session and their avatar', async () => {
    const user = await createUser('gone');
    const session = await login(t, user.username);
    const avatar = data(
      await asAdmin(t.http.put(`/api/users/${user.id}/update-photo`)).attach(
        'avatar',
        img.png,
        'a.png',
      ),
    ).avatar;
    expect(onDisk(avatar)).toBe(true);

    const res = await asAdmin(t.http.delete(`/api/users/${user.id}`));
    expect(res.status).toBe(204);
    expect((await asAdmin(t.http.delete(`/api/users/${user.id}`))).status).toBe(
      404,
    );
    expect(
      (await t.http.get('/api/auth/me').set(bearer(session.token))).status,
    ).toBe(401);
    expect(onDisk(avatar)).toBe(false);
    expect((await asAdmin(t.http.delete('/api/users/abc'))).status).toBe(400);
  });
});
