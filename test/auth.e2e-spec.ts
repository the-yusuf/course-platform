import { randomUUID } from 'node:crypto';
import { createTestApp, type TestApp } from './utils/app.js';
import {
  bearer,
  data,
  decodeJwt,
  login,
  message,
  newStudent,
  PASSWORD,
  register,
  signJwt,
  uid,
  unsignedJwt,
} from './utils/helpers.js';

let t: TestApp;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.close());

describe('POST /api/auth/register', () => {
  it('creates a student, lowercases the email and never returns the password', async () => {
    const username = uid('reg');
    const res = await t.http.post('/api/auth/register').send({
      username,
      email: `${username.toUpperCase()}@Example.COM`,
      password: PASSWORD,
    });

    expect(res.status).toBe(201);
    const user = data(res);
    expect(user).toMatchObject({
      username,
      email: `${username}@example.com`,
      role: 'student',
    });
    expect(JSON.stringify(user)).not.toMatch(/password|hash/i);
  });

  it.each([
    ['missing fields', {}],
    [
      'username under 3 chars',
      { username: 'ab', email: 'a@b.co', password: PASSWORD },
    ],
    [
      'invalid email',
      { username: uid('x'), email: 'not-an-email', password: PASSWORD },
    ],
    [
      'short password',
      { username: uid('x'), email: 'x@b.co', password: '12345' },
    ],
    [
      'non-string password',
      { username: uid('x'), email: 'x@b.co', password: 12345678 },
    ],
    [
      'role field (privilege escalation)',
      {
        username: uid('x'),
        email: 'x@b.co',
        password: PASSWORD,
        role: 'admin',
      },
    ],
    [
      'username that is 2 chars once trimmed',
      { username: '  ab  ', email: 'x@b.co', password: PASSWORD },
    ],
    [
      'whitespace-only username',
      { username: '   ', email: 'x@b.co', password: PASSWORD },
    ],
    [
      'a username with a space',
      { username: 'john doe', email: 'x@b.co', password: PASSWORD },
    ],
    [
      'a username with "@"',
      { username: 'john@doe', email: 'x@b.co', password: PASSWORD },
    ],
    [
      'a username over 32 chars',
      { username: 'a'.repeat(33), email: 'x@b.co', password: PASSWORD },
    ],
    [
      'a 7 character password',
      { username: uid('x'), email: 'x@b.co', password: '1234567' },
    ],
    [
      'a 129 character password',
      { username: uid('x'), email: 'x@b.co', password: 'p'.repeat(129) },
    ],
  ])('rejects %s with 400', async (_, body) => {
    const res = await t.http.post('/api/auth/register').send(body);
    expect(res.status).toBe(400);
  });

  it('normalises usernames to lowercase, so case variants are one account', async () => {
    const name = uid('Case').toUpperCase();
    const res = await t.http.post('/api/auth/register').send({
      username: `  ${name} `,
      email: `${uid('c')}@x.co`,
      password: PASSWORD,
    });
    expect(res.status).toBe(201);
    expect(data(res).username).toBe(name.toLowerCase());

    const variant = await t.http.post('/api/auth/register').send({
      username: name.toLowerCase(),
      email: `${uid('c')}@x.co`,
      password: PASSWORD,
    });
    expect(variant.status).toBe(409);

    // and login is case-insensitive too
    const loginRes = await t.http
      .post('/api/auth/login')
      .send({ username: name, password: PASSWORD });
    expect(loginRes.status).toBe(200);
  });

  it('rejects a duplicate username or email (any case) with 409', async () => {
    const { username } = await register(t, 'dup');
    const sameName = await t.http
      .post('/api/auth/register')
      .send({ username, email: `${uid('o')}@example.com`, password: PASSWORD });
    expect(sameName.status).toBe(409);

    const sameEmail = await t.http.post('/api/auth/register').send({
      username: uid('o'),
      email: `${username}@EXAMPLE.com`,
      password: PASSWORD,
    });
    expect(sameEmail.status).toBe(409);
  });
});

describe('POST /api/auth/login', () => {
  let username: string;
  beforeAll(async () => {
    ({ username } = await register(t, 'login'));
  });

  it('returns the user and a token pair', async () => {
    const res = await t.http
      .post('/api/auth/login')
      .send({ username, password: PASSWORD });
    expect(res.status).toBe(200);
    const body = data(res);
    expect(body.access_token).toEqual(expect.any(String));
    expect(body.refresh_token).toEqual(expect.any(String));
    expect(body.user.username).toBe(username);
    expect(JSON.stringify(body.user)).not.toMatch(/password|hash/i);
  });

  it('issues 1 hour access tokens', async () => {
    const { token } = await login(t, username);
    const claims = decodeJwt(token);
    expect(claims.exp - claims.iat).toBe(3600);
  });

  it('gives the same 401 for a wrong password and an unknown username', async () => {
    const wrong = await t.http
      .post('/api/auth/login')
      .send({ username, password: 'wrongpass' });
    const unknown = await t.http
      .post('/api/auth/login')
      .send({ username: uid('ghost'), password: PASSWORD });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(message(unknown)).toBe(message(wrong));
  });

  it('does not accept the email as username', async () => {
    const res = await t.http
      .post('/api/auth/login')
      .send({ username: `${username}@example.com`, password: PASSWORD });
    expect(res.status).toBe(401);
  });

  it.each([
    ['an empty body', {}],
    [
      'an unknown field',
      { username: 'abc', password: PASSWORD, remember: true },
    ],
  ])('rejects %s with 400', async (_, body) => {
    expect((await t.http.post('/api/auth/login').send(body)).status).toBe(400);
  });

  it('keeps one session per user: a new login ends the previous one', async () => {
    const first = await login(t, username);
    const second = await login(t, username);
    expect(
      (await t.http.get('/api/auth/me').set(bearer(first.token))).status,
    ).toBe(401);
    expect(
      (await t.http.get('/api/auth/me').set(bearer(second.token))).status,
    ).toBe(200);
  });
});

describe('GET /api/auth/me', () => {
  it('returns the current user', async () => {
    const s = await newStudent(t);
    const res = await t.http.get('/api/auth/me').set(bearer(s.token));
    expect(res.status).toBe(200);
    expect(data(res).id).toBe(s.user.id);
    expect(JSON.stringify(data(res))).not.toMatch(/password|hash/i);
  });

  it('rejects missing, malformed, tampered, unsigned, expired and orphaned tokens', async () => {
    const s = await newStudent(t);
    const { sub, sid } = decodeJwt(s.token);
    const now = Math.floor(Date.now() / 1000);
    const tampered =
      s.token.slice(0, -3) + (s.token.endsWith('AAA') ? 'BBB' : 'AAA');

    const cases: Record<string, string | undefined> = {
      missing: undefined,
      'not Bearer': `Token ${s.token}`,
      tampered: `Bearer ${tampered}`,
      'alg none': `Bearer ${unsignedJwt({ sub, sid })}`,
      expired: `Bearer ${signJwt({ sub, sid, iat: now - 7200, exp: now - 3600 })}`,
      'unknown session': `Bearer ${signJwt({ sub, sid: randomUUID(), iat: now, exp: now + 600 })}`,
    };
    for (const [name, header] of Object.entries(cases)) {
      const req = t.http.get('/api/auth/me');
      const res = await (header ? req.set('Authorization', header) : req);
      expect(res.status, name).toBe(401);
    }
  });
});

describe('POST /api/auth/refresh', () => {
  it('rotates the token pair and works without an access token', async () => {
    const s = await newStudent(t);
    const res = await t.http
      .post('/api/auth/refresh')
      .send({ refresh_token: s.refresh });
    expect(res.status).toBe(200);
    const pair = data(res);
    expect(pair.refresh_token).not.toBe(s.refresh);
    expect(
      (await t.http.get('/api/auth/me').set(bearer(pair.access_token))).status,
    ).toBe(200);
  });

  it.each([
    ['an empty body', {}, 400],
    ['a garbage token', { refresh_token: 'garbage' }, 401],
    ['a non-UUID session id', { refresh_token: 'abc.def' }, 401],
  ])('rejects %s', async (_, body, status) => {
    expect((await t.http.post('/api/auth/refresh').send(body)).status).toBe(
      status,
    );
  });

  it('ends the session when an old refresh token is reused', async () => {
    const s = await newStudent(t);
    const first = data(
      await t.http.post('/api/auth/refresh').send({ refresh_token: s.refresh }),
    );
    const second = data(
      await t.http
        .post('/api/auth/refresh')
        .send({ refresh_token: first.refresh_token }),
    );

    // two rotations old: outside the grace window, so it's treated as stolen
    const reuse = await t.http
      .post('/api/auth/refresh')
      .send({ refresh_token: s.refresh });
    expect(reuse.status).toBe(401);
    expect(message(reuse)).toMatch(/session ended/i);
    // the whole session is gone, including the newest tokens
    expect(
      (await t.http.get('/api/auth/me').set(bearer(second.access_token)))
        .status,
    ).toBe(401);
    expect(
      (
        await t.http
          .post('/api/auth/refresh')
          .send({ refresh_token: second.refresh_token })
      ).status,
    ).toBe(401);
  });

  it('lets two tabs refresh with the same token at the same time', async () => {
    const s = await newStudent(t);
    const [a, b] = await Promise.all([
      t.http.post('/api/auth/refresh').send({ refresh_token: s.refresh }),
      t.http.post('/api/auth/refresh').send({ refresh_token: s.refresh }),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    // the session survives, and the latest token works
    const latest = [data(a), data(b)];
    const results = await Promise.all(
      latest.map((pair) =>
        t.http.get('/api/auth/me').set(bearer(pair.access_token)),
      ),
    );
    expect(results.map((r) => r.status)).toEqual([200, 200]);
  });

  it('accepts the previous token only within the 10 second grace window', async () => {
    const s = await newStudent(t);
    await t.http.post('/api/auth/refresh').send({ refresh_token: s.refresh });

    // move the rotation 11 s into the past
    await t.db
      .updateTable('sessions')
      .set({ rotated_at: new Date(Date.now() - 11_000) })
      .where('user_id', '=', s.user.id)
      .execute();

    const late = await t.http
      .post('/api/auth/refresh')
      .send({ refresh_token: s.refresh });
    expect(late.status).toBe(401);
    expect(message(late)).toMatch(/session ended/i);
  });

  it('treats a wrong secret for a real session as theft', async () => {
    const s = await newStudent(t);
    const sessionId = s.refresh.split('.')[0];
    const res = await t.http
      .post('/api/auth/refresh')
      .send({ refresh_token: `${sessionId}.AAAAAAAA` });
    expect(res.status).toBe(401);
    expect((await t.http.get('/api/auth/me').set(bearer(s.token))).status).toBe(
      401,
    );
  });
});

describe('POST /api/auth/logout', () => {
  it('ends the session using only the refresh token', async () => {
    const s = await newStudent(t);
    const res = await t.http
      .post('/api/auth/logout')
      .send({ refresh_token: s.refresh });
    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect((await t.http.get('/api/auth/me').set(bearer(s.token))).status).toBe(
      401,
    );
    expect(
      (
        await t.http
          .post('/api/auth/refresh')
          .send({ refresh_token: s.refresh })
      ).status,
    ).toBe(401);
  });

  it.each([
    ['a missing token', {}, 400],
    ['a garbage token', { refresh_token: 'garbage' }, 401],
    ['an unknown session', { refresh_token: `${randomUUID()}.secret` }, 401],
  ])('rejects %s', async (_, body, status) => {
    expect((await t.http.post('/api/auth/logout').send(body)).status).toBe(
      status,
    );
  });

  it('rejects a wrong secret without ending the session', async () => {
    const s = await newStudent(t);
    const sessionId = s.refresh.split('.')[0];
    const res = await t.http
      .post('/api/auth/logout')
      .send({ refresh_token: `${sessionId}.wrong` });
    expect(res.status).toBe(401);
    expect((await t.http.get('/api/auth/me').set(bearer(s.token))).status).toBe(
      200,
    );
  });
});

describe('self-service account (/api/auth/me)', () => {
  it('PATCH updates the own username and email', async () => {
    const s = await newStudent(t);
    const name = uid('me');
    const res = await t.http
      .patch('/api/auth/me')
      .set(bearer(s.token))
      .send({ username: name, email: `${name}@Example.com` });
    expect(res.status).toBe(200);
    expect(data(res)).toMatchObject({
      id: s.user.id,
      username: name,
      email: `${name}@example.com`,
    });

    const other = await newStudent(t);
    const taken = await t.http
      .patch('/api/auth/me')
      .set(bearer(s.token))
      .send({ username: other.username });
    expect(taken.status).toBe(409);

    const role = await t.http
      .patch('/api/auth/me')
      .set(bearer(s.token))
      .send({ role: 'admin' });
    expect(role.status).toBe(400);
    expect((await t.http.patch('/api/auth/me').send({})).status).toBe(401);
  });

  it('PUT /password checks the current password and returns a fresh session', async () => {
    const s = await newStudent(t);
    const put = (body: object) =>
      t.http.put('/api/auth/me/password').set(bearer(s.token)).send(body);

    const wrong = await put({
      current_password: 'wrong-pass',
      new_password: 'newpass123',
    });
    expect(wrong.status).toBe(400);
    expect(message(wrong)).toMatch(/current password/i);
    expect(
      (await put({ current_password: PASSWORD, new_password: 'short' })).status,
    ).toBe(400);

    const res = await put({
      current_password: PASSWORD,
      new_password: 'newpass123',
    });
    expect(res.status).toBe(200);
    const body = data(res);
    expect(body.user.id).toBe(s.user.id);

    // the old session is gone, the returned one works
    expect((await t.http.get('/api/auth/me').set(bearer(s.token))).status).toBe(
      401,
    );
    expect(
      (await t.http.get('/api/auth/me').set(bearer(body.access_token))).status,
    ).toBe(200);
    expect(
      (
        await t.http
          .post('/api/auth/login')
          .send({ username: s.username, password: PASSWORD })
      ).status,
    ).toBe(401);
    await login(t, s.username, 'newpass123');
  });

  it('PUT /avatar uploads the own avatar', async () => {
    const s = await newStudent(t);
    const png = await (await import('./utils/fixtures.js')).makeFixtures();
    const res = await t.http
      .put('/api/auth/me/avatar')
      .set(bearer(s.token))
      .attach('avatar', png.png, 'a.png');
    expect(res.status).toBe(200);
    expect(data(res).avatar).toMatch(/^http:\/\/e2e\.test\/uploads\/users\//);
    expect(
      (
        await t.http
          .put('/api/auth/me/avatar')
          .attach('avatar', png.png, 'a.png')
      ).status,
    ).toBe(401);
  });
});
