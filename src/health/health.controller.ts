import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { sql } from 'kysely';
import { Public } from '../auth/decorators/public.decorator.js';
import { Database } from '../database/database.js';
import { ApiEnvelope } from '../common/swagger.js';
import { HealthEntity } from './entities/health.entity.js';

/** For load balancers, container healthchecks and uptime monitors */
@Controller('health')
export class HealthController {
  constructor(private readonly db: Database) {}

  @Public()
  @SkipThrottle()
  @Get()
  @ApiEnvelope(HealthEntity)
  async check(): Promise<HealthEntity> {
    try {
      await sql`select 1`.execute(this.db);
    } catch {
      throw new ServiceUnavailableException('Database is unreachable');
    }
    return { status: 'ok', database: 'up' };
  }
}
