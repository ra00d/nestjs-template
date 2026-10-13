import helmet from '@fastify/helmet';
import secureSession from '@fastify/secure-session';
import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { Logger } from 'nestjs-pino';
import { createSchema } from 'zod-openapi';
import { AppModule } from './app.module.js';
import { trustedOrigins, type Env } from './config/env.js';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      // Correlation ID at the server layer so every log (including
      // early-boot rejections) carries it: honor the client's
      // `x-request-id`, generate a UUID when missing.
      genReqId: (req: {
        headers?: Record<string, string | string[] | undefined>;
      }) => {
        const header = req.headers?.['x-request-id'];
        const sent = Array.isArray(header) ? header[0] : header;
        return sent && sent.length > 0 ? sent : randomUUID();
      },
      multipart: { limits: { fileSize: 10 * 1024 * 1024, files: 5 } },
    }),
    { bufferLogs: true },
  );
  const config = app.get(ConfigService<Env, true>);
  const sessionSecret: string = config.get('SESSION_SECRET');
  const sessionSalt: string = config.get('SESSION_SALT');

  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  // Echo the correlation ID (`x-request-id`, generated when missing) so
  // clients can match responses to logs. `pino-http` owns `request.id`;
  // this only copies it onto the wire (already in CORS `exposedHeaders`).
  // Structural types keep this free of a direct `fastify` dependency.
  app
    .getHttpAdapter()
    .getInstance()
    .addHook(
      'onSend',
      async (
        request: { id?: unknown },
        reply: { header: (name: string, value: string) => unknown },
      ) => {
        const id = request.id;
        if (typeof id === 'string' && id.length > 0) {
          reply.header('x-request-id', id);
        }
      },
    );

  // Security headers (CSP off: Swagger UI needs inline scripts).
  await app.register(helmet, { contentSecurityPolicy: false });

  // Browsers may call the API only from the app itself and TRUSTED_ORIGINS.
  const appUrl = new URL(config.get('APP_URL'));
  app.enableCors({
    origin: [appUrl.origin, ...trustedOrigins(config.get('TRUSTED_ORIGINS'))],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id', 'x-lang'],
    exposedHeaders: ['x-request-id'],
    maxAge: 600,
  });

  // All versioned API routes live under `/api/v1/...`; the root probe (`/`),
  // the readiness probe (`/health`) and Swagger (`/docs`) stay outside.
  const apiPrefix: string = config.get('API_PREFIX');
  app.setGlobalPrefix(apiPrefix, {
    exclude: ['/', 'health', 'docs', 'docs/{*path}'],
  });
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
