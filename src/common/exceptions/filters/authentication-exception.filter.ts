import { AuthenticationError } from '@nestjs/authentication';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  buildErrorResponse,
  requestPath,
  type ErrorResponseBody,
  type FilterReply,
  type FilterRequest,
} from './error-response';
import { AuthorizationError } from '../authorization.exception';

/**
 * Translates the transport-agnostic errors of `@nestjs/authentication` and
 * `@nestjs/authorization` into HTTP responses.
 *
 * Both packages document that an error escaping a route becomes "the
 * transport's own error", but without a filter the client gets Nest's
 * fallback 500 page. This filter answers what the packages promise:
 * 401/403/409 with the shared envelope, plus the `WWW-Authenticate`
 * challenge when the provider supplies one.
 *
 * `OidcError` and `SecretDecryptionError` are not exported from the
 * authentication package root, so they are matched by shape (`name`/`kind`)
 * instead of `instanceof`: `request` -> 400, `verification` -> 401,
 * `unavailable` -> 502, decryption failures -> 500 without details.
 */
@Catch(AuthenticationError, AuthorizationError)
export class AuthenticationExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AuthenticationExceptionFilter.name);

  catch(exception: Error, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FilterReply>();
    const request = ctx.getRequest<FilterRequest>();
    const path = requestPath(request);

    const mapped = mapAuthError(exception, path);
    if (mapped.statusCode >= 500) {
      this.logger.error(
        `${mapped.statusCode} ${request.method} ${request.url} (${exception.name})`,
        exception.stack,
      );
    } else {
      this.logger.warn(
        `${mapped.statusCode} ${request.method} ${request.url} (${exception.name})`,
      );
    }

    if (exception instanceof AuthenticationError && exception.challenge) {
      reply.header?.('WWW-Authenticate', exception.challenge);
    }
    reply.status(mapped.statusCode).send(mapped.body);
  }
}

export interface MappedAuthError {
  statusCode: number;
  body: ErrorResponseBody;
}

/**
 * Pure mapping, reused by the catch-all filter for auth-shaped errors that
 * reach it (e.g. `OidcError`, which cannot be listed in `@Catch` because the
 * package does not export the class from its root).
 */
export function mapAuthError(exception: Error, path: string): MappedAuthError {
  if (exception instanceof AuthenticationError) {
    const status = exception.status;
    return {
      statusCode: status,
      body: buildErrorResponse(
        status,
        exception.message || statusText(status),
        statusText(status),
        path,
      ),
    };
  }
  if (exception instanceof AuthorizationError) {
    // The message is already the generic `Unauthorized`/`Forbidden`.
    return {
      statusCode: exception.status,
      body: buildErrorResponse(
        exception.status,
        exception.message,
        statusText(exception.status),
        path,
      ),
    };
  }
  const shaped = exception as Error & { kind?: unknown };
  if (exception.name === 'OidcError' && typeof shaped.kind === 'string') {
    const status =
      shaped.kind === 'request'
        ? HttpStatus.BAD_REQUEST
        : shaped.kind === 'unavailable'
          ? HttpStatus.BAD_GATEWAY
          : HttpStatus.UNAUTHORIZED;
    return {
      statusCode: status,
      body: buildErrorResponse(
        status,
        exception.message || statusText(status),
        statusText(status),
        path,
      ),
    };
  }
  // A key or secret that cannot be decrypted is a server misconfiguration:
  // never echo the message, which may name the key or algorithm.
  return {
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    body: buildErrorResponse(
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Internal server error',
      'Internal Server Error',
      path,
    ),
  };
}

/** Whether the error looks like one this filter (or its mapping) handles. */
export function isAuthError(exception: unknown): exception is Error {
  if (
    exception instanceof AuthenticationError ||
    exception instanceof AuthorizationError
  )
    return true;
  if (
    exception instanceof Error &&
    (exception.name === 'OidcError' ||
      exception.name === 'SecretDecryptionError')
  ) {
    return true;
  }
  return false;
}

function statusText(status: number): string {
  switch (status) {
    case HttpStatus.UNAUTHORIZED:
      return 'Unauthorized';
    case HttpStatus.FORBIDDEN:
      return 'Forbidden';
    case HttpStatus.CONFLICT:
      return 'Conflict';
    default:
      return 'Error';
  }
}
