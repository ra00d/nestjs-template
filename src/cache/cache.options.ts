import type { ModuleMetadata } from '@nestjs/common';
import type { KeyvStorageAdapter } from 'keyv';

/**
 * Options for the Cache module. The backing store comes from `RedisModule`
 * (`REDIS_STORE`) unless `store` is given explicitly — handy for tests,
 * where a plain `Map` avoids needing a live Redis.
 */
export interface CacheModuleOptions {
  /**
   * Explicit store, bypassing the injected `REDIS_STORE`. Accepts any
   * Keyv-compatible store (`KeyvRedis`, another adapter, or a `Map`).
   */
  store?: KeyvStorageAdapter | Map<unknown, unknown>;
  /** Default TTL (ms) for `set()` calls that omit one. `undefined` never expires. */
  defaultTtl?: number;
  /**
   * Namespace for every key (`<namespace>::<key>`). When omitted, the
   * Redis adapter's own namespace is kept.
   */
  namespace?: string;
  /** Make the module global so any provider can inject `CacheService`. */
  isGlobal?: boolean;
}

export interface CacheModuleAsyncOptions {
  imports?: ModuleMetadata['imports'];
  inject?: any[];
  useFactory: (
    ...args: any[]
  ) => Promise<CacheModuleOptions> | CacheModuleOptions;
  isGlobal?: boolean;
}
