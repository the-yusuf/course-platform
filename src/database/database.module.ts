import {
  Global,
  OnModuleInit,
  OnApplicationShutdown,
  Logger,
  Module,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { PostgresDialect, sql } from 'kysely';
import { Pool } from 'pg';
import { Database } from './database.js';
import { PgExceptionFilter } from './pg-exception.filter.js';

@Global()
@Module({
  providers: [
    { provide: APP_FILTER, useClass: PgExceptionFilter },
    {
      provide: Database,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Database({
          dialect: new PostgresDialect({
            pool: new Pool({
              connectionString: config.getOrThrow<string>('DATABASE_URL'),
              max: 10,
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
