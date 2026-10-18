import { AuthenticationError } from '@nestjs/authentication';
import { AuthorizationError } from '@nestjs/authorization';
import {
  ArgumentsHost,
  BadRequestException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { DrizzleQueryError } from 'drizzle-orm';
import { DatabaseError } from 'pg';
import { AuthenticationExceptionFilter } from './authentication-exception.filter';
import { CatchAllExceptionFilter } from './catch-all-exception.filter';
import { DatabaseExceptionFilter } from './database-exception.filter';
import { HttpExceptionFilter } from './http-exception.filter';

function mockHost() {
  const sent: { status?: number; body?: unknown } = {};
  const headers: Record<string, string> = {};
  const reply = {
    status: (code: number) => {
      sent.status = code;
      return reply;
    },
    send: (body: unknown) => {
      sent.body = body;
      return reply;
    },
    header: (name: string, value: string) => {
      headers[name] = value;
      return reply;
    },
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => reply,
      getRequest: () => ({ method: 'GET', url: '/test' }),
    }),
  } as unknown as ArgumentsHost;
  return { host, sent, headers };
}

function pgError(code: string): DatabaseError {
  const error = new DatabaseError('duplicate key', 0, 'error');
  (error as unknown as Record<string, unknown>)['code'] = code;
  (error as unknown as Record<string, unknown>)['detail'] =
    'Key (email)=(a@b.c) already exists.';
  return error;
}

describe('HttpExceptionFilter', () => {
  it('normalizes a string-body exception into the shared envelope', () => {
    const { host, sent } = mockHost();
    new HttpExceptionFilter().catch(new NotFoundException('Missing'), host);
    expect(sent.status).toBe(HttpStatus.NOT_FOUND);
    expect(sent.body).toMatchObject({
      statusCode: 404,
      message: 'Missing',
      error: 'Not Found',
      path: '/test',
    });
  });

  it('preserves validation message arrays', () => {
    const { host, sent } = mockHost();
    const exception = new BadRequestException([
      'email is required',
      'password is too short',
    ]);
    new HttpExceptionFilter().catch(exception, host);
    expect(sent.body).toMatchObject({
      statusCode: 400,
      message: ['email is required', 'password is too short'],
    });
  });
});

describe('AuthenticationExceptionFilter', () => {
  it('maps AuthenticationError to its status and sets the challenge header', () => {
    const { host, sent, headers } = mockHost();
    new AuthenticationExceptionFilter().catch(
      new AuthenticationError('Bad credentials', {
        challenge: 'Bearer realm="api"',
      }),
      host,
    );
    expect(sent.status).toBe(HttpStatus.UNAUTHORIZED);
    expect(sent.body).toMatchObject({
      statusCode: 401,
      message: 'Bad credentials',
    });
    expect(headers['WWW-Authenticate']).toBe('Bearer realm="api"');
  });

  it('maps AuthorizationError denials without leaking policy details', () => {
    const { host, sent } = mockHost();
    new AuthenticationExceptionFilter().catch(
      new AuthorizationError('forbidden', 'OrderPolicy', 'refund'),
      host,
    );
    expect(sent.status).toBe(HttpStatus.FORBIDDEN);
    expect(sent.body).toMatchObject({ statusCode: 403, message: 'Forbidden' });
  });
});

describe('DatabaseExceptionFilter', () => {
  it('maps unique violations wrapped by Drizzle to 409 without db details', () => {
    const { host, sent } = mockHost();
    new DatabaseExceptionFilter().catch(
      new DrizzleQueryError('insert', [1], pgError('23505')),
      host,
    );
    expect(sent.status).toBe(HttpStatus.CONFLICT);
    expect(sent.body).toMatchObject({ statusCode: 409, error: 'Conflict' });
    expect(JSON.stringify(sent.body)).not.toContain('a@b.c');
  });

  it('maps deadlocks to 503', () => {
    const { host, sent } = mockHost();
    new DatabaseExceptionFilter().catch(pgError('40P01'), host);
    expect(sent.status).toBe(HttpStatus.SERVICE_UNAVAILABLE);
  });

  it('maps unknown driver errors to a generic 500', () => {
    const { host, sent } = mockHost();
    new DatabaseExceptionFilter().catch(pgError('XX000'), host);
    expect(sent.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(sent.body).toMatchObject({ message: 'Internal server error' });
  });
});

describe('CatchAllExceptionFilter', () => {
  it('hides unknown error internals in production', () => {
    const previous = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';
    try {
      const { host, sent } = mockHost();
      new CatchAllExceptionFilter().catch(
        new Error('s3cr3t connection string'),
        host,
      );
      expect(sent.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(sent.body).toMatchObject({ message: 'Internal server error' });
    } finally {
      process.env['NODE_ENV'] = previous;
    }
  });

  it('still maps HttpExceptions instead of masking them as 500', () => {
    const { host, sent } = mockHost();
    new CatchAllExceptionFilter().catch(new NotFoundException('Gone'), host);
    expect(sent.status).toBe(HttpStatus.NOT_FOUND);
  });
});
