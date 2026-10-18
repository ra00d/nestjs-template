import { CurrentUser } from '@nestjs/authentication';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthzGuard } from '../guards/authorization.guard';
import type { User } from '../types/user';

@Controller('me')
@UseGuards(AuthzGuard)
export class MeController {
  @Get()
  me(@CurrentUser() user: User): User {
    return user;
  }
}
