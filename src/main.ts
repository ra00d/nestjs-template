import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';
import { trustedOrigins, type Env } from './config/env.js';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  const config = app.get(ConfigService<Env, true>);

  // Refuses cross-origin writes from pages other than the application's own
  // and `TRUSTED_ORIGINS` (the same list the `session` options use).
  app.enableCsrfProtection({ trustedOrigins: trustedOrigins(config.get('TRUSTED_ORIGINS')) });

  await app.listen(config.get('PORT'));
}
await bootstrap();