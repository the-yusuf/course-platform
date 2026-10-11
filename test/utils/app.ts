import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { sql } from 'kysely';
import request from 'supertest';
import { inject } from 'vitest';
import type { Database } from '../../src/database/database.js';

export const UPLOADS_BASE_URL = 'http://e2e.test/uploads';

export interface TestApp {
  app: NestExpressApplication;
  http: ReturnType<typeof request>;
  db: Database;
  /** the app's upload dir; its parent holds files that must never be served */
  uploadDir: string;
  /** http://127.0.0.1:<port>, for raw requests supertest would normalise */
  baseUrl: string;
  close: () => Promise<void>;
}

/**
 * Boots the real AppModule + configureApp() against the e2e database, with an
 * empty database and a temp upload dir. Rate limits are lifted unless `env`
 * sets them. Call once per spec file (each file gets a fresh module graph).
 */
export async function createTestApp(
  env: Record<string, string> = {},
): Promise<TestApp> {
  const root = await mkdtemp(path.join(tmpdir(), 'course-platform-e2e-'));
  const uploadDir = path.join(root, 'uploads');
  await mkdir(uploadDir);

  // ConfigModule reads process.env when AppModule is imported, so set it first
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: inject('databaseUrl'),
    UPLOAD_DIR: uploadDir,
    UPLOADS_BASE_URL,
    THROTTLE_LIMIT: '1000000',
    THROTTLE_AUTH_LIMIT: '1000000',
    THROTTLE_LOGIN_USERNAME_LIMIT: '1000000',
    ...env,
  });
  const { AppModule } = await import('../../src/app.module.js');
  const { configureApp } = await import('../../src/app.setup.js');
  const { Database } = await import('../../src/database/database.js');

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    logger: ['error'],
  });
  configureApp(app);
  await app.listen(0, '127.0.0.1');

  const db = app.get(Database);
  await sql`truncate users, courses, dictionary_categories, stories, grammars cascade`.execute(
    db,
  );

  const { port } = app.getHttpServer().address() as AddressInfo;
  return {
    app,
    http: request(app.getHttpServer()),
    db,
    uploadDir,
    baseUrl: `http://127.0.0.1:${port}`,
    close: async () => {
      await app.close();
      await rm(root, { recursive: true, force: true });
    },
  };
}
