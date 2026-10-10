import type { ModuleMetadata } from '@nestjs/common';
import type KeyvRedis from '@keyv/redis';

/**
 * Options for the Redis module. `url` is the Redis connection string;
 * every other field maps 1:1 to `KeyvRedis` adapter options.
 */
export interface RedisModuleOptions {
  /** Redis connection string, e.g. `redis://localhost:6379`. */
  url: string;
  /** Prefixes every key as `<namespace>::<key>`. Isolates this app on a shared Redis. */
  namespace?: string;
  /** Separator between namespace and key. */
  namespaceSeparator?: string;
  /** How many keys a `clear()` SCAN batch deletes at once. */
  clearBatchSize?: number;
  /** Use non-blocking `UNLINK` instead of `DEL` when clearing. */
  useUnlink?: boolean;
  /** When no namespace is set, allow `clear()`/`iterator()` to touch every key. */
  noNamespaceAffectsAll?: boolean;
  /** Throw when the initial connection fails instead of emitting `error`. */
  throwOnConnectError?: boolean;
  /** Throw on every operation failure instead of emitting `error` + returning a fallback. */
  throwOnErrors?: boolean;
  /** Timeout (ms) for the TCP + HELLO/AUTH handshake. */
  connectionTimeout?: number;
  /** Make the module global so any provider can inject `REDIS_STORE`. */
  isGlobal?: boolean;
}

export interface RedisModuleAsyncOptions {
  imports?: ModuleMetadata['imports'];
  inject?: any[];
  // biome-ignore lint/suspicious/noExplicitAny: Nest factory args are untyped by design.
  useFactory: (
    ...args: any[]
  ) => Promise<RedisModuleOptions> | RedisModuleOptions;
  isGlobal?: boolean;
}

export type RedisStore = InstanceType<typeof KeyvRedis>;
