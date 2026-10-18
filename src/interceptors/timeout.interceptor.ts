import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  RequestTimeoutException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { throwError, timeout, type Observable } from 'rxjs';
import type { Env } from '../config/env';

/**
 * Rejects handlers slower than `REQUEST_TIMEOUT_MS` (default 30s) with a
 * 408, so one slow dependency cannot hold connections forever. Applies
 * globally; long-lived routes (SSE, exports) should set a higher local
 * timeout instead of using this interceptor.
 */
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(private readonly config: ConfigService<Env, true>) {}

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ms: number = this.config.get('REQUEST_TIMEOUT_MS');
    return next.handle().pipe(
      timeout({
        each: ms,
        with: () => throwError(() => new RequestTimeoutException()),
      }),
    );
  }
}
