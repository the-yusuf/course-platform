import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateIf,
  validateSync,
} from 'class-validator';

const toBoolean = ({ value }: { value: unknown }) =>
  value === undefined
    ? undefined
    : value === true || value === 'true' || value === '1';

// docker compose passes an unset variable as an empty string
const emptyToUndefined = ({ value }: { value: unknown }) =>
  value === '' ? undefined : value;

// The docs login is all or nothing, and Swagger can't be on in production without it
const needsDocsLogin = (env: EnvironmentVariables) =>
  env.SWAGGER_USERNAME !== undefined ||
  env.SWAGGER_PASSWORD !== undefined ||
  (env.NODE_ENV === 'production' && env.SWAGGER_ENABLED === true);
const DOCS_LOGIN_MESSAGE =
  'set both SWAGGER_USERNAME and SWAGGER_PASSWORD (required to turn Swagger on in production)';

// Every setting the app reads. The app refuses to start if one is invalid,
// instead of failing later on the first request that needs it.
export class EnvironmentVariables {
  @IsIn(['development', 'production', 'test'])
  NODE_ENV: 'development' | 'production' | 'test' = 'development';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 3000;

  @Matches(/^postgres(ql)?:\/\//, {
    message: 'DATABASE_URL must be a postgres:// connection string',
  })
  DATABASE_URL: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  DB_POOL_MAX = 10;

  @Type(() => Number)
  @IsInt()
  @Min(100)
  DB_STATEMENT_TIMEOUT_MS = 10_000;

  @IsString()
  @MinLength(32)
  ACCESS_TOKEN_SECRET: string;

  @IsString()
  UPLOAD_DIR = 'uploads';

  @IsOptional()
  @IsUrl({ require_tld: false, protocols: ['http', 'https'] })
  UPLOADS_BASE_URL?: string;

  // Comma-separated list of frontend origins allowed to call the API
  @IsString()
  CORS_ORIGINS = 'http://localhost:5173';

  // Express "trust proxy" setting, e.g. "loopback" or "1" behind one proxy.
  // Needed for per-IP rate limits to see the client IP instead of the proxy's.
  @IsOptional()
  @IsString()
  TRUST_PROXY?: string;

  // Defaults to on outside production
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  SWAGGER_ENABLED?: boolean;

  // Browser login (HTTP Basic auth) in front of /api/docs
  @ValidateIf(needsDocsLogin)
  @Transform(emptyToUndefined)
  @IsString({ message: DOCS_LOGIN_MESSAGE })
  SWAGGER_USERNAME?: string;

  @ValidateIf(needsDocsLogin)
  @Transform(emptyToUndefined)
  @IsString({ message: DOCS_LOGIN_MESSAGE })
  @MinLength(12)
  SWAGGER_PASSWORD?: string;

  // Rate limits: requests per window, per client IP
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  THROTTLE_TTL_MS = 60_000;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  THROTTLE_LIMIT = 120;

  // Stricter limit for login, register and refresh
  @Type(() => Number)
  @IsInt()
  @Min(1)
  THROTTLE_AUTH_LIMIT = 10;

  // Login attempts per username; the username is then blocked for the window
  @Type(() => Number)
  @IsInt()
  @Min(1)
  THROTTLE_LOGIN_USERNAME_LIMIT = 5;

  @Type(() => Number)
  @IsInt()
  @Min(1000)
  THROTTLE_LOGIN_USERNAME_TTL_MS = 15 * 60_000;

  // Only read by `npm run db:seed`
  @IsOptional()
  @IsString()
  ADMIN_USERNAME?: string;

  @IsOptional()
  @IsEmail()
  ADMIN_EMAIL?: string;

  @IsOptional()
  @IsString()
  ADMIN_PASSWORD?: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const env = plainToInstance(EnvironmentVariables, config);
  const errors = validateSync(env);
  if (errors.length > 0) {
    const messages = errors.flatMap((e) => Object.values(e.constraints ?? {}));
    const details = [...new Set(messages)].join('\n  - ');
    throw new Error(`Invalid environment variables:\n  - ${details}`);
  }
  return env;
}
