import { Controller, Get, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { readFile } from 'node:fs/promises';

@Controller('/')
export class AppController {
  @Get()
  async getFile(@Res() rep: FastifyReply) {
    const filePath = new URL('../public/js/json-viewer.js', import.meta.url);
    const contents = await readFile(filePath, { encoding: 'utf8' });
    rep.header('content-type', 'application/javascript');
    rep.send(contents);
  }
}
