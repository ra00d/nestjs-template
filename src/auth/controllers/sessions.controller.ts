import {
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import {
  CurrentSession,
  CurrentUser,
  Public,
  SessionService,
  SignInService,
  type SessionRecord,
} from '@nestjs/authentication';
import { ApiMeta } from '../../decorators/openapi-meta.decorator';
import { sessionIdParams, sessionsResponseSchema } from '../dto/auth.schemas';

@ApiMeta({ tags: 'Auth' })
@Controller('auth')
export class SessionsController {
  constructor(
    private readonly sessionService: SessionService,
    private readonly signInService: SignInService,
  ) {}

  @ApiMeta({ res: sessionsResponseSchema })
  @Get('sessions')
  async list(
    @CurrentUser('id') userId: string,
    @CurrentSession() current: SessionRecord,
  ) {
    const sessions = await this.sessionService.list(userId);
    return sessions.map(({ id, createdAt, lastActiveAt, metadata }) => ({
      id,
      createdAt,
      lastActiveAt,
      userAgent: metadata?.userAgent ?? null,
      current: id === current.id,
    }));
  }

  // revoke() only ends a session of this user: another customer's id is a 404.
  @ApiMeta({
    param: sessionIdParams,
    res: {
      204: { description: 'The session was revoked.' },
      404: { description: 'The session was not found for this user.' },
    },
  })
  @Delete('sessions/:id')
  @HttpCode(204)
  async revoke(@CurrentUser('id') userId: string, @Param('id') id: string) {
    if (!(await this.sessionService.revoke(id, { userId }))) {
      throw new NotFoundException();
    }
  }

  // Public, so that a session still waiting for its second factor can sign
  // out too. signOut() ends the session in this browser's cookie.
  @ApiMeta({
    res: {
      204: { description: 'The session in this browser was ended.' },
      401: { description: 'The request carried no session cookie.' },
    },
  })
  @Public()
  @Post('sign-out')
  @HttpCode(204)
  async signOut() {
    if (!(await this.signInService.signOut())) {
      throw new UnauthorizedException(); // no session cookie, e.g. a bearer token
    }
  }

  @ApiMeta({
    res: {
      204: { description: 'Every session of the user was ended.' },
    },
  })
  @Post('sign-out-everywhere')
  @HttpCode(204)
  async signOutEverywhere(@CurrentUser('id') userId: string) {
    await this.signInService.signOutEverywhere(userId);
  }
}
