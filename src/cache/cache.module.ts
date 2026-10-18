import {
  DynamicModule,
  Inject,
  Logger,
  Module,
  OnApplicationShutdown,
  Optional,
} from '@nestjs/common';
import Keyv from 'keyv';
import { CacheService } from './cache.service';
import { CACHE_INSTANCE, CACHE_MODULE_OPTIONS } from './cache.constants';
import type {
  CacheModuleAsyncOptions,
  CacheModuleOptions,
} from './cache.options';
import { REDIS_STORE } from '../redis/redis.constants';
import type { RedisStore } from '../redis/redis.options';

const logger = new Logger('CacheModule');

/** Creates the shared `Keyv` instance, mirroring `createKeyv` from `@keyv/redis`. */
function createKeyvInstance(
  options: CacheModuleOptions,
  redisStore?: RedisStore,
): Keyv {
  const store = (options.store ??
    redisStore ??
    new Map()) as ConstructorParameters<typeof Keyv>[0];
  const adapterNamespace =
    typeof (store as { namespace?: unknown }).namespace === 'string'
      ? ((store as { namespace?: string }).namespace as string)
      : undefined;
  const keyv = new Keyv({
    store,
    namespace: options.namespace ?? adapterNamespace,
    ttl: options.defaultTtl,
  });
  // Without any listener an `error` event throws, so keep a logging one;
  // consumers can add their own on the injected instance.
  keyv.on('error', (error: unknown) => {
    logger.error(
      `Cache error: ${error instanceof Error ? error.message : String(error)}`,
    );
  });
  return keyv;
}

function buildProviders(
  options: CacheModuleOptions | undefined,
  asyncOptions?: CacheModuleAsyncOptions,
) {
  const optionsProvider =
    asyncOptions != null
      ? {
          provide: CACHE_MODULE_OPTIONS,
          useFactory: asyncOptions.useFactory,
          inject: asyncOptions.inject ?? [],
        }
      : { provide: CACHE_MODULE_OPTIONS, useValue: options ?? {} };
  const instanceProvider = {
    provide: CACHE_INSTANCE,
    useFactory: (opts: CacheModuleOptions, redisStore?: RedisStore) =>
      createKeyvInstance(opts, redisStore),
    inject: [CACHE_MODULE_OPTIONS, { token: REDIS_STORE, optional: true }],
  };
  return [optionsProvider, instanceProvider, CacheService];
}

@Module({})
export class CacheModule implements OnApplicationShutdown {
  constructor(
    @Optional() @Inject(CACHE_INSTANCE) private readonly keyv?: Keyv,
  ) {}

  static forRoot(options: CacheModuleOptions = {}): DynamicModule {
    const isGlobal = options.isGlobal ?? true;
    return {
      module: CacheModule,
      providers: buildProviders(options),
      exports: [CACHE_INSTANCE, CacheService],
      global: isGlobal,
    };
  }

  static forRootAsync(asyncOptions: CacheModuleAsyncOptions): DynamicModule {
    const isGlobal = asyncOptions.isGlobal ?? true;
    return {
      module: CacheModule,
      imports: asyncOptions.imports ?? [],
      providers: buildProviders(undefined, asyncOptions),
      exports: [CACHE_INSTANCE, CacheService],
      global: isGlobal,
    };
  }

  async onApplicationShutdown(): Promise<void> {
    // Disconnects the store when it supports it; a `Map` store no-ops.
    // The Redis adapter is also closed by `RedisModule` — its disconnect
    // no-ops when already closed, so owning order does not matter.
    await this.keyv?.disconnect?.();
  }
}
