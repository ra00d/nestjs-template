import {
  decodeCursor,
  encodeCursor,
  offsetOf,
  pageMeta,
  paginate,
} from './pagination.js';

describe('offset/pageMeta/paginate', () => {
  it('derives offsets and page counts', () => {
    expect(offsetOf(3, 20)).toBe(40);
    expect(pageMeta(2, 20, 45)).toEqual({
      page: 2,
      limit: 20,
      total: 45,
      totalPages: 3,
    });
    expect(pageMeta(1, 20, 0).totalPages).toBe(0);
  });

  it('wraps rows into the list envelope', () => {
    expect(paginate(['a'], 1, 20, 1)).toEqual({
      data: ['a'],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });
});

describe('cursor', () => {
  it('round-trips sort values opaquely', () => {
    const cursor = encodeCursor({ createdAt: '2026-01-01', id: 'abc' });
    expect(cursor).not.toContain('createdAt');
    expect(decodeCursor(cursor)).toEqual({
      createdAt: '2026-01-01',
      id: 'abc',
    });
  });

  it.each(['!!!', 'W10=', '"str"', '[1,2]', 'bnVsbA'])(
    'rejects malformed input %p',
    (raw) => {
      expect(() => decodeCursor(raw)).toThrow(TypeError);
    },
  );
});
