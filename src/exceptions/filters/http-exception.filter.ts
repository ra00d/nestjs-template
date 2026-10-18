import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { FilterReply, FilterRequest } from './error-response';
import {
  buildErrorResponse,
  reasonPhrase,
  requestPath,
  type ErrorResponseBody,
} from './error-response';

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

/** The same normalization the filter applies, reused by the catch-all filter. */
export function normalizeHttpBody(
  exception: HttpException,
  path: string,
): ErrorResponseBody {
  const status = exception.getStatus();
  const response = exception.getResponse();
  if (typeof response === 'string') {
    return buildErrorResponse(status, response, reasonPhrase(status), path);
  }
  const body = response as Record<string, unknown>;
  const message = body['message'];
  const error = body['error'];
  return buildErrorResponse(
    status,
    typeof message === 'string' || Array.isArray(message)
      ? (message as string | string[])
      : reasonPhrase(status),
    typeof error === 'string' ? error : reasonPhrase(status),
    path,
  );
}
