import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  HttpCode,
  Post,
} from '@nestjs/common';
import {
  CurrentUser,
  EmailVerificationService,
  Public,
} from '@nestjs/authentication';
import { ApiMeta } from '../../decorators/openapi-meta.decorator';
import type { User } from '../types/user';
import {
  emailVerifiedResponseSchema,
  tokenSchema,
  type TokenDto,
} from '../dto/auth.schemas';

// The link opens a page of the web app, which POSTs the token from its URL
// back to the API: email scanners and link previews follow links with GET
// requests, and would use it up before the customer clicks.
@ApiMeta({ tags: 'Auth' })
@Controller('auth/email')
export class EmailVerificationController {
  constructor(
    private readonly emailVerificationService: EmailVerificationService,
  ) {}

  @ApiMeta({
    body: tokenSchema,
    res: {
      200: emailVerifiedResponseSchema,
      400: { description: 'The link is invalid or has expired.' },
    },
  })
  @Public()
  @Post('verify')
  @HttpCode(200)
  async verify(@Body({ schema: tokenSchema }) body: TokenDto) {
    const verified = await this.emailVerificationService.verify(body.token);
    if (!verified) {
      throw new BadRequestException('Invalid or expired link');
    }
    return { email: verified.email, emailVerified: true };
  }

  // "Send the link again", to the signed-in customer's current address.
  @ApiMeta({
    res: {
      202: { description: 'A new verification email was accepted.' },
      409: { description: 'The email address is already verified.' },
    },
  })
  @Post('verification')
  @HttpCode(202)
  async resend(@CurrentUser() user: User) {
    if (user.emailVerified) {
      throw new ConflictException('Email address already verified');
    }
    await this.emailVerificationService.send(user);
  }
}
