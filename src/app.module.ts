import { Module, UnprocessableEntityException } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import {
  AcceptLanguageLocaleResolver,
  CookieLocaleResolver,
  HeaderLocaleResolver,
  I18nModule,
  I18nStandardSchemaValidationPipe,
  JsonI18nLoader,
  QueryLocaleResolver,
  t,
} from '@nestjs/i18n';
import {
  FileTemplateEngine,
  LogMailTransport,
  MailModule,
  SmtpTransport,
} from '@nestjs/mail';
import { MulterModule } from '@nestjs/platform-node';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerModule, minutes } from '@nestjs/throttler';
import { join } from 'node:path';
import { AppController } from './app.controller';
import { CacheModule } from './cache/cache.module';
import {
  AuthenticationExceptionFilter,
  CatchAllExceptionFilter,
  DatabaseExceptionFilter,
  HttpExceptionFilter,
  TimeoutInterceptor,
  TransformInterceptor,
  TrimPipe,
  ValidationExceptionFilter,
} from './common';
import { LoggerModule } from './common/logger/logger.module';
import { envSchema, type Env } from './config/env';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { AbacModule } from './modules/abac/abac.module';
import { AuditModule } from './modules/audit';
import { AuthModule } from './modules/auth/auth.module';
import { REDIS_STORE } from './redis/redis.constants';
import { RedisModule } from './redis/redis.module';
import type { RedisStore } from './redis/redis.options';
import { StorageModule } from './storage/storage.module';
import { TasksModule } from './tasks/tasks.module';
import { KeyvThrottlerStorage } from './throttler/keyv-throttler.storage';

@Module({
  controllers: [AppController],
  imports: [
    // Validates the environment at bootstrap: a missing or malformed
    // variable stops the application before the first request.
    ConfigModule.forRoot({ isGlobal: true, validationSchema: envSchema }),
    ServeStaticModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        return [
          {
            rootPath: join(import.meta.dirname, '..', config.get('PUBLIC_DIR')),
          },
        ];
      },
    }),

    // Application logging: `AppLogger` (stdout/stderr with automatic
    // secret stripping) plus the outermost request-id interceptor feeding
    // it the correlation ID.
    LoggerModule.forRoot(),

    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        dest: config.get('UPLOAD_DIR'),
        limits: { fileSize: 10 * 1024 * 1024, files: 5, parts: 1000 },
      }),
    }),
    // Localization: catalogs in `src/i18n/<locale>/*.json` (each file is a
    // namespace: `en/auth.json` -> `auth.*`). The locale is resolved per
    // request, in order: `?lang=de`, the `x-lang` header, the `lang` cookie,
    // then `Accept-Language`. Anything else gets `DEFAULT_LOCALE`.
    I18nModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        loader: new JsonI18nLoader({
          path: join(import.meta.dirname, 'i18n'),
          watch: config.get('NODE_ENV') !== 'production',
        }),
        resolvers: [
          new QueryLocaleResolver('lang'),
          new HeaderLocaleResolver('x-lang'),
          new CookieLocaleResolver('lang'),
          new AcceptLanguageLocaleResolver(),
        ],
        defaultLocale: config.get('DEFAULT_LOCALE'),
        missingKey: (key, locale) => {
          console.log(key, locale);

          return 'fallback';
        },
      }),
    }),
    // Email: links in LogMailTransport's log during development, through
    // SMTP when SMTP_URL is set.
    MailModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        transport: config.get('SMTP_URL')
          ? new SmtpTransport({ url: config.get('SMTP_URL') })
          : new LogMailTransport(),
        templates: new FileTemplateEngine({
          dir: join(import.meta.dirname, 'mail/templates'),
        }),
        from: config.get('MAIL_FROM'),
      }),
    }),

    // Shared Redis connection (`REDIS_STORE`), closed on shutdown. The
    // cache, rate limiter, or session stores all inject the same adapter.
    RedisModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        url: config.get('REDIS_URL'),
        namespace: config.get('REDIS_NAMESPACE'),
      }),
    }),

    // Typed Keyv wrapper (`CacheService` + `CACHE_INSTANCE`) backed by Redis.
    CacheModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        defaultTtl: config.get('CACHE_DEFAULT_TTL'),
      }),
    }),

    // Shared limits across instances: sliding window on Redis instead of
    // per-process memory, so a fleet enforces one quota.
    ThrottlerModule.forRootAsync({
      inject: [REDIS_STORE],
      useFactory: (store: RedisStore) => ({
        throttlers: [{ ttl: minutes(1), limit: 100 }],
        storage: new KeyvThrottlerStorage(store),
      }),
    }),

    HealthModule,

    DatabaseModule,

    StorageModule.forRoot(),

    TasksModule,
    AuthModule,
    AuditModule,
    AbacModule,
  ],
  providers: [
    // Exception filters, most generic first: Nest runs the last filter
    // whose `@Catch` metatypes match, and the catch-all matches everything,
    // so it must stay first.
    { provide: APP_FILTER, useClass: CatchAllExceptionFilter },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_FILTER, useClass: ValidationExceptionFilter },
    { provide: APP_FILTER, useClass: AuthenticationExceptionFilter },
    { provide: APP_FILTER, useClass: DatabaseExceptionFilter },
    // Validates the request bodies whose handlers declare a `schema` (the
    // Zod schemas in src/auth/auth.schemas.ts) and translates the issues
    // with the `validation` namespace (`src/i18n/<locale>/validation.json`).
    // TrimPipe runs first so validation sees trimmed values.
    { provide: APP_PIPE, useClass: TrimPipe },
    {
      provide: APP_PIPE,
      useValue: new I18nStandardSchemaValidationPipe({
        errorHttpStatusCode: 422,
        validateCustomDecorators: true,
        exceptionFactory: (issues) => {
          let errors: Record<string, string> = {};
          const keys: string[] = [];
          let errMsg = 'invalid input for: ';
          issues.forEach((is) => {
            const key = is.path?.at(0) as string;
            keys.push(t(('validation.' + key) as any));
            errMsg = errMsg + ' ' + key;
            if (key) errors[key] = is.message;
          });
          return new UnprocessableEntityException(
            {
              errors,
              message: t('validation.custom', {
                args: {
                  keys: keys,
                },
              }), // 'invalid_input',
            },
            {
              description: 'some of the user input are invalid',
            },
          );
        },
      }),
    },
    // One envelope for every JSON response (`{ data }`, paginated results
    // pass through), plus a 408 for handlers slower than REQUEST_TIMEOUT_MS.
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TimeoutInterceptor },
  ],
})
export class AppModule {}
