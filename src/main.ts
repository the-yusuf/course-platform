import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { StorageService } from './storage/storage.service.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix('api');

  // Uploaded files are public and served outside the `api` prefix.
  // In production, let nginx serve this directory instead.
  app.useStaticAssets(app.get(StorageService).rootDir, {
    prefix: '/uploads/',
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
    origin: ['http://localhost:3000'],
  });

  const config = new DocumentBuilder()
    .setTitle('Chinese course platform')
    .setDescription('The backend api for the chinese course platform')
    .setVersion('1.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Paste the accessToken from POST /api/auth/login',
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

  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
