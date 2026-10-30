import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { FilterReply, FilterRequest } from './utils';
import { normalizeHttpBody, requestPath } from './utils';

/**
 * Normalizes every `HttpException` (validation failures, 401s, 404s,
 * `ThrottlerException`, ...) into the shared error envelope.
 *
 * Nest's default body is kept where it exists (`message` as string or array
 * from validation pipes); `error`, `path` and `timestamp` are filled in so
 * clients see one shape for every 4xx/5xx the application throws on purpose.
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FilterReply>();
    const request = ctx.getRequest<FilterRequest>();

    const status = exception.getStatus();
    const body = normalizeHttpBody(exception, requestPath(request));

    if (status >= 500) {
      this.logger.error(
        `${status} ${request.method} ${request.url}: ${JSON.stringify(body.message)}`,
        exception.stack,
      );
    } else {
      this.logger.warn(
        `${status} ${request.method} ${request.url}: ${JSON.stringify(body.message)}`,
      );
    }

    reply.status(status).send(body);
  }
}
