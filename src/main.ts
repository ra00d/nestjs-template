import secureSession from '@fastify/secure-session';
import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { createSchema } from 'zod-openapi';
import { AppModule } from './app.module.js';
import { trustedOrigins, type Env } from './config/env.js';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      multipart: { limits: { fileSize: 10 * 1024 * 1024, files: 5 } },
    }),
  );
  const config = app.get(ConfigService<Env, true>);
  const sessionSecret: string = config.get('SESSION_SECRET');
  const sessionSalt: string = config.get('SESSION_SALT');

  app.enableShutdownHooks();

  // All versioned API routes live under `/api/v1/...`; the root probe (`/`)
  // and Swagger (`/docs`) stay outside the prefix.
  const apiPrefix: string = config.get('API_PREFIX');
  app.setGlobalPrefix(apiPrefix, { exclude: ['/', 'docs', 'docs/(.*)'] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // Refuses cross-origin writes from pages other than the application's own
  // and `TRUSTED_ORIGINS` (the same list the `session` options use).
  app.enableCsrfProtection({
    trustedOrigins: trustedOrigins(config.get('TRUSTED_ORIGINS')),
  });
  await app.register(secureSession, {
    secret: sessionSecret,
    salt: sessionSalt,
  });

  const oaiConfig = new DocumentBuilder()
    .setTitle('API')
    .setDescription('Application API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const documentFactory = () =>
    SwaggerModule.createDocument(app, oaiConfig, {
      standardSchemaConverter: (schema, { schemaType }) => {
        const converted = createSchema(schema as never, {
          io: schemaType,
          openapiVersion: '3.0.0',
        });
        return { schema: converted.schema, components: converted.components };
      },
    });
  SwaggerModule.setup('docs', app, documentFactory, {
    explorer: true,
  });
  const port: number = config.get('PORT');
  await app.listen({ port, host: '0.0.0.0' });
}
await bootstrap();
