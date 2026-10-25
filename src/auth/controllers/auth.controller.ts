import {
  Body,
  Controller,
  HttpCode,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { Public, SignInService } from '@nestjs/authentication';
import { I18nService } from '@nestjs/i18n';
import { Throttle, minutes } from '@nestjs/throttler';
import { ApiMeta } from '../../decorators/openapi-meta.decorator';
import {
  mfaRequiredResponseSchema,
  signInSchema,
  signUpSchema,
  userResponseSchema,
  type SignInDto,
  type SignUpDto,
} from '../dto/auth.schemas';
import { CredentialsService } from '../services/credentials.service';

@ApiMeta({ tags: 'Auth' })
@Public()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly credentialsService: CredentialsService,
    private readonly signInService: SignInService,
    private readonly i18n: I18nService,
  ) {}

  @ApiMeta({
    body: signUpSchema,
    res: { 201: userResponseSchema },
  })
  @Post('sign-up')
  @HttpCode(201)
  async signUp(@Body({ schema: signUpSchema }) body: SignUpDto) {
    const user = await this.credentialsService.register(
      body.email,
      body.password,
    );
    return user;
  }

  @ApiMeta({
    body: signInSchema,
    res: {
      200: mfaRequiredResponseSchema,
      401: { description: 'Invalid email or password.' },
    },
  })
  @Throttle({ default: { limit: 5, ttl: minutes(15) } })
  @Post('sign-in')
  @HttpCode(200)
  async signIn(@Body({ schema: signInSchema }) body: SignInDto) {
    const user = await this.credentialsService.verify(
      body.email,
      body.password,
    );
    if (!user) {
      throw new UnauthorizedException(this.i18n.t('auth.invalidCredentials'));
    }
    const { session } = await this.signInService.signIn(user.id, {
      method: 'password',
    });
    return { mfaRequired: session.mfa === 'pending' };
  }
}
