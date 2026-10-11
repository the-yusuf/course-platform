import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';
import { Kysely, PostgresDialect } from 'kysely';
import { FileMigrationProvider, Migrator } from 'kysely/migration';
import pg from 'pg';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

/**
 * Creates a throwaway "<your db>-e2e" database next to the one in
 * DATABASE_URL, migrates it, and drops it when the run ends.
 * Your dev data is never touched.
 */
export default async function setup(project: TestProject) {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) throw new Error('DATABASE_URL is required to run e2e tests');

  const testUrl = new URL(baseUrl);
  const name = `${decodeURIComponent(testUrl.pathname.slice(1))}-e2e`;
  testUrl.pathname = `/${encodeURIComponent(name)}`;

  await adminQuery(baseUrl, `DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await adminQuery(baseUrl, `CREATE DATABASE "${name}"`);

  const db = new Kysely<unknown>({
    dialect: new PostgresDialect({
      pool: new pg.Pool({ connectionString: testUrl.toString() }),
    }),
  });
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.resolve('src/database/migrations'),
    }),
  });
  const { error } = await migrator.migrateToLatest();
  await db.destroy();
  if (error) throw error;

  project.provide('databaseUrl', testUrl.toString());

  return () =>
    adminQuery(baseUrl, `DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
}

async function adminQuery(connectionString: string, query: string) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query(query);
  } finally {
    await client.end();
  }
}
