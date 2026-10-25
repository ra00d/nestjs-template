import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
} from '@nestjs/common';
import { PasswordResetService, Public } from '@nestjs/authentication';
import { Throttle, minutes } from '@nestjs/throttler';
import { ApiMeta } from '../../decorators/openapi-meta.decorator';
import {
  emailSchema,
  mfaRequiredResponseSchema,
  resetPasswordSchema,
  type EmailDto,
  type ResetPasswordDto,
} from '../dto/auth.schemas';

@ApiMeta({ tags: 'Auth' })
@Public()
@Controller('auth/password')
export class PasswordResetController {
  constructor(private readonly passwordResetService: PasswordResetService) {}

  // The same answer, as fast, whether or not the address has an account:
  // request() returns before it looks the address up.
  @ApiMeta({
    body: emailSchema,
    res: {
      202: { description: 'The reset request was accepted.' },
    },
  })
  @Throttle({ default: { limit: 3, ttl: minutes(15) } })
  @Post('forgot')
  @HttpCode(202)
  forgot(@Body({ schema: emailSchema }) body: EmailDto) {
    this.passwordResetService.request(body.email);
  }

  // Called by the page the link opens, with the token from its URL and the new password.
  @ApiMeta({
    body: resetPasswordSchema,
    res: {
      200: mfaRequiredResponseSchema,
      400: { description: 'The link is invalid or has expired.' },
    },
  })
  @Post('reset')
  @HttpCode(200)
  async reset(@Body({ schema: resetPasswordSchema }) body: ResetPasswordDto) {
    const result = await this.passwordResetService.reset(
      body.token,
      body.password,
      { signIn: true },
    );
    if (!result) {
      throw new BadRequestException('Invalid or expired link');
    }
    return { mfaRequired: result.signedIn?.session.mfa === 'pending' };
  }
}
