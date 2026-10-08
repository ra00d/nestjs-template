import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthThrottlerGuard } from './auth-throttler.guard.js';
import { CredentialsService } from './credentials.service.js';
import { DrizzleAuthenticationStore } from './drizzle-authentication.store.js';
import { EmailVerificationController } from './email-verification.controller.js';
import { EmailVerificationMailer } from './email-verification.mailer.js';
import { JwtAuth } from './jwt-auth.provider.js';
import { PasswordController } from './password.controller.js';
import { PasswordResetController } from './password-reset.controller.js';
import { PasswordResetMailer } from './password-reset.mailer.js';
import { SessionAuth } from './session-auth.provider.js';
import { SessionsController } from './sessions.controller.js';
import { TokensController } from './tokens.controller.js';

@Module({
  imports: [UsersModule],
  controllers: [
    AuthController,
    TokensController,
    EmailVerificationController,
    PasswordResetController,
    PasswordController,
    SessionsController,
  ],
  providers: [
    AuthThrottlerGuard,
    SessionAuth,
    JwtAuth,
    CredentialsService,
    DrizzleAuthenticationStore,
    EmailVerificationMailer,
    PasswordResetMailer,
  ],
})
export class AuthModule {}