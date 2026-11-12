import type { RedisClientConnectionType } from '@keyv/redis';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { REDIS_STORE } from './redis.constants';
import type { RedisStore } from './redis.options';

/** A value accepted by the Redis string commands exposed here. */
export type RedisValue = string | number | Buffer;

/** Options for a single `SCAN` page. */
export interface RedisScanOptions {
  /** Glob pattern matched against the namespaced key. Defaults to `*`. */
  MATCH?: string;
  /** Hint for how many keys Redis should inspect per page. */
  COUNT?: number;
  /** Only return keys of this Redis type (`string`, `hash`, `list`, ...). */
  TYPE?: string;
}

export interface RedisScanResult {
  /** Cursor to pass to the next `scan()` call; `"0"` means the iteration is done. */
  cursor: string;
  /** Un-prefixed keys for this page. */
  keys: string[];
}

/**
 * Low-level Redis access on the shared `RedisModule` connection.
 *
 * Unlike `CacheService` (which goes through Keyv), these methods map directly
 * to Redis commands: values are strings, TTLs are **seconds**, missing string
 * keys are `null`, and failures reject. Every keyed method applies the
 * adapter's namespace (`namespace::key`); use {@link getClient} when you need
 * the raw, un-namespaced connection (pub/sub, Lua scripts, lists, sets, ...).
 *
 * The client connects lazily through `getClient()`, which `onModuleInit` calls
 * at startup. Command calls after a lost connection follow the adapter's
 * reconnect policy (`throwOnErrors` does not apply to the raw client).
 */
@Injectable()
export class RedisService implements OnModuleInit {
  private redis?: RedisClientConnectionType;

  constructor(@Inject(REDIS_STORE) private readonly store: RedisStore) {}

  async onModuleInit(): Promise<void> {
    await this.getClient();
  }

  /**
   * The underlying client, connected on first use. Commands issued through it
   * are not namespaced and bypass the helpers below.
   */
  async getClient(): Promise<RedisClientConnectionType> {
    if (!this.redis) {
      this.redis = await this.store.getClient();
    }
    return this.redis;
  }

  /** Gets a string value. Returns `null` when the key does not exist. */
  async get(key: string): Promise<string | null> {
    return (await this.getClient()).get(this.key(key));
  }

  /**
   * Sets a string value. `ttlSeconds` expires the key in seconds; omit it for
   * no expiry. Returns `false` when a condition (e.g. `NX`) prevented the write.
   */
  async set(
    key: string,
    value: RedisValue,
    ttlSeconds?: number,
  ): Promise<boolean> {
    const client = await this.getClient();
    const reply = await client.set(
      this.key(key),
      this.encode(value),
      ttlSeconds === undefined ? undefined : { EX: ttlSeconds },
    );
    return reply === 'OK';
  }

  /** Gets many string values; missing keys are `null`, in the same order. */
  async getMany(keys: string[]): Promise<Array<string | null>> {
    if (keys.length === 0) return [];
    return (await this.getClient()).mGet(keys.map((key) => this.key(key)));
  }

  /** Sets many string values without expiry in one `MSET`. */
  async setMany(entries: Record<string, RedisValue>): Promise<boolean> {
    const pairs = Object.entries(entries).map(
      ([key, value]) =>
        [this.key(key), this.encode(value)] as [string, string | Buffer],
    );
    if (pairs.length === 0) return true;
    const reply = await (await this.getClient()).mSet(pairs);
    return reply === 'OK';
  }

  /** Deletes one or more keys and returns how many existed. */
  async delete(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    return (await this.getClient()).del(keys.map((key) => this.key(key)));
  }

  /** Returns how many of the given keys exist. */
  async exists(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    return (await this.getClient()).exists(keys.map((key) => this.key(key)));
  }

  /** Convenience boolean form of {@link exists}. */
  async has(key: string): Promise<boolean> {
    return (await this.exists(key)) > 0;
  }

  /** Sets a timeout in seconds. Returns `false` when the key does not exist. */
  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    return Boolean(
      await (await this.getClient()).expire(this.key(key), ttlSeconds),
    );
  }

  /**
   * Remaining TTL in seconds: `-1` when the key has no expiry, `-2` when the
   * key does not exist.
   */
  async ttl(key: string): Promise<number> {
    return (await this.getClient()).ttl(this.key(key));
  }

  /** Removes the expiry from a key. Returns `false` when there was none. */
  async persist(key: string): Promise<boolean> {
    return Boolean(await (await this.getClient()).persist(this.key(key)));
  }

  /** Atomically increments a counter by `by` (default `1`). */
  async increment(key: string, by = 1): Promise<number> {
    return (await this.getClient()).incrBy(this.key(key), by);
  }

  /** Atomically decrements a counter by `by` (default `1`). */
  async decrement(key: string, by = 1): Promise<number> {
    return (await this.getClient()).decrBy(this.key(key), by);
  }

  /**
   * Iterates keys with `SCAN` and returns every key in the namespace matching
   * `pattern`. Prefer this over Redis `KEYS`; it never blocks the server.
   * Returned keys are un-prefixed.
   */
  async keys(pattern = '*'): Promise<string[]> {
    const keys = new Set<string>();
    let cursor = '0';
    do {
      const page = await this.scan(cursor, { MATCH: pattern, COUNT: 100 });
      cursor = page.cursor;
      for (const key of page.keys) keys.add(key);
    } while (cursor !== '0');
    return [...keys];
  }

  /** Reads a single `SCAN` page. Returned keys are un-prefixed. */
  async scan(
    cursor: string | number = '0',
    options: RedisScanOptions = {},
  ): Promise<RedisScanResult> {
    const client = await this.getClient();
    const result = await client.scan(String(cursor), {
      ...options,
      MATCH: this.key(options.MATCH ?? '*'),
    });
    return {
      cursor: String(result.cursor),
      keys: result.keys.map((key) => this.store.getKeyWithoutPrefix(key)),
    };
  }

  /** Gets one hash field, or `null` when the key or field is missing. */
  async hGet(key: string, field: string): Promise<string | null> {
    return (await this.getClient()).hGet(this.key(key), field);
  }

  /** Sets one or many hash fields and returns the number of new fields. */
  async hSet(key: string, field: string, value: RedisValue): Promise<number>;
  async hSet(key: string, entries: Record<string, RedisValue>): Promise<number>;
  async hSet(
    key: string,
    fieldOrEntries: string | Record<string, RedisValue>,
    value?: RedisValue,
  ): Promise<number> {
    const client = await this.getClient();
    if (typeof fieldOrEntries === 'string') {
      return client.hSet(
        this.key(key),
        fieldOrEntries,
        this.encode(value as RedisValue),
      );
    }
    if (Object.keys(fieldOrEntries).length === 0) return 0;
    return client.hSet(this.key(key), this.encodeEntries(fieldOrEntries));
  }

  /** Gets every field and value in a hash. */
  async hGetAll(key: string): Promise<Record<string, string>> {
    const value = await (await this.getClient()).hGetAll(this.key(key));
    return value instanceof Map ? Object.fromEntries(value) : value;
  }

  /** Deletes hash fields and returns how many existed. */
  async hDelete(key: string, ...fields: string[]): Promise<number> {
    if (fields.length === 0) return 0;
    return (await this.getClient()).hDel(this.key(key), fields);
  }

  /** Publishes a message and returns the number of subscribers that received it. */
  async publish(channel: string, message: RedisValue): Promise<number> {
    return (await this.getClient()).publish(channel, this.encode(message));
  }

  /** Applies the adapter namespace to a key (`namespace::key`). */
  private key(key: string): string {
    return this.store.createKeyPrefix(key);
  }

  private encode(value: RedisValue): string | Buffer {
    return typeof value === 'number' ? value.toString() : value;
  }

  private encodeEntries(
    entries: Record<string, RedisValue>,
  ): Record<string, string | Buffer> {
    return Object.fromEntries(
      Object.entries(entries).map(([field, value]) => [
        field,
        this.encode(value),
      ]),
    );
  }
}
