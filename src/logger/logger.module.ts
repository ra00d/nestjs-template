import { DynamicModule, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LOGGER_OPTIONS, type CustomLoggerOptions } from './logger.options.js';
import { AppLogger } from './logger.service.js';
import { RequestIdInterceptor } from './request-id.interceptor.js';

/**
 * Application logging. Global: `AppLogger` (used by `app.useLogger()`, so
 * `new Logger()` anywhere lands here) plus the outermost
 * `RequestIdInterceptor`, which assigns the correlation ID, echoes it, logs
 * one access line per request, and makes the ID visible to `AppLogger`.
 *
 * `forRoot({ sensitiveFields: [...] })` replaces the default strip list,
 * `{ redact: false }` turns stripping off, `{ level }` overrides
 * `LOG_LEVEL`. Pino integration later: swap `AppLogger`'s transport for a
 * pino instance — the interface, levels and options stay the same.
 */
@Module({})
export class LoggerModule {
  static forRoot(options: CustomLoggerOptions = {}): DynamicModule {
    return {
      module: LoggerModule,
      providers: [
        { provide: LOGGER_OPTIONS, useValue: options },
        AppLogger,
        { provide: APP_INTERCEPTOR, useClass: RequestIdInterceptor },
      ],
      exports: [AppLogger, LOGGER_OPTIONS],
      global: true,
    };
  }
}
