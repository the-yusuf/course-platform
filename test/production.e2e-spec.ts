import { createTestApp, type TestApp } from './utils/app.js';
import { bearer, newAdmin, unknownId } from './utils/helpers.js';

// The same app with NODE_ENV=production
let t: TestApp;
beforeAll(async () => {
  t = await createTestApp({ NODE_ENV: 'production' });
});
afterAll(() => t.close());

describe('in production', () => {
  it('does not expose Swagger', async () => {
    expect((await t.http.get('/api/docs')).status).toBe(404);
    expect((await t.http.get('/api/docs-json')).status).toBe(404);
  });

  it('sends a Content-Security-Policy (relaxed only for Swagger in dev)', async () => {
    const res = await t.http.get('/api/courses');
    expect(res.headers['content-security-policy']).toMatch(
      /default-src 'self'/,
    );
  });

  it('keeps database error messages generic', async () => {
    const admin = await newAdmin(t);
    const res = await t.http
      .post('/api/lessons')
      .set(bearer(admin.token))
      .send({
        title_uz: 'a',
        title_ru: 'b',
        title_en: 'c',
        course_id: unknownId(),
      });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      statusCode: 404,
      message: 'Referenced record not found',
      error: 'Not Found',
      data: null,
    });
  });
});
