import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  isAuthError,
  mapAuthError,
} from './authentication-exception.filter.js';
import {
  hasPostgresCode,
  mapPostgresError,
} from './database-exception.filter.js';
import {
  buildErrorResponse,
  requestPath,
  type FilterReply,
  type FilterRequest,
} from './error-response.js';
import { normalizeHttpBody } from './http-exception.filter.js';

/**
 * Last-resort filter: anything no specific filter claimed becomes a 500
 * with no internals, except outside production, where the message is
 * included to speed up local debugging.
 *
 * Must stay registered after every other `APP_FILTER`: Nest runs the first
 * filter whose `@Catch` metatypes match, and `@Catch()` with no arguments
 * matches everything. The branches below only exist so a misordered
 * registration still answers sensibly instead of masking a 4xx as a 500.
 */
@Catch()
export class CatchAllExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(CatchAllExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FilterReply>();
    const request = ctx.getRequest<FilterRequest>();
    const path = requestPath(request);

    if (exception instanceof HttpException) {
      reply
        .status(exception.getStatus())
        .send(normalizeHttpBody(exception, path));
      return;
    }
    if (exception instanceof Error && isAuthError(exception)) {
      const mapped = mapAuthError(exception, path);
      reply.status(mapped.statusCode).send(mapped.body);
      return;
    }
    if (hasPostgresCode(exception)) {
      const mapped = mapPostgresError(exception, path);
      reply.status(mapped.statusCode).send(mapped.body);
      return;
    }

    const message =
      exception instanceof Error ? exception.message : 'Unknown error';
    const stack = exception instanceof Error ? exception.stack : undefined;
    this.logger.error(`${request.method} ${request.url}: ${message}`, stack);

    const body = buildErrorResponse(
      HttpStatus.INTERNAL_SERVER_ERROR,
      process.env['NODE_ENV'] === 'production'
        ? 'Internal server error'
        : message || 'Internal server error',
      'Internal Server Error',
      path,
    );
    reply.status(HttpStatus.INTERNAL_SERVER_ERROR).send(body);
  }
}
