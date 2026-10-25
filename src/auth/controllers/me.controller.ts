import { CurrentUser } from '@nestjs/authentication';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiMeta } from '../../decorators/openapi-meta.decorator';
import { userResponseSchema } from '../dto/auth.schemas';
import { AuthzGuard } from '../guards/authorization.guard';
import type { User } from '../types/user';

@ApiMeta({ tags: 'Auth' })
@Controller('me')
@UseGuards(AuthzGuard)
export class MeController {
  @ApiMeta({ res: userResponseSchema })
  @Get()
  me(@CurrentUser() user: User): User {
    return user;
  }
}
