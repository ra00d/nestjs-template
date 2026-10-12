import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import type { User } from '../types/user.js';

@Controller('me')
export class MeController {
  @Get()
  me(@CurrentUser() user: User): User {
    return user;
  }
}

