import { postgresCode } from '../exceptions/filters/database-exception.filter';

/** `23505`: an insert/update hit a unique constraint. Map to 409. */
export function isUniqueViolation(error: unknown): boolean {
  return postgresCode(error) === '23505';
}

/** `23503`: a foreign key points at a missing row. Map to 400. */
export function isForeignKeyViolation(error: unknown): boolean {
  return postgresCode(error) === '23503';
}

/**
 * `40001`/`40P01`: serialization failure or deadlock — safe to retry the
 * transaction (see `retry()` in `./async.js`), unlike constraint errors.
 */
export function isRetryableTransactionError(error: unknown): boolean {
  const code = postgresCode(error);
  return code === '40001' || code === '40P01';
}

/** Exhaustiveness guard for `switch` over unions; fails the build when a case is added. */
export function assertNever(value: never, message = 'unreachable'): never {
  throw new Error(`${message}: ${JSON.stringify(value)}`);
}
