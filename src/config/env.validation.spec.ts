import 'reflect-metadata'; // class-transformer needs it; Nest loads it in the app
import { validateEnv } from './env.validation.js';

const base = {
  DATABASE_URL: 'postgres://localhost/test',
  ACCESS_TOKEN_SECRET: 'x'.repeat(32),
};
const login = {
  SWAGGER_USERNAME: 'docs',
  SWAGGER_PASSWORD: 'long-enough-password',
};

describe('validateEnv: Swagger login', () => {
  it('refuses Swagger in production without a login', () => {
    expect(() =>
      validateEnv({ ...base, NODE_ENV: 'production', SWAGGER_ENABLED: 'true' }),
    ).toThrow(/SWAGGER_USERNAME and SWAGGER_PASSWORD/);
  });

  it('allows Swagger in production with a login', () => {
    const env = validateEnv({
      ...base,
      ...login,
      NODE_ENV: 'production',
      SWAGGER_ENABLED: 'true',
    });
    expect(env.SWAGGER_ENABLED).toBe(true);
    expect(env.SWAGGER_USERNAME).toBe('docs');
  });

  it('treats empty values (from docker compose) as unset', () => {
    const env = validateEnv({
      ...base,
      NODE_ENV: 'production',
      SWAGGER_ENABLED: 'false',
      SWAGGER_USERNAME: '',
      SWAGGER_PASSWORD: '',
    });
    expect(env.SWAGGER_USERNAME).toBeUndefined();
    expect(env.SWAGGER_PASSWORD).toBeUndefined();
  });

  it('needs both values, and a password of 12+ characters', () => {
    expect(() => validateEnv({ ...base, SWAGGER_USERNAME: 'docs' })).toThrow(
      /SWAGGER_USERNAME and SWAGGER_PASSWORD/,
    );
    expect(() =>
      validateEnv({ ...base, ...login, SWAGGER_PASSWORD: 'short' }),
    ).toThrow(/SWAGGER_PASSWORD must be longer than or equal to 12/);
  });

  it('keeps Swagger open without a login outside production', () => {
    expect(() => validateEnv(base)).not.toThrow();
  });
});
