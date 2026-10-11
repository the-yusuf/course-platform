import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { StorageService } from './storage/storage.service.js';
import { UPLOADS_URL_PREFIX } from './storage/storage.constants.js';
import type { EnvironmentVariables } from './config/env.validation.js';
import { requestLogger } from './common/request-logger.middleware.js';

/**
 * Everything that turns the bare Nest app into this API. Shared by main.ts
 * and the e2e tests, so tests run against exactly the production setup.
 */
export function configureApp(app: NestExpressApplication) {
  const config =
    app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);
  const swaggerEnabled =
    config.get('SWAGGER_ENABLED', { infer: true }) ??
    config.get('NODE_ENV', { infer: true }) !== 'production';

  // Behind a proxy, req.ip (used by rate limiting) must be the client's IP
  const trustProxy = config.get('TRUST_PROXY', { infer: true });
  if (trustProxy !== undefined)
    app.set('trust proxy', parseTrustProxy(trustProxy));

  // Registered first so every request (static files too) is logged and gets the headers
  app.use(requestLogger);
  app.use(
    helmet({
      // the frontend runs on another origin and must be able to show /uploads images
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      // Swagger UI needs inline scripts; the JSON API itself doesn't need a CSP
      contentSecurityPolicy: swaggerEnabled ? false : undefined,
    }),
  );

  app.setGlobalPrefix('api');

  // Uploaded files are public and served outside the `api` prefix.
  // In production, let nginx serve this directory instead.
  app.useStaticAssets(app.get(StorageService).rootDir, {
    prefix: `${UPLOADS_URL_PREFIX}/`,
    index: false,
    dotfiles: 'deny',
    immutable: true, // file names are UUIDs, so content never changes
    maxAge: '1y',
    setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
    origin: config
      .get('CORS_ORIGINS', { infer: true })
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  });

  if (swaggerEnabled) setupSwagger(app);

  app.enableShutdownHooks();
  return app;
}

// "true"/"false", a hop count like "1", or a name/IP list like "loopback"
function parseTrustProxy(value: string): boolean | number | string {
  if (value === 'true' || value === 'false') return value === 'true';
  return /^\d+$/.test(value) ? Number(value) : value;
}

function setupSwagger(app: NestExpressApplication) {
  const config = new DocumentBuilder()
    .setTitle('Chinese course platform')
    .setDescription(
      [
        'The backend api for the chinese course platform.',
        '',
        'Every success response is `{ statusCode, message, data }`; lists add `meta` ' +
          '(`total`, `page`, `limit`, `totalPages`) and take `?page=&limit=` (max 100).',
        'Every error is `{ statusCode, message, error, data: null }`; `message` is an ' +
          'array of strings for validation errors.',
      ].join('\n'),
    )
    .setVersion('1.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Paste the access_token from POST /api/auth/login',
    })
    .addSecurityRequirements('bearer')
    .build();

  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, documentFactory, {
    jsonDocumentUrl: 'api/docs-json',
    swaggerOptions: {
      persistAuthorization: true, // keep the token after a page reload
    },
  });
}
