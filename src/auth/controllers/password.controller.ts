import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { CurrentUser, SessionService, SignInService, TokenService } from '@nestjs/authentication';
import type { User } from '../types/user';
import { changePasswordSchema, type ChangePasswordDto } from '../dto/auth.schemas';
import { CredentialsService } from '../services/credentials.service';

@Controller('auth/password')
export class PasswordController {
  constructor(
    private readonly credentialsService: CredentialsService,
    private readonly sessionService: SessionService,
    private readonly signInService: SignInService,
    private readonly tokenService: TokenService,
  ) {}

  /**
   * Changes the signed-in user's password, rotates this browser's session,
   * and signs every other session and token client out: whoever knew the old
   * password may still be signed in. A new password also invalidates the
   * reset links sent before it.
   */
  @Post('change')
  @HttpCode(200)
  async change(@CurrentUser() user: User, @Body({ schema: changePasswordSchema }) body: ChangePasswordDto) {
    await this.credentialsService.changePassword(user, body.currentPassword, body.newPassword);
    const rotated = await this.signInService.rotateSession();
    await this.sessionService.revokeAll(user.id, rotated?.session.id ? { except: rotated.session.id } : undefined);
    await this.tokenService.revokeAll(user.id);
    return { passwordChanged: true };
  }
}
