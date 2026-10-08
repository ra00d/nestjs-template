import { Body, Controller, HttpCode, Post, UnauthorizedException } from '@nestjs/common';
import { Public, SignInService } from '@nestjs/authentication';
import { Throttle, minutes } from '@nestjs/throttler';
import { signInSchema, signUpSchema, type SignInDto, type SignUpDto } from './auth.schemas.js';
import { CredentialsService } from './credentials.service.js';

@Public()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly credentialsService: CredentialsService,
    private readonly signInService: SignInService,
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
      throw new UnauthorizedException('Invalid email or password');
    }
    const { session } = await this.signInService.signIn(user.id, { method: 'password' });
    return { mfaRequired: session.mfa === 'pending' };
  }
}