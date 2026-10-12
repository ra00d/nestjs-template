import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { DrizzleQueryError } from 'drizzle-orm';
import { DatabaseError } from 'pg';
import {
  buildErrorResponse,
  requestPath,
  type ErrorResponseBody,
  type FilterReply,
  type FilterRequest,
} from './error-response.js';

/** The Postgres fields worth logging; never sent to the client. */
interface PostgresDetails {
  code?: string;
  detail?: string;
  constraint?: string;
  table?: string;
  schema?: string;
}

/**
 * Maps Postgres / Drizzle failures to client-safe HTTP responses.
 *
 * Drizzle wraps driver errors in `DrizzleQueryError` (the Postgres error is
 * its `cause` chain), while pool-level failures surface as `DatabaseError`
 * directly; both are listed in `@Catch`. Constraint violations become
 * 400/409 with generic messages, serialization failures and deadlocks 503,
 * anything else 500. Raw `detail`, constraint and table names are logged,
 * never returned: they leak schema internals.
 */
@Catch(DrizzleQueryError, DatabaseError)
export class DatabaseExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DatabaseExceptionFilter.name);

  catch(exception: Error, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FilterReply>();
    const request = ctx.getRequest<FilterRequest>();
    const path = requestPath(request);

    const mapped = mapPostgresError(exception, path);
    const details = postgresDetails(exception);
    if (mapped.statusCode >= 500) {
      this.logger.error(
        `${mapped.statusCode} ${request.method} ${request.url} (pg ${details.code ?? 'unknown'}): ${JSON.stringify(details)}`,
        exception.stack,
      );
    } else {
      this.logger.warn(
        `${mapped.statusCode} ${request.method} ${request.url} (pg ${details.code ?? 'unknown'}): ${JSON.stringify(details)}`,
      );
    }

    reply.status(mapped.statusCode).send(mapped.body);
  }
}

export interface MappedPostgresError {
  statusCode: number;
  body: ErrorResponseBody;
}

/**
 * Pure mapping from a Drizzle/Postgres error (or anything with a Postgres
 * `code` in its `cause` chain) to status + body. Reused by the catch-all
 * filter so duck-typed driver errors map the same way even when
 * `instanceof` misses (e.g. a duplicated `pg` copy).
 */
export function mapPostgresError(
  exception: unknown,
  path: string,
): MappedPostgresError {
  const code = postgresCode(exception);
  switch (code) {
    case '23505':
      return {
        statusCode: HttpStatus.CONFLICT,
        body: buildErrorResponse(
          HttpStatus.CONFLICT,
          'A record with these values already exists.',
          'Conflict',
          path,
        ),
      };
    case '23503':
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        body: buildErrorResponse(
          HttpStatus.BAD_REQUEST,
          'The request references a record that does not exist.',
          'Bad Request',
          path,
        ),
      };
    case '23502':
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        body: buildErrorResponse(
          HttpStatus.BAD_REQUEST,
          'A required field is missing.',
          'Bad Request',
          path,
        ),
      };
    case '23514':
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        body: buildErrorResponse(
          HttpStatus.BAD_REQUEST,
          'A value violates a data constraint.',
          'Bad Request',
          path,
        ),
      };
    case '40001':
    case '40P01':
      return {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        body: buildErrorResponse(
          HttpStatus.SERVICE_UNAVAILABLE,
          'The request conflicted with another request. Please retry.',
          'Service Unavailable',
          path,
        ),
      };
    default:
      break;
  }
  if (code && (code.startsWith('23') || code.startsWith('22'))) {
    return {
      statusCode: HttpStatus.BAD_REQUEST,
      body: buildErrorResponse(
        HttpStatus.BAD_REQUEST,
        'The request violates a data constraint.',
        'Bad Request',
        path,
      ),
    };
  }
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

/** Whether the value carries a Postgres error code, directly or via `cause`. */
export function hasPostgresCode(exception: unknown): boolean {
  return postgresCode(exception) !== undefined;
}

/** Walks `cause` chains (Drizzle nests the driver error) for a pg `code`. */
export function postgresCode(exception: unknown): string | undefined {
  let current: unknown = exception;
  for (let depth = 0; depth < 5 && current instanceof Error; depth += 1) {
    const code = (current as Error & { code?: unknown })['code'];
    if (typeof code === 'string' && code) return code;
    current = (current as Error & { cause?: unknown })['cause'];
  }
  return undefined;
}

function postgresDetails(exception: unknown): PostgresDetails {
  let current: unknown = exception;
  for (let depth = 0; depth < 5 && current instanceof Error; depth += 1) {
    const record = current as Error &
      Record<string, unknown> & { cause?: unknown };
    if (typeof record['code'] === 'string') {
      return {
        code: record['code'],
        detail: toLogString(record['detail']),
        constraint: toLogString(record['constraint']),
        table: toLogString(record['table']),
        schema: toLogString(record['schema']),
      };
    }
    current = record.cause;
  }
  return {};
}

function toLogString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
