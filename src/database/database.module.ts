import {
  Global,
  OnModuleInit,
  OnApplicationShutdown,
  Logger,
  Module,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PostgresDialect, sql } from 'kysely';
import { Pool } from 'pg';
import { Database } from './database.js';

@Global()
@Module({
  providers: [
    {
      provide: Database,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Database({
          dialect: new PostgresDialect({
            pool: new Pool({
              connectionString: config.getOrThrow<string>('DATABASE_URL'),
              max: config.getOrThrow<number>('DB_POOL_MAX'),
              connectionTimeoutMillis: 5_000, // fail fast when the pool is exhausted
              // a runaway query can't hold a connection forever
              statement_timeout: config.getOrThrow<number>(
                'DB_STATEMENT_TIMEOUT_MS',
              ),
            }),
          }),
        }),
    },
  ],
  exports: [Database],
})
export class DatabaseModule implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseModule.name);
  constructor(private readonly db: Database) {}

  async onModuleInit() {
    await sql`select 1`.execute(this.db);
    this.logger.log('Connected to PostgreSQL');
  }

  async onApplicationShutdown() {
    await this.db.destroy();
  }
}
