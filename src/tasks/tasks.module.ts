import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TasksService } from './tasks.service.js';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
