import multipart from '@fastify/multipart';
import secureSession from '@fastify/secure-session';
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
    new FastifyAdapter(),
  );
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });
  const config = app.get(ConfigService<Env, true>);

  // Refuses cross-origin writes from pages other than the application's own
  // and `TRUSTED_ORIGINS` (the same list the `session` options use).
  app.enableCsrfProtection({
    trustedOrigins: trustedOrigins(config.get('TRUSTED_ORIGINS')),
  });
  await app.register(secureSession, {
    secret: 'averylogphrasebiggerthanthirtytwochars',
    salt: 'mq9hDxBVDbspDR6n',
  });

  const oaiConfig = new DocumentBuilder()
    .setTitle('Cats example')
    .setDescription('The cats API description')
    .setVersion('1.0')
    .addTag('cats')
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
  SwaggerModule.setup('api', app, documentFactory, {
    explorer: true,
  });
  await app.listen(config.get('PORT'));
}
await bootstrap();
