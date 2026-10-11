import { applyDecorators, ExecutionContext, SetMetadata } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';
import type { EnvironmentVariables } from '../config/env.validation.js';

const AUTH_LIMIT = 'throttle:auth';
const LOGIN_LIMIT = 'throttle:login';

/** Stricter per-IP limit for endpoints that are worth brute-forcing */
export const AuthRateLimit = () => SetMetadata(AUTH_LIMIT, true);

/** AuthRateLimit + a per-username limit, which also stops attacks spread over many IPs */
export const LoginRateLimit = () =>
  applyDecorators(
    SetMetadata(AUTH_LIMIT, true),
    SetMetadata(LOGIN_LIMIT, true),
  );

const marked = (key: string) => (context: ExecutionContext) =>
  Reflect.getMetadata(key, context.getHandler()) === true;

export function throttlerOptions(
  config: ConfigService<EnvironmentVariables, true>,
): ThrottlerModuleOptions {
  const ttl = config.get('THROTTLE_TTL_MS', { infer: true });
  const loginTtl = config.get('THROTTLE_LOGIN_USERNAME_TTL_MS', {
    infer: true,
  });

  return {
    errorMessage: 'Too many requests, please try again later',
    throttlers: [
      // every route, per client IP
      {
        name: 'default',
        ttl,
        limit: config.get('THROTTLE_LIMIT', { infer: true }),
      },
      {
        name: 'auth',
        ttl,
        limit: config.get('THROTTLE_AUTH_LIMIT', { infer: true }),
        skipIf: (context) => !marked(AUTH_LIMIT)(context),
      },
      {
        // counted per username whether or not it exists, so the limit itself
        // doesn't reveal which accounts are real
        name: 'login-username',
        ttl: loginTtl,
        blockDuration: loginTtl,
        limit: config.get('THROTTLE_LOGIN_USERNAME_LIMIT', { infer: true }),
        skipIf: (context) => !marked(LOGIN_LIMIT)(context),
        getTracker: (req) =>
          `username:${String(req.body?.username ?? '')
            .trim()
            .toLowerCase()}`,
      },
    ],
  };
}
