import { DrizzleQueryError } from 'drizzle-orm';
import { DatabaseError } from 'pg';
import {
  assertNever,
  isForeignKeyViolation,
  isRetryableTransactionError,
  isUniqueViolation,
} from './errors.js';

const pgError = (code: string): DatabaseError => {
  const error = new DatabaseError('db failed', 0, 'error');
  (error as { code?: string }).code = code;
  return error;
};

describe('postgres violation helpers', () => {
  it('detects unique and foreign-key violations through Drizzle wrapping', () => {
    const unique = new DrizzleQueryError('insert', [], pgError('23505'));
    expect(isUniqueViolation(unique)).toBe(true);
    expect(isForeignKeyViolation(unique)).toBe(false);

    const fk = new DrizzleQueryError('insert', [], pgError('23503'));
    expect(isForeignKeyViolation(fk)).toBe(true);
    expect(isUniqueViolation(fk)).toBe(false);
  });

  it('detects retryable transaction errors', () => {
    expect(isRetryableTransactionError(pgError('40001'))).toBe(true);
    expect(isRetryableTransactionError(pgError('40P01'))).toBe(true);
    expect(isRetryableTransactionError(pgError('23505'))).toBe(false);
    expect(isRetryableTransactionError(new Error('plain'))).toBe(false);
  });

  it('ignores non-errors', () => {
    expect(isUniqueViolation(undefined)).toBe(false);
    expect(isUniqueViolation({ code: '23505' })).toBe(false);
  });
});

describe('assertNever', () => {
  it('always throws', () => {
    expect(() => assertNever('x' as never)).toThrow();
  });
});
