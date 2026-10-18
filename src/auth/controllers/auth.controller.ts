import { Body, Controller, HttpCode, Post, UnauthorizedException } from '@nestjs/common';
import { Public, SignInService } from '@nestjs/authentication';
import { I18nService } from '@nestjs/i18n';
import { Throttle, minutes } from '@nestjs/throttler';
import { signInSchema, signUpSchema, type SignInDto, type SignUpDto } from '../dto/auth.schemas';
import { CredentialsService } from '../services/credentials.service';

@Public()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly credentialsService: CredentialsService,
    private readonly signInService: SignInService,
    private readonly i18n: I18nService,
  ) {}

  @Post('sign-up')
  @HttpCode(201)
  async signUp(@Body({ schema: signUpSchema }) body: SignUpDto) {
    const user = await this.credentialsService.register(body.email, body.password);
    return user;
  }

  @Throttle({ default: { limit: 5, ttl: minutes(15) } })
  @Post('sign-in')
  @HttpCode(200)
  async signIn(@Body({ schema: signInSchema }) body: SignInDto) {
    const user = await this.credentialsService.verify(body.email, body.password);
    if (!user) {
      throw new UnauthorizedException(this.i18n.t('auth.invalidCredentials'));
    }
    const { session } = await this.signInService.signIn(user.id, { method: 'password' });
    return { mfaRequired: session.mfa === 'pending' };
  }
}
