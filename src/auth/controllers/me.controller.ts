import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import type { User } from '../types/user.js';
import { Authorize } from '../decorators/rbac.decorator.js';
import { AuthzGuard } from '../guards/authorization.guard.js';

@Controller('me')
@UseGuards(AuthzGuard)
export class MeController {
  @Authorize({
    anyPermission: ['admin'],
    anyRole: ['user'],
  })
  @Get()
  me(@CurrentUser() user: User): User {
    return user;
  }
}
