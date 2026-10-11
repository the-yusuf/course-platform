import { existsSync } from 'node:fs';
import { PostgresDialect } from 'kysely';
import { defineConfig } from 'kysely-ctl';
import { Pool } from 'pg';

// The app loads .env through ConfigModule; the CLI needs to do it itself.
// Variables already set in the shell win, so DATABASE_URL=... npm run db:migrate works.
if (existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  dialect: new PostgresDialect({
    pool: new Pool({ connectionString: process.env.DATABASE_URL }),
  }),
  migrations: { migrationFolder: 'src/database/migrations' },
  seeds: { seedFolder: 'src/database/seeds' },
});
