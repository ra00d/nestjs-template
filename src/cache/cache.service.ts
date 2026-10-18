import { Inject, Injectable } from '@nestjs/common';
import type Keyv from 'keyv';
import { CACHE_INSTANCE } from './cache.constants';

/**
 * Typed wrapper around the shared `Keyv` instance. Every method passes
 * through to Keyv, so TTLs are milliseconds and `undefined` means "missing
 * or expired". Failures follow the Redis adapter's `throwOnErrors` policy:
 * by default they emit `error` and resolve to a fallback (`undefined` /
 * `false`) instead of rejecting.
 */
@Injectable()
export class CacheService {
  constructor(@Inject(CACHE_INSTANCE) private readonly keyv: Keyv) {}

  /** The underlying Keyv instance, for iterators, hooks, and stats. */
  getKeyv(): Keyv {
    return this.keyv;
  }

  async get<T>(key: string): Promise<T | undefined> {
    return this.keyv.get<T>(key);
  }

  async getMany<T>(keys: string[]): Promise<Array<T | undefined>> {
    return this.keyv.getMany<T>(keys);
  }

  /**
   * Store a value. `ttl` (ms) overrides the module's `defaultTtl` for this key.
   * Non-positive TTLs are treated as "no expiry" by Keyv.
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    return this.keyv.set(key, value, ttl);
  }

  async setMany<T>(
    entries: Array<{ key: string; value: T; ttl?: number }>,
  ): Promise<boolean[]> {
    return this.keyv.setMany(entries);
  }

  async delete(key: string): Promise<boolean>;
  async delete(keys: string[]): Promise<boolean[]>;
  async delete(key: string | string[]): Promise<boolean | boolean[]> {
    return Array.isArray(key)
      ? this.keyv.deleteMany(key)
      : this.keyv.delete(key);
  }

  async deleteMany(keys: string[]): Promise<boolean[]> {
    return this.keyv.deleteMany(keys);
  }

  async has(key: string): Promise<boolean> {
    return this.keyv.has(key);
  }

  async hasMany(keys: string[]): Promise<boolean[]> {
    return this.keyv.hasMany(keys);
  }

  /** Clears keys in this instance's namespace (not the whole Redis). */
  async clear(): Promise<void> {
    await this.keyv.clear();
  }

  /**
   * Cache-aside helper: returns the cached value, or calls `fn`, caches its
   * result, and returns it. `ttl` (ms) overrides `defaultTtl` for the write.
   * Concurrent misses for the same key each call `fn`; memoize upstream if
   * that matters.
   */
  async wrap<T>(
    key: string,
    fn: () => Promise<T> | T,
    ttl?: number,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }
    const value = await fn();
    await this.set(key, value, ttl);
    return value;
  }
}
