import { Public } from '@nestjs/authentication';
import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import z from 'zod';
import { AppService } from './app.service';
import { ApiMeta } from './decorators/openapi-response.decorator';

const greet = z.object({
  msg: z.string().min(5),
});

type Greet = z.infer<typeof greet>;

@Controller({ version: VERSION_NEUTRAL })
export class AppController {
  constructor(private readonly appService: AppService) {}

  @ApiMeta({
    res: greet,
  })
  @Public()
  @Get()
  getHello(): Greet {
    return { msg: this.appService.getHello() };
  }
}
