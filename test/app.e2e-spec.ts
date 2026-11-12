import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module';
import { NodeAdapter } from '@nestjs/platform-node';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let base: string;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication(new NodeAdapter());
    // `listen()` calls `fastify.ready()` — without it the route contexts lack
    // their hook lists and requests crash in fastify's preParsing runner.
    await app.listen(0);
    const server = app.getHttpServer() as any;
    const address = server.address() as { port: number };
    base = `http://127.0.0.1:${address.port}`;
  });

  it('/ (GET)', () => {
    return request(base).get('/').expect(200).expect('Hello World!');
  });

  afterEach(async () => {
    await app.close();
  });
});
