export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

/** SQL offset for a 1-based page. */
export function offsetOf(page: number, limit: number): number {
  return (page - 1) * limit;
}

/**
 * Builds the `meta` every list endpoint returns (and the
 * `TransformInterceptor` passes through). `totalPages` is `0` when empty.
 */
export function pageMeta(page: number, limit: number, total: number): PageMeta {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}

/** Wraps `rows` + `total` into the standard `{ data, meta }` shape. */
export function paginate<T>(rows: T[], page: number, limit: number, total: number): Paginated<T> {
  return { data: rows, meta: pageMeta(page, limit, total) };
}

/**
 * Opaque keyset cursor: base64url JSON of the last row's sort values.
 * Prefer over offset for large or live-updating lists (`?cursor=…&limit=…`
 * instead of `?page=…`); offset stays for admin tables and exports.
 */
export function encodeCursor(values: Record<string, string | number | boolean | null>): string {
  return Buffer.from(JSON.stringify(values), 'utf8').toString('base64url');
}

/** Inverse of `encodeCursor`; throws a `TypeError` on tampered input. */
export function decodeCursor<T extends Record<string, unknown>>(cursor: string): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    ) as unknown;
  } catch {
    throw new TypeError('malformed cursor');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new TypeError('malformed cursor');
  }
  return parsed as T;
}
