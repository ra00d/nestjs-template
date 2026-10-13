import { AuthenticationModule } from '@nestjs/authentication';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { DrizzleModule } from '@nestjs/drizzle';
import {
  AcceptLanguageLocaleResolver,
  CookieLocaleResolver,
  HeaderLocaleResolver,
  I18nModule,
  I18nStandardSchemaValidationPipe,
  JsonI18nLoader,
  QueryLocaleResolver,
} from '@nestjs/i18n';
import {
  FileTemplateEngine,
  LogMailTransport,
  MailModule,
  SmtpTransport,
} from '@nestjs/mail';
import { MultipartModule } from '@nestjs/platform-fastify';
import { ThrottlerModule, minutes } from '@nestjs/throttler';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { join } from 'node:path';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { AuthThrottlerGuard } from './auth/guards/auth-throttler.guard.js';
import { CacheModule } from './cache/cache.module.js';
import { envSchema, trustedOrigins, type Env } from './config/env.js';
import {
  AuthenticationExceptionFilter,
  CatchAllExceptionFilter,
  DatabaseExceptionFilter,
  HttpExceptionFilter,
} from './exceptions/filters/index.js';
import { RedisModule } from './redis/redis.module.js';

@Module({
  imports: [
    // Validates the environment at bootstrap: a missing or malformed
    // variable stops the application before the first request.
    ConfigModule.forRoot({ isGlobal: true, validationSchema: envSchema }),

    MultipartModule.register({
      dest: './upload',
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
      }),
    }),

    // The Drizzle database, on a pg pool the module closes when the application shuts down.
    DrizzleModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (config: ConfigService<Env, true>) => {
        const connection: string = config.get('DATABASE_URL');
        const db = drizzle(connection, {});
        // await migrate(db, { migrationsFolder: './drizzle' });
        return {
          db,
        };
      },
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

    // Routes require a signed-in user by default; @Public() and
    // @Authenticate() relax or tighten that per route. Options are values
    // only: providers and stores register themselves in AuthModule.
    AuthenticationModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const appUrl = config.get('APP_URL');
        return {
          session: {
            absoluteTtl: '14d', // signed out after 14 days, however active
            idleTtl: '3d', // or after 3 days without a request
            trustedOrigins: trustedOrigins(config.get('TRUSTED_ORIGINS')),
            // Stored with every new session, whichever way the customer signed in.
            metadata: (request) => ({
              userAgent: request.headers['user-agent'],
            }),
          },
          accessToken: {
            key: config.get('JWT_SECRET'),
            issuer: appUrl,
            audience: 'web',
            ttl: '15m',
          },
          emailVerification: { url: `${appUrl}/verify-email` },
          passwordReset: { url: `${appUrl}/reset-password` },
          // Where the sign-in link points, like the two above. Links are bound
          // to the browser that asked for one, so this page and the one that
          // requests a link are the same browser.
          magicLink: { url: `${appUrl}/magic-link` },
        };
      },
    }),

    ThrottlerModule.forRoot([{ ttl: minutes(1), limit: 100 }]),

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

    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Exception filters, most specific first: Nest runs the first filter
    // whose `@Catch` metatypes match, and the catch-all matches everything,
    // so it must stay last.
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_FILTER, useClass: AuthenticationExceptionFilter },
    { provide: APP_FILTER, useClass: DatabaseExceptionFilter },
    { provide: APP_FILTER, useClass: CatchAllExceptionFilter },
    // Validates the request bodies whose handlers declare a `schema` (the
    // Zod schemas in src/auth/auth.schemas.ts) and translates the issues
    // with the `validation` namespace (`src/i18n/<locale>/validation.json`).
    { provide: APP_PIPE, useClass: I18nStandardSchemaValidationPipe },
    // The root module runs first, so this guard sees the request before the
    // authentication guard: guessed tokens count against the limit too.
    { provide: APP_GUARD, useClass: AuthThrottlerGuard },
  ],
})
export class AppModule {}
