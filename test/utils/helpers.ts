import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import type { Response } from 'supertest';
import type { TestApp } from './app.js';

/** The payload of a response: `data` from the envelope, or the raw body */
export function data<T = any>(res: Response): T {
  const body = res.body;
  const enveloped =
    body &&
    typeof body === 'object' &&
    !Array.isArray(body) &&
    'statusCode' in body &&
    'data' in body;
  return enveloped ? body.data : body;
}

/** The error message(s) of a response, joined */
export const message = (res: Response) => [res.body?.message].flat().join('; ');

export const uid = (prefix: string) =>
  `${prefix}_${randomBytes(4).toString('hex')}`;

export const unknownId = () => randomUUID();

export const PASSWORD = 'secret123';

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export interface Session {
  user: { id: string; username: string; role: string; [key: string]: any };
  username: string;
  password: string;
  token: string;
  refresh: string;
}

export async function register(
  t: TestApp,
  prefix = 'user',
  password = PASSWORD,
) {
  const username = uid(prefix);
  const res = await t.http
    .post('/api/auth/register')
    .send({ username, email: `${username}@example.com`, password });
  if (res.status !== 201) {
    throw new Error(
      `register failed: ${res.status} ${JSON.stringify(res.body)}`,
    );
  }
  return { user: data(res), username, password };
}

export async function login(
  t: TestApp,
  username: string,
  password = PASSWORD,
): Promise<Session> {
  const res = await t.http.post('/api/auth/login').send({ username, password });
  if (res.status !== 200) {
    throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  const body = data(res);
  return {
    user: body.user,
    username,
    password,
    token: body.access_token,
    refresh: body.refresh_token,
  };
}

export async function newStudent(t: TestApp, prefix = 'stu') {
  const { username, password } = await register(t, prefix);
  return login(t, username, password);
}

/** There is no API for creating admins (by design), so promote in the DB */
export async function newAdmin(t: TestApp) {
  const { user, username, password } = await register(t, 'admin');
  await t.db
    .updateTable('users')
    .set({ role: 'admin' })
    .where('id', '=', user.id)
    .execute();
  return login(t, username, password);
}

const b64url = (value: object) =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

/** Signs an access token with the app's real secret (for expiry tests) */
export function signJwt(payload: object) {
  const header = b64url({ alg: 'HS256', typ: 'JWT' });
  const body = b64url(payload);
  const signature = createHmac('sha256', process.env.ACCESS_TOKEN_SECRET!)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

export const unsignedJwt = (payload: object) =>
  `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url(payload)}.`;

export const decodeJwt = (token: string) =>
  JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()) as {
    sub: string;
    sid: string;
    iat: number;
    exp: number;
  };
