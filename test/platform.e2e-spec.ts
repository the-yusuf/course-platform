import { writeFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { createTestApp, type TestApp } from './utils/app.js';
import { bearer, newAdmin, newStudent, type Session } from './utils/helpers.js';

let t: TestApp;
let admin: Session;
beforeAll(async () => {
  t = await createTestApp();
  admin = await newAdmin(t);
});
afterAll(() => t.close());

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('response envelope', () => {
  it('wraps a single resource', async () => {
    const res = await t.http.get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      statusCode: 200,
      message: 'Success',
      data: { status: 'ok', database: 'up' },
    });
  });

  it('reports the real status code (201 on create)', async () => {
    const res = await t.http
      .post('/api/courses')
      .set(bearer(admin.token))
      .send({ title: 'Envelope', description: 'd', price_uzs: 1 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      statusCode: 201,
      message: 'Success',
      data: { title: 'Envelope' },
    });
  });

  it('wraps lists with pagination meta', async () => {
    const res = await t.http.get('/api/courses');
    expect(res.body).toMatchObject({
      statusCode: 200,
      message: 'Success',
      data: expect.any(Array),
      meta: {
        page: 1,
        limit: 20,
        total: expect.any(Number),
        totalPages: expect.any(Number),
      },
    });
  });

  it('leaves 204 responses empty', async () => {
    const s = await newStudent(t);
    const res = await t.http
      .post('/api/auth/logout')
      .send({ refresh_token: s.refresh });
    expect(res.status).toBe(204);
    expect(res.text).toBe('');
  });

  it.each([
    [
      'a validation error (message is a list)',
      () => t.http.post('/api/auth/register').send({}),
      400,
      'Bad Request',
    ],
    ['a missing token', () => t.http.get('/api/auth/me'), 401, 'Unauthorized'],
    [
      'a forbidden role',
      async () =>
        t.http.get('/api/users').set(bearer((await newStudent(t)).token)),
      403,
      'Forbidden',
    ],
    ['an unknown route', () => t.http.get('/api/nope'), 404, 'Not Found'],
    [
      'a malformed JSON body',
      () =>
        t.http
          .post('/api/auth/login')
          .set('Content-Type', 'application/json')
          .send('{"x":'),
      400,
      'Bad Request',
    ],
    [
      'an oversized body',
      () =>
        t.http
          .post('/api/auth/login')
          .send({ username: 'x'.repeat(200_000), password: 'y' }),
      413,
      'Payload Too Large',
    ],
  ])(
    'wraps %s as { statusCode, message, error, data: null }',
    async (_, send, status, error) => {
      const res = await send();
      expect(res.status).toBe(status);
      expect(res.body).toEqual({
        statusCode: status,
        message: expect.anything(),
        error,
        data: null,
      });
    },
  );

  it('keeps validation messages as a list', async () => {
    const res = await t.http.post('/api/auth/register').send({});
    expect(Array.isArray(res.body.message)).toBe(true);
    expect(res.body.message.length).toBeGreaterThan(1);
  });
});

describe('pagination', () => {
  beforeAll(async () => {
    for (const title of ['P1', 'P2', 'P3']) {
      await t.http
        .post('/api/courses')
        .set(bearer(admin.token))
        .send({ title, description: 'd', price_uzs: 1 });
    }
  });

  it('pages through results', async () => {
    const all = await t.http.get('/api/courses?limit=100');
    const total = all.body.meta.total;
    expect(total).toBeGreaterThanOrEqual(3);

    const page2 = await t.http.get('/api/courses?page=2&limit=1');
    expect(page2.body.data).toHaveLength(1);
    expect(page2.body.data[0].id).toBe(all.body.data[1].id);
    expect(page2.body.meta).toEqual({
      total,
      page: 2,
      limit: 1,
      totalPages: total,
    });

    const beyond = await t.http.get(`/api/courses?page=${total + 1}&limit=1`);
    expect(beyond.body.data).toEqual([]);
    expect(beyond.body.meta.total).toBe(total);
  });

  it.each([
    ['page=0', 400],
    ['limit=0', 400],
    ['limit=101', 400],
    ['limit=abc', 400],
    ['sort=title', 400],
  ])('rejects ?%s', async (query, status) => {
    expect((await t.http.get(`/api/courses?${query}`)).status).toBe(status);
  });
});

describe('health & request ids', () => {
  it('is public and reports the database', async () => {
    const res = await t.http.get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ status: 'ok', database: 'up' });
  });

  it('gives every response an X-Request-Id, keeping a safe incoming one', async () => {
    const generated = await t.http.get('/api/health');
    expect(generated.headers['x-request-id']).toMatch(UUID);

    const passed = await t.http
      .get('/api/health')
      .set('X-Request-Id', 'from-nginx-123');
    expect(passed.headers['x-request-id']).toBe('from-nginx-123');

    const unsafe = await t.http
      .get('/api/health')
      .set('X-Request-Id', 'not safe: spaces & "quotes"');
    expect(unsafe.headers['x-request-id']).toMatch(UUID);
  });
});

/** GET with the path sent byte-for-byte (supertest/fetch would normalise "..") */
function rawGet(urlPath: string) {
  const { hostname, port } = new URL(t.baseUrl);
  return new Promise<{ status: number; text: string }>((resolve, reject) => {
    http
      .get({ host: hostname, port, path: urlPath }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () =>
          resolve({
            status: res.statusCode!,
            text: Buffer.concat(chunks).toString(),
          }),
        );
      })
      .on('error', reject);
  });
}

describe('docs', () => {
  it('serves Swagger UI and an OpenAPI document with every route', async () => {
    const ui = await t.http.get('/api/docs');
    expect(ui.status).toBe(200);
    expect(ui.text).toMatch(/swagger/i);

    const spec = await t.http.get('/api/docs-json');
    expect(spec.status).toBe(200);
    const operations = Object.values(
      spec.body.paths as Record<string, object>,
    ).flatMap((p) => Object.keys(p));
    expect(operations.length).toBeGreaterThanOrEqual(52);
  });
});

describe('security headers & CORS', () => {
  it('sends helmet headers, on static files too', async () => {
    const res = await t.http.get('/api/courses');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['strict-transport-security']).toMatch(/max-age=/);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    // the frontend lives on another origin and must be able to load images
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');

    const file = await t.http.get('/uploads/users/missing.webp');
    expect(file.headers['strict-transport-security']).toMatch(/max-age=/);
  });

  it('allows only the configured frontend origins', async () => {
    const allowed = await t.http
      .get('/api/courses')
      .set('Origin', 'http://localhost:5173');
    expect(allowed.headers['access-control-allow-origin']).toBe(
      'http://localhost:5173',
    );

    const other = await t.http
      .get('/api/courses')
      .set('Origin', 'https://evil.example');
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('errors', () => {
  it('404s on unknown routes', async () => {
    expect((await t.http.get('/api/does-not-exist')).status).toBe(404);
  });

  it('400s on malformed JSON and 413s on oversized bodies', async () => {
    const malformed = await t.http
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"username":');
    expect(malformed.status).toBe(400);

    const huge = await t.http
      .post('/api/auth/login')
      .send({ username: 'x'.repeat(200_000), password: 'y' });
    expect(huge.status).toBe(413);
  });
});

describe('static /uploads', () => {
  beforeAll(async () => {
    // a file next to the upload dir that must never be reachable
    await writeFile(
      path.join(path.dirname(t.uploadDir), 'sentinel.txt'),
      'TOP-SECRET',
    );
    await writeFile(path.join(t.uploadDir, '.secret'), 'dotfile');
  });

  it('does not list directories or serve dotfiles', async () => {
    expect((await rawGet('/uploads/')).status).not.toBe(200);
    const dot = await rawGet('/uploads/.secret');
    expect(dot.status).not.toBe(200);
    expect(dot.text).not.toContain('dotfile');
  });

  it.each([
    '/uploads/../sentinel.txt',
    '/uploads/%2e%2e/sentinel.txt',
    '/uploads/..%2fsentinel.txt',
    '/uploads/users/..%2f..%2fsentinel.txt',
  ])('blocks path traversal: %s', async (urlPath) => {
    const res = await rawGet(urlPath);
    expect(res.status).not.toBe(200);
    expect(res.text).not.toContain('TOP-SECRET');
  });

  it('404s on a missing file', async () => {
    expect(
      (await rawGet('/uploads/users/00000000-0000-0000-0000-000000000000.webp'))
        .status,
    ).toBe(404);
  });
});
