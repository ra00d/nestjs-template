import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { z } from 'zod';

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface PaginationOptions {
  defaultPage?: number;
  defaultLimit?: number;
  maxLimit?: number;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const DEFAULT_MAX_LIMIT = 100;

const paginationSchema = (options: PaginationOptions) =>
  z.object({
    page: z.coerce
      .number()
      .int()
      .positive()
      .catch(options.defaultPage ?? DEFAULT_PAGE),
    limit: z.coerce
      .number()
      .int()
      .positive()
      .max(options.maxLimit ?? DEFAULT_MAX_LIMIT)
      .catch(options.defaultLimit ?? DEFAULT_LIMIT),
  });

export const Pagination = createParamDecorator<
  PaginationOptions,
  PaginationParams
>((options: PaginationOptions | undefined, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<{ query?: unknown }>();
  const { page, limit } = paginationSchema(options ?? {}).parse(
    request.query ?? {},
  );

  return { page, limit, offset: (page - 1) * limit };
});
