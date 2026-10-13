import {
  includeSchema,
  normalizedEmailSchema,
  paginationBaseSchema,
  passwordSchema,
} from './validation.js';

describe('passwordSchema', () => {
  it('accepts 12-128 chars and rejects the rest', () => {
    expect(passwordSchema.safeParse('a'.repeat(12)).success).toBe(true);
    expect(passwordSchema.safeParse('short').success).toBe(false);
    expect(passwordSchema.safeParse('a'.repeat(129)).success).toBe(false);
  });
});

describe('normalizedEmailSchema', () => {
  it('normalizes on parse', () => {
    expect(normalizedEmailSchema.parse(' A@B.co ')).toBe('a@b.co');
  });

  it('rejects invalid addresses', () => {
    expect(normalizedEmailSchema.safeParse('nope').success).toBe(false);
  });
});

describe('paginationBaseSchema', () => {
  it('defaults page/limit/order', () => {
    expect(paginationBaseSchema.parse({})).toEqual({
      page: 1,
      limit: 20,
      order: 'desc',
    });
  });

  it('coerces query strings', () => {
    expect(paginationBaseSchema.parse({ page: '2', limit: '50' })).toEqual({
      page: 2,
      limit: 50,
      order: 'desc',
    });
  });

  it('rejects a limit above the maximum instead of clamping', () => {
    expect(
      paginationBaseSchema.safeParse({ limit: '500' }).success,
    ).toBe(false);
  });
});

describe('includeSchema', () => {
  it('splits comma lists into a set', () => {
    expect(includeSchema.parse('author, comments')).toEqual(
      new Set(['author', 'comments']),
    );
  });

  it('stays undefined when absent', () => {
    expect(includeSchema.parse(undefined)).toBeUndefined();
  });
});
