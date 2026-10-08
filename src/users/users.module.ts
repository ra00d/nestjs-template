import { Module } from '@nestjs/common';
import { MeController } from './me.controller.js';
import { UsersRepository } from './users.repository.js';

@Module({
  controllers: [MeController],
  providers: [UsersRepository],
  exports: [UsersRepository],
})
export class UsersModule {}