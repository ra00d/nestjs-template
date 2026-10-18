import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { finalize, Observable } from 'rxjs';
import { AppLogger } from './logger.service';
import { runWithRequestContext } from './request-context';

interface IdRequest {
  id?: unknown;
  method?: unknown;
  url?: unknown;
  headers?: Record<string, string | string[] | undefined>;
}

interface HeaderReply {
  header?: (name: string, value: string) => unknown;
  statusCode?: unknown;
}

/** Liveness/readiness probes skip the access line (same as before). */
const QUIET_PATHS = new Set(['/health']);

/**
 * Outermost global interceptor (registered first in `LoggerModule`):
 * assigns the correlation ID — Fastify's `request.id` (`genReqId` in
 * `main.ts` honors the client's `x-request-id`, else a UUID) — exposes it
 * to `AppLogger` via `AsyncLocalStorage`, and echoes it as the
 * `x-request-id` response header. Interceptor-based, so it covers every
 * route regardless of the global API prefix.
 */
@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  constructor(private readonly logger: AppLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<IdRequest>();
    const reply = http.getResponse<HeaderReply>();
    const header = request.headers?.['x-request-id'];
    const sent = Array.isArray(header) ? header[0] : header;
    const reqId =
      (typeof request.id === 'string' && request.id.length > 0
        ? request.id
        : undefined) ??
      (typeof sent === 'string' && sent.length > 0 ? sent : undefined) ??
      randomUUID();
    try {
      reply.header?.('x-request-id', reqId);
    } catch {
      // Replies without a `header()` method (tests, websockets): skip.
    }
    const method = typeof request.method === 'string' ? request.method : '?';
    const url =
      typeof request.url === 'string' ? request.url.split('?')[0] : '?';
    const startedAt = Date.now();
    return new Observable((subscriber) =>
      runWithRequestContext({ reqId }, () =>
        next
          .handle()
          .pipe(
            finalize(() => {
              if (QUIET_PATHS.has(url)) return;
              const ms = Date.now() - startedAt;
              const status =
                typeof reply.statusCode === 'number' ? reply.statusCode : 0;
              const line = `${method} ${url} ${status} ${ms}ms`;
              if (status >= 500) this.logger.warn(line);
              else this.logger.log(line);
            }),
          )
          .subscribe(subscriber),
      ),
    );
  }
}
