// import session from 'express-session';
import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestNodeApplication, NodeAdapter } from '@nestjs/platform-node';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { ZodObject } from 'zod';
import { createSchema } from 'zod-openapi';
import { AppModule } from './app.module';
import { AppLogger, DEFAULT_PARAMETERS } from './common';
import { runWithRequestContext } from './common/logger/request-context';
import { trustedOrigins, type Env } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create<NestNodeApplication>(
    AppModule,
    new NodeAdapter({
      // Correlation ID at the server layer so every log (including
      // early-boot rejections) carries it: honor the client's
      // `x-request-id`, generate a UUID when missing.
      // genReqId: (req: {
      //   headers?: Record<string, string | string[] | undefined>;
      // }) => {
      //   const header = req.headers?.['x-request-id'];
      //   const sent = Array.isArray(header) ? header[0] : header;
      //   return sent && sent.length > 0 ? sent : randomUUID();
      // },
      // multipart: { limits: { fileSize: 10 * 1024 * 1024, files: 5 } },
    }),
    { bufferLogs: true, snapshot: true },
  );
  const config = app.get(ConfigService<Env, true>);
  const sessionSecret: string = config.get('SESSION_SECRET');
  const sessionSalt: string = config.get('SESSION_SALT');

  app.useSecurityHeaders({
    contentSecurityPolicy: false,
  });
  app.useLogger(app.get(AppLogger));
  app.enableShutdownHooks();

  app.use(
    (
      request: {
        id?: unknown;
        headers?: Record<string, string | string[] | undefined>;
      },
      response: { header?: (name: string, value: string) => unknown },
      next: () => void,
    ) => {
      const header = request.headers?.['x-request-id'];
      const sent = Array.isArray(header) ? header[0] : header;
      const reqId =
        (typeof request.id === 'string' && request.id.length > 0
          ? request.id
          : undefined) ??
        (typeof sent === 'string' && sent.length > 0 ? sent : undefined) ??
        randomUUID();
      try {
        response.header?.('x-request-id', reqId);
      } catch {
        // Never fail a request for a correlation header.
      }
      runWithRequestContext({ reqId }, next);
    },
  );

  // Security headers (CSP off: Swagger UI needs inline scripts).
  // await app.use(helmet({ contentSecurityPolicy: false }));

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
  // app.use(
  //   session({
  //     secret: sessionSecret,
  //     resave: false,
  //     saveUninitialized: false,
  //   }),
  // );

  const oaiConfig = new DocumentBuilder()
    .setTitle('API')
    .setDescription('Application API')
    .setOpenAPIVersion('3.1.0')
    .setVersion('1.0')
    .addBearerAuth()
    .addGlobalParameters(...DEFAULT_PARAMETERS)
    .build();

  const documentFactory = () =>
    SwaggerModule.createDocument(app, oaiConfig, {
      deepScanRoutes: true,

      autoTagControllers: true,
      standardSchemaConverter: (schema, { schemaType }) => {
        let id = '';
        const converted = createSchema(schema as never, {
          io: schemaType,
          openapiVersion: '3.1.0',
        });
        if (schema instanceof ZodObject) {
          id = schema.meta()?.id || '';
        }
        return {
          schema: converted.components[id] || converted.schema,
          components: converted.components,
        };
      },
    });
  SwaggerModule.setup('docs', app, documentFactory, {
    explorer: true,
    swaggerOptions: {},
    customJs: '/v1',
    customJsStr: `
    `,
  });
  const port: number = config.get('PORT', 3000);
  await app.listen(port, () => {
    app.get(AppLogger).log(`running on `, 'bootstrap');
  });
}
await bootstrap();
