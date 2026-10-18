import { Public } from '@nestjs/authentication';
import { Inject, Optional, Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorService,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { REDIS_STORE } from '../redis/redis.constants';
import type { RedisStore } from '../redis/redis.options';

/**
 * Kubernetes-style probes. `/health` stays outside the global API prefix
 * and versioning (see `main.ts`): liveness can be the root `/` too, this
 * endpoint is the readiness gate (DB + Redis + heap).
 */
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly indicators: HealthIndicatorService,
    private readonly memory: MemoryHealthIndicator,
    @InjectDrizzle() private readonly db: NodePgDatabase,
    @Optional() @Inject(REDIS_STORE) private readonly redis?: RedisStore,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),
      () =>
        this.indicators
          .check('database')
          .attempt(async () => {
            await this.db.execute(sql`SELECT 1`);
          })
          .withTimeout(3000),
      () =>
        this.indicators
          .check('redis')
          .attempt(async () => {
            if (!this.redis) return { skipped: true };
            await this.redis.set('health:ping', '1', 5000);
            const pong = await this.redis.get('health:ping');
            if (pong === undefined || pong === null)
              throw new Error('redis unreachable');
          })
          .withTimeout(3000),
    ]);
  }
}
