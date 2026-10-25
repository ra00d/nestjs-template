import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
} from '@nestjs/common';
import { MagicLinkService, Public } from '@nestjs/authentication';
import { Throttle, minutes } from '@nestjs/throttler';
import { ApiMeta } from '../../decorators/openapi-meta.decorator';
import {
  emailSchema,
  mfaRequiredResponseSchema,
  tokenSchema,
  type EmailDto,
  type TokenDto,
} from '../dto/auth.schemas';

// The link opens a page of the web app, which POSTs the token from its URL
// back to the API: email scanners and link previews follow links with GET
// requests, and would use it up before the customer clicks.
@ApiMeta({ tags: 'Auth' })
@Public()
@Controller('auth/magic-link')
export class MagicLinkController {
  constructor(private readonly magicLinkService: MagicLinkService) {}

  // The same answer whether or not the address has an account: create() returns
  // before it looks the address up, and sends nothing for an address no mail
  // should go to. It also sets the cookie that binds the link to this browser,
  // so the page that asks for a link must be the page that opens it.
  @ApiMeta({
    body: emailSchema,
    res: {
      202: { description: 'The sign-in link request was accepted.' },
    },
  })
  @Throttle({ default: { limit: 3, ttl: minutes(15) } })
  @Post('request')
  @HttpCode(202)
  async request(@Body({ schema: emailSchema }) body: EmailDto) {
    await this.magicLinkService.create(body.email);
  }

  // Called by the page the link opens. Signs the customer in on this browser,
  // setting the session cookie. A link from another browser raises the
  // package's own 401, which tells the customer where to open it.
  @ApiMeta({
    body: tokenSchema,
    res: {
      200: mfaRequiredResponseSchema,
      400: { description: 'The link is invalid or has expired.' },
      401: { description: 'The link belongs to another browser.' },
    },
  })
  @Post('verify')
  @HttpCode(200)
  async verify(@Body({ schema: tokenSchema }) body: TokenDto) {
    const issued = await this.magicLinkService.consume(body.token);
    if (!issued) {
      throw new BadRequestException('Invalid or expired link');
    }
    return { mfaRequired: issued.session.mfa === 'pending' };
  }
}
