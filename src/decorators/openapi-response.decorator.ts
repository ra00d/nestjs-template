import { applyDecorators } from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiHeader,
  ApiHeaders,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
  type ApiResponseOptions,
  type StandardSchemaObject,
} from '@nestjs/swagger';

export interface ApiMeta {
  res?:
    | StandardSchemaObject
    | ApiResponseOptions
    | Record<number, ApiResponseOptions | StandardSchemaObject>;
  tags?: string | string[];
  q?: StandardSchemaObject;
  body?: StandardSchemaObject;
  param?: StandardSchemaObject | Record<string, unknown>;
  headers?: unknown;
  consumes?: unknown;
}

export type ApiMetaOptions = ApiMeta;

function isStandardSchema(value: unknown): value is StandardSchemaObject {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.prototype.hasOwnProperty.call(value, '~standard')
  );
}

function isResponseRecord(
  value: unknown,
): value is Record<number, ApiResponseOptions | StandardSchemaObject> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !isStandardSchema(value) &&
    Object.keys(value).length > 0 &&
    Object.keys(value).every(
      (key) =>
        /^\d+$/.test(key) &&
        typeof (value as Record<string, unknown>)[key] === 'object',
    )
  );
}

function toHeaderList(headers: unknown): Record<string, unknown>[] {
  if (Array.isArray(headers)) {
    return headers.filter(
      (header): header is Record<string, unknown> =>
        typeof header === 'object' && header !== null,
    );
  }

  if (typeof headers === 'object' && headers !== null) {
    return [headers as Record<string, unknown>];
  }

  return [];
}

export const ApiMeta = (
  options: ApiMeta = {},
): MethodDecorator & ClassDecorator => {
  const decorators: Array<MethodDecorator | ClassDecorator> = [];

  if (options.tags !== undefined) {
    const tags = Array.isArray(options.tags) ? options.tags : [options.tags];
    decorators.push(ApiTags(...(tags as string[])));
  }

  if (options.q !== undefined) {
    decorators.push(ApiQuery({ standardSchema: options.q } as never));
  }

  if (options.body !== undefined) {
    decorators.push(ApiBody({ standardSchema: options.body } as never));
  }

  if (options.param !== undefined) {
    const param =
      typeof options.param === 'object' &&
      options.param !== null &&
      ('name' in options.param || 'standardSchema' in options.param)
        ? options.param
        : { standardSchema: options.param };

    decorators.push(ApiParam(param as never));
  }

  if (options.headers !== undefined) {
    const headers = toHeaderList(options.headers);
    if (headers.length === 1) {
      decorators.push(ApiHeader(headers[0] as never));
    } else if (headers.length > 1) {
      decorators.push(ApiHeaders(headers as never));
    }
  }

  if (options.consumes !== undefined) {
    const consumes = Array.isArray(options.consumes)
      ? options.consumes
      : typeof options.consumes === 'string'
        ? [options.consumes]
        : Array.from(options.consumes as Iterable<unknown>);

    decorators.push(ApiConsumes(...(consumes as string[])));
  }

  if (options.res !== undefined) {
    if (isStandardSchema(options.res)) {
      decorators.push(
        ApiResponse({ status: 200, standardSchema: options.res } as never),
      );
    } else if (isResponseRecord(options.res)) {
      for (const [status, response] of Object.entries(options.res)) {
        if (isStandardSchema(response)) {
          decorators.push(
            ApiResponse({
              status: Number(status),
              standardSchema: response,
            } as never),
          );
        } else {
          const recordResponse = response as ApiResponseOptions;
          const hasStatus = typeof recordResponse.status !== 'undefined';
          decorators.push(
            ApiResponse(
              hasStatus
                ? (recordResponse as ApiResponseOptions)
                : { status: Number(status), ...recordResponse },
            ) as never,
          );
        }
      }
    } else {
      const response = options.res as ApiResponseOptions;
      const hasStatus = typeof response.status !== 'undefined';
      decorators.push(
        ApiResponse(
          hasStatus ? response : { status: 200, ...response },
        ) as never,
      );
    }
  }

  return applyDecorators(...decorators) as MethodDecorator & ClassDecorator;
};

