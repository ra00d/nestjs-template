import { Logger } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import Keyv from 'keyv';
import type { RedisStore } from '../redis/redis.options.js';

interface ThrottleRecord {
  /** Absolute expiry of the fixed window, ms since epoch. */
  expiresAt: number;
  /** Hit timestamps (expiry = hit + ttl), ms since epoch. */
  hits: number[];
  /** Requests in this window are rejected while `now < blockedUntil`. */
  blockedUntil: number;
}

/**
 * `ThrottlerStorage` on the shared Redis adapter, so limits hold across
 * API instances. Sliding window per (`tracker`, `throttlerName`); the
 * record auto-evicts via Keyv TTL.
 *
 * Fail-open: when Redis is unreachable Keyv resolves to a fallback instead
 * of rejecting, and this storage allows the request (availability over
 * enforcement). Concurrent bursts from several instances can slightly
 * over-admit: increments are read-modify-write, not Lua-atomic. Acceptable
 * for rate limiting; use a token bucket service if exactness matters.
 */
export class KeyvThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(KeyvThrottlerStorage.name);
  private readonly keyv: Keyv;

  constructor(redisStore: RedisStore) {
    this.keyv = new Keyv({ store: redisStore, namespace: 'throttler' });
    this.keyv.on('error', (error: unknown) => {
      this.logger.error(
        `Throttler store error: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): ReturnType<ThrottlerStorage['increment']> {
    const now = Date.now();
    const storageKey = `${key}::${throttlerName}`;
    // Keep the record a little past the longest live hit so late
    // `timeToExpire` reads still find it; Keyv TTLs are milliseconds.
    const recordTtl = Math.max(ttl, blockDuration) + 1000;

    let record: ThrottleRecord | undefined;
    try {
      record = await this.keyv.get<ThrottleRecord>(storageKey);
    } catch {
      record = undefined;
    }
    if (!record || record.expiresAt <= now) {
      record = { expiresAt: now + ttl, hits: [], blockedUntil: 0 };
    }
    record.hits = record.hits.filter((expiresAt) => expiresAt > now);

    const timeToExpire = Math.max(
      1,
      Math.ceil((record.expiresAt - now) / 1000),
    );

    if (record.blockedUntil > now) {
      return {
        totalHits: limit + 1,
        timeToExpire,
        isBlocked: true,
        timeToBlockExpire: Math.ceil((record.blockedUntil - now) / 1000),
      };
    }

    if (record.hits.length >= limit) {
      record.blockedUntil = blockDuration > 0 ? now + blockDuration : now + ttl;
      await this.persist(storageKey, record, recordTtl);
      return {
        totalHits: limit + 1,
        timeToExpire,
        isBlocked: true,
        timeToBlockExpire: Math.ceil((record.blockedUntil - now) / 1000),
      };
    }

    record.hits.push(now + ttl);
    await this.persist(storageKey, record, recordTtl);
    return {
      totalHits: record.hits.length,
      timeToExpire,
      isBlocked: false,
      timeToBlockExpire: 0,
    };
  }

  private async persist(
    key: string,
    record: ThrottleRecord,
    ttl: number,
  ): Promise<void> {
    try {
      await this.keyv.set(key, record, ttl);
    } catch {
      // Fail-open: the increment is already counted locally for this
      // response; the next request re-reads from Redis.
    }
  }
}
