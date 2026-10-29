import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

/**
 * The request correlation ID. Fastify's `genReqId` (see `main.ts`) assigns
 * `request.id` from the incoming `x-request-id` header, or generates one;
 * the `RequestIdInterceptor` makes the same value visible to `AppLogger`.
 * This decorator exposes it to handlers for log correlation and upstream
 * propagation. Falls back to a fresh UUID outside HTTP requests (jobs,
 * tests without a request).
 */
export const RequestId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context
      .switchToHttp()
      .getRequest<{ id?: unknown; headers?: Record<string, unknown> } | undefined>();
    if (typeof request?.id === 'string' && request.id.length > 0) {
      return request.id;
    }
    const header = request?.headers?.['x-request-id'];
    if (typeof header === 'string' && header.length > 0) return header;
    return randomUUID();
  },
);
