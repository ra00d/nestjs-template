import {
  DynamicModule,
  Inject,
  Logger,
  Module,
  OnApplicationShutdown,
  Optional,
} from '@nestjs/common';
import KeyvRedis from '@keyv/redis';
import { REDIS_MODULE_OPTIONS, REDIS_STORE } from './redis.constants.js';
import type {
  RedisModuleOptions,
  RedisStore,
  RedisModuleAsyncOptions,
} from './redis.options.js';
const logger = new Logger('RedisModule');

/** Creates the shared `KeyvRedis` adapter from validated module options. */
function createStore(options: RedisModuleOptions): RedisStore {
  // `isGlobal` is a Nest concern, not a `KeyvRedis` option.
  const { url, isGlobal, ...adapterOptions } = options;
  void isGlobal;
  const store = new KeyvRedis(url, adapterOptions);
  // KeyvRedis emits `error` instead of rejecting when `throwOnErrors` is
  // false (the default). Without any listener an `error` event throws, so
  // keep a logging listener; consumers can add their own too.
  store.on('error', (error: unknown) => {
    logger.error(
      `Redis store error: ${error instanceof Error ? error.message : String(error)}`,
    );
  });
  return store;
}

function buildProviders(
  options: RedisModuleOptions | undefined,
  asyncOptions?: RedisModuleAsyncOptions,
) {
  if (asyncOptions) {
    return [
      {
        provide: REDIS_MODULE_OPTIONS,
        useFactory: asyncOptions.useFactory,
        inject: asyncOptions.inject ?? [],
      },
      {
        provide: REDIS_STORE,
        useFactory: (opts: RedisModuleOptions) => createStore(opts),
        inject: [REDIS_MODULE_OPTIONS],
      },
    ];
  }
  return [
    {
      provide: REDIS_MODULE_OPTIONS,
      useValue: options ?? { url: 'redis://localhost:6379' },
    },
    {
      provide: REDIS_STORE,
      useFactory: (opts: RedisModuleOptions) => createStore(opts),
      inject: [REDIS_MODULE_OPTIONS],
    },
  ];
}

@Module({})
export class RedisModule implements OnApplicationShutdown {
  constructor(
    @Optional() @Inject(REDIS_STORE) private readonly store?: RedisStore,
  ) {}

  static forRoot(options: RedisModuleOptions): DynamicModule {
    const isGlobal = options.isGlobal ?? true;
    const module: DynamicModule = {
      module: RedisModule,
      providers: buildProviders(options),
      exports: [REDIS_STORE],
      global: isGlobal,
    };
    return module;
  }

  static forRootAsync(asyncOptions: RedisModuleAsyncOptions): DynamicModule {
    const isGlobal = asyncOptions.isGlobal ?? true;
    const module: DynamicModule = {
      module: RedisModule,
      imports: asyncOptions.imports ?? [],
      providers: buildProviders(undefined, asyncOptions),
      exports: [REDIS_STORE],
      global: isGlobal,
    };
    return module;
  }

  async onApplicationShutdown(): Promise<void> {
    // Graceful close (`QUIT`); the adapter no-ops when never connected.
    await this.store?.disconnect();
  }
}
