import { Body, Controller, HttpCode, Post, UnauthorizedException } from '@nestjs/common';
import { Public, TokenService } from '@nestjs/authentication';
import { Throttle, minutes } from '@nestjs/throttler';
import { refreshTokenSchema, signInSchema, type RefreshTokenDto, type SignInDto } from './auth.schemas.js';
import { CredentialsService } from './credentials.service.js';

@Public()
@Controller('auth/token')
export class TokensController {
  constructor(
    private readonly credentialsService: CredentialsService,
    private readonly tokenService: TokenService,
  ) {}

  @Throttle({ default: { limit: 5, ttl: minutes(15) } })
  @Post()
  @HttpCode(200)
  async issue(@Body({ schema: signInSchema }) body: SignInDto) {
    const user = await this.credentialsService.verify(body.email, body.password);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.tokenService.issue(user.id, {
      method: 'password',
      // `amr` goes into this access token and into every refreshed one.
      claims: { amr: ['pwd'] },
    });
  }

  // An unknown, expired or reused refresh token gets a 401.
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body({ schema: refreshTokenSchema }) body: RefreshTokenDto) {
    return this.tokenService.refresh(body.refreshToken);
  }

  // Signs the client out on this device. Unknown tokens get the same answer, as in RFC 7009.
  @Post('revoke')
  @HttpCode(204)
  async revoke(@Body({ schema: refreshTokenSchema }) body: RefreshTokenDto) {
    await this.tokenService.revoke(body.refreshToken);
  }
}