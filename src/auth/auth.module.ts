import { Module } from '@nestjs/common';
import { AuthController } from './controllers/auth.controller';
import { EmailVerificationController } from './controllers/email-verification.controller';
import { MagicLinkController } from './controllers/magic-link.controller';
import { MeController } from './controllers/me.controller';
import { PasswordResetController } from './controllers/password-reset.controller';
import { PasswordController } from './controllers/password.controller';
import { SessionsController } from './controllers/sessions.controller';
import { TokensController } from './controllers/tokens.controller';
import { AuthThrottlerGuard } from './guards/auth-throttler.guard';
import { DrizzleAuthenticationStore } from './repositories/drizzle-authentication.store';
import { RBACRepository } from './repositories/rbac.repository';
import { UsersRepository } from './repositories/users.repository';
import {
  CredentialsService,
  EmailVerificationMailer,
  JwtAuth,
  MagicLinkMailer,
  PasswordResetMailer,
  SessionAuth,
} from './services';
import { RBACController } from './controllers/rbac.controller';
import { RBACService } from './services/rbac.service';
import { RBACPolicy } from './policies/rbac.policy';
import { AuthenticationModule } from '@nestjs/authentication';
import { ConfigService } from '@nestjs/config';
import { Env, trustedOrigins } from '../config/env';
import { AuthorizationModule } from '@nestjs/authorization';

@Module({
  imports: [
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
    // Registers the policy the app's @Can() checks name; a @Policy() provider
    // of any module is found too, but this module owns authorization here.
    //AuthorizationModule.forRoot({ policies: [RBACPolicy] }),
  ],
  controllers: [
    AuthController,
    TokensController,
    EmailVerificationController,
    PasswordResetController,
    PasswordController,
    MagicLinkController,
    SessionsController,
    MeController,
    RBACController,
  ],
  providers: [
    AuthThrottlerGuard,
    SessionAuth,
    JwtAuth,
    CredentialsService,
    UsersRepository,
    RBACRepository,
    DrizzleAuthenticationStore,
    EmailVerificationMailer,
    PasswordResetMailer,
    MagicLinkMailer,
    RBACService,
    RBACPolicy,
  ],
  exports: [UsersRepository, RBACRepository],
})
export class AuthModule {}
