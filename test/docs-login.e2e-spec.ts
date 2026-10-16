import { createTestApp, type TestApp } from './utils/app.js';

// Production with Swagger turned on: the docs sit behind a browser login
const USERNAME = 'docs';
const PASSWORD = 'e2e-docs-password';
const DOCS_URLS = [
  '/api/docs',
  '/api/docs-json',
  '/api/docs-yaml',
  '/api/docs/swagger-ui.css',
];

let t: TestApp;
beforeAll(async () => {
  t = await createTestApp({
    NODE_ENV: 'production',
    SWAGGER_ENABLED: 'true',
    SWAGGER_USERNAME: USERNAME,
    SWAGGER_PASSWORD: PASSWORD,
  });
});
afterAll(() => t.close());

describe('Swagger behind a login', () => {
  it('asks for the login on every docs URL', async () => {
    for (const url of DOCS_URLS) {
      const res = await t.http.get(url);
      expect(res.status, url).toBe(401);
      expect(res.headers['www-authenticate'], url).toMatch(/^Basic /);
    }
    const res = await t.http.get('/api/docs-json');
    expect(res.body).toEqual({
      statusCode: 401,
      message: 'Log in to see the API docs',
      error: 'Unauthorized',
      data: null,
    });
  });

  it('rejects a wrong login', async () => {
    const wrongPassword = await t.http
      .get('/api/docs')
      .auth(USERNAME, 'not-the-password');
    expect(wrongPassword.status).toBe(401);
    const wrongUser = await t.http.get('/api/docs').auth('admin', PASSWORD);
    expect(wrongUser.status).toBe(401);
  });

  it('serves the docs with the right login', async () => {
    for (const url of DOCS_URLS) {
      const res = await t.http.get(url).auth(USERNAME, PASSWORD);
      expect(res.status, url).toBe(200);
    }
    const ui = await t.http.get('/api/docs').auth(USERNAME, PASSWORD);
    expect(ui.text).toMatch(/swagger/i);
    // Swagger UI works under the same CSP as the API
    expect(ui.headers['content-security-policy']).toMatch(/default-src 'self'/);

    const spec = await t.http.get('/api/docs-json').auth(USERNAME, PASSWORD);
    const operations = Object.values(
      spec.body.paths as Record<string, object>,
    ).flatMap((p) => Object.keys(p));
    expect(operations.length).toBeGreaterThanOrEqual(52);
  });

  it('leaves the API itself alone', async () => {
    const res = await t.http.get('/api/courses');
    expect(res.status).toBe(200);
    expect(res.headers['content-security-policy']).toMatch(
      /default-src 'self'/,
    );

    // browsers resend the docs login to other /api URLs
    const withLogin = await t.http
      .get('/api/courses')
      .auth(USERNAME, PASSWORD);
    expect(withLogin.status).toBe(200);
  });
});
