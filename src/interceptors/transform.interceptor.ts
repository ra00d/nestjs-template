import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { map, type Observable } from 'rxjs';

export interface Envelope<T = unknown> {
  data: T;
  meta?: unknown;
}

/**
 * Wraps handler results as `{ data }` so every JSON response shares one
 * envelope. Passes through results that already carry `{ data, meta }`
 * (the paginated list shape), streams, files, strings and `undefined`
 * (e.g. 204 responses) untouched.
 */
@Injectable()
export class TransformInterceptor<T = unknown> implements NestInterceptor<T, Envelope<T> | T> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<Envelope<T> | T> {
    return next.handle().pipe(
      map((body: T): Envelope<T> | T => {
        if (body === undefined || body === null) return body;
        if (body instanceof StreamableFile) return body;
        if (typeof body === 'string' || Buffer.isBuffer(body)) return body;
        if (typeof body === 'object' && 'data' in body && 'meta' in body) {
          return body;
        }
        return { data: body };
      }),
    );
  }
}
