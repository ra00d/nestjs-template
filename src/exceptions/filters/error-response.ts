/** The uniform error envelope every filter in this directory returns. */
export interface ErrorResponseBody {
  statusCode: number;
  message: string | string[];
  error: string;
  path: string;
  timestamp: string;
}

export function buildErrorResponse(
  statusCode: number,
  message: string | string[],
  error: string,
  path: string,
): ErrorResponseBody {
  return {
    statusCode,
    message,
    error,
    path,
    timestamp: new Date().toISOString(),
  };
}

/** Minimal structural types so filters stay transport-agnostic (Fastify and Express both satisfy them). */
export interface FilterReply {
  status(code: number): FilterReply;
  send(body: unknown): unknown;
  header?(name: string, value: string): unknown;
}

export interface FilterRequest {
  method?: string;
  url?: string;
  originalUrl?: string;
}

/** Reads the request path on either Fastify (`url`) or Express (`originalUrl`). */
export function requestPath(
  request: FilterRequest | Record<string, unknown>,
): string {
  if (typeof request['url'] === 'string') return request['url'];
  if (typeof request['originalUrl'] === 'string') return request['originalUrl'];
  return '';
}

/** `'Internal Server Error'` for 500, without importing the whole enum map. */
export function reasonPhrase(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return 'Bad Request';
    case 401:
      return 'Unauthorized';
    case 403:
      return 'Forbidden';
    case 404:
      return 'Not Found';
    case 409:
      return 'Conflict';
    case 422:
      return 'Unprocessable Entity';
    case 429:
      return 'Too Many Requests';
    case 500:
      return 'Internal Server Error';
    case 502:
      return 'Bad Gateway';
    case 503:
      return 'Service Unavailable';
    default:
      return statusCode >= 500 ? 'Internal Server Error' : 'Error';
  }
}
