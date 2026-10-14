import { Module } from '@nestjs/common';
import { AuthController } from './controllers/auth.controller.js';
import { EmailVerificationController } from './controllers/email-verification.controller.js';
import { MagicLinkController } from './controllers/magic-link.controller.js';
import { MeController } from './controllers/me.controller.js';
import { PasswordResetController } from './controllers/password-reset.controller.js';
import { PasswordController } from './controllers/password.controller.js';
import { SessionsController } from './controllers/sessions.controller.js';
import { TokensController } from './controllers/tokens.controller.js';
import { AuthThrottlerGuard } from './guards/auth-throttler.guard.js';
import { DrizzleAuthenticationStore } from './repositories/drizzle-authentication.store.js';
import { RBACRepository } from './repositories/rbac.repository.js';
import { UsersRepository } from './repositories/users.repository.js';
import {
  CredentialsService,
  EmailVerificationMailer,
  JwtAuth,
  MagicLinkMailer,
  PasswordResetMailer,
  SessionAuth,
} from './services.js';
import { RBACController } from './controllers/rbac.controller.js';
import { RBACService } from './services/rbac.service.js';

@Module({
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
  ],
  exports: [UsersRepository, RBACRepository],
})
export class AuthModule {}
