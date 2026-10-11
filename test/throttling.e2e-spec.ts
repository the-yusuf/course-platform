import { createTestApp, type TestApp } from './utils/app.js';
import { PASSWORD, register, uid } from './utils/helpers.js';

// Its own app (and so its own in-memory rate-limit counters) with low limits
let t: TestApp;
beforeAll(async () => {
  t = await createTestApp({
    THROTTLE_LIMIT: '1000',
    THROTTLE_AUTH_LIMIT: '10',
    THROTTLE_LOGIN_USERNAME_LIMIT: '3',
  });
});
afterAll(() => t.close());

const login = (username: string, password = 'wrong-password') =>
  t.http.post('/api/auth/login').send({ username, password });

describe('rate limiting', () => {
  it('blocks a username after repeated attempts, even with the right password', async () => {
    const { username } = await register(t, 'victim');
    for (let i = 0; i < 3; i++)
      expect((await login(username)).status).toBe(401);

    const blocked = await login(username, PASSWORD);
    expect(blocked.status).toBe(429);
    // @nestjs/throttler suffixes headers with the throttler's name
    expect(
      Number(blocked.headers['retry-after-login-username']),
    ).toBeGreaterThan(0);
    expect(blocked.body.message).toMatch(/too many requests/i);
  });

  it('counts unknown usernames the same way, so limits reveal nothing', async () => {
    const ghost = uid('ghost');
    for (let i = 0; i < 3; i++) expect((await login(ghost)).status).toBe(401);
    expect((await login(ghost)).status).toBe(429);
  });

  it('limits each IP on auth endpoints, across usernames', async () => {
    // a different username every time (password spraying): the per-username
    // limit never triggers, the per-IP limit of 10 does
    const results: number[] = [];
    for (let i = 0; i < 12; i++)
      results.push((await login(uid('spray'))).status);
    expect(results).toContain(429);
    expect(results.at(-1)).toBe(429);
  });

  it('does not limit ordinary endpoints at the auth rate', async () => {
    for (let i = 0; i < 10; i++) {
      expect((await t.http.get('/api/courses')).status).toBe(200);
    }
  });
});
