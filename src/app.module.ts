import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { AuthenticationModule } from '@nestjs/authentication';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DrizzleModule } from '@nestjs/drizzle';
import { FileTemplateEngine, LogMailTransport, MailModule, SmtpTransport } from '@nestjs/mail';
import { StandardSchemaValidationPipe } from '@nestjs/common';
import { ThrottlerModule, minutes } from '@nestjs/throttler';
import { drizzle } from 'drizzle-orm/node-postgres';
import { join } from 'node:path';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { AuthThrottlerGuard } from './auth/auth-throttler.guard.js';
import { envSchema, trustedOrigins, type Env } from './config/env.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    // Validates the environment at bootstrap: a missing or malformed
    // variable stops the application before the first request.
    ConfigModule.forRoot({ isGlobal: true, validationSchema: envSchema }),

    // The Drizzle database, on a pg pool the module closes when the application shuts down.
    DrizzleModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const connection: string = config.get('DATABASE_URL');
        return { drizzle, connection };
      },
    }),

    // Email: links in LogMailTransport's log during development, through
    // SMTP when SMTP_URL is set.
    MailModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        transport: config.get('SMTP_URL') ? new SmtpTransport({ url: config.get('SMTP_URL') }) : new LogMailTransport(),
        templates: new FileTemplateEngine({ dir: join(import.meta.dirname, 'mail/templates') }),
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
            metadata: (request) => ({ userAgent: request.headers['user-agent'] }),
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

    UsersModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Validates the request bodies whose handlers declare a `schema` (the
    // Zod schemas in src/auth/auth.schemas.ts).
    { provide: APP_PIPE, useClass: StandardSchemaValidationPipe },
    // The root module runs first, so this guard sees the request before the
    // authentication guard: guessed tokens count against the limit too.
    { provide: APP_GUARD, useClass: AuthThrottlerGuard },
  ],
})
export class AppModule {}