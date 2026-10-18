import { deepMerge } from './deep-merge';

describe('deepMerge', () => {
  it('merges flat objects', () => {
    expect(deepMerge({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 });
  });

  it('overrides scalar values from source', () => {
    expect(deepMerge({ a: 1 }, { a: 2 })).toEqual({ a: 2 });
  });

  it('deep-merges nested plain objects by default', () => {
    const target = { nested: { a: 1, b: 2 } };
    const source = { nested: { b: 3, c: 4 } };
    expect(deepMerge(target, source)).toEqual({
      nested: { a: 1, b: 3, c: 4 },
    });
  });

  it('does not mutate inputs', () => {
    const target = { nested: { a: 1 } };
    const source = { nested: { b: 2 } };
    deepMerge(target, source);
    expect(target).toEqual({ nested: { a: 1 } });
    expect(source).toEqual({ nested: { b: 2 } });
  });

  it('replaces arrays instead of merging them', () => {
    expect(deepMerge({ list: [1, 2] }, { list: [3] })).toEqual({ list: [3] });
  });

  it('treats depth 0 as a shallow merge', () => {
    const target = { nested: { a: 1, b: 2 } };
    const source = { nested: { b: 3 } };
    expect(deepMerge(target, source, 0)).toEqual({ nested: { b: 3 } });
  });

  it('only merges up to the given depth', () => {
    const target = { l1: { l2: { a: 1, b: 2 } } };
    const source = { l1: { l2: { b: 3 } } };

    expect(deepMerge(target, source, 1)).toEqual({
      l1: { l2: { b: 3 } },
    });
    expect(deepMerge(target, source, 2)).toEqual({
      l1: { l2: { a: 1, b: 3 } },
    });
  });

  it('ignores the level when it is omitted (unbounded)', () => {
    const target = { a: { b: { c: { d: 1, e: 2 } } } };
    const source = { a: { b: { c: { e: 3 } } } };
    expect(deepMerge(target, source)).toEqual({
      a: { b: { c: { d: 1, e: 3 } } },
    });
  });

  it('merges multiple objects, later sources win', () => {
    expect(deepMerge({ a: 1 }, { b: 2 }, { c: 3 })).toEqual({
      a: 1,
      b: 2,
      c: 3,
    });
    expect(deepMerge({ a: 1 }, { a: 2 }, { a: 3 })).toEqual({ a: 3 });
  });

  it('deep-merges multiple objects', () => {
    expect(
      deepMerge({ nested: { a: 1 } }, { nested: { b: 2 } }, { nested: { c: 3 } }),
    ).toEqual({ nested: { a: 1, b: 2, c: 3 } });
  });

  it('applies depth to multiple sources', () => {
    const target = { nested: { a: 1 } };
    expect(
      deepMerge(target, { nested: { b: 2 } }, { nested: { c: 3 } }, 0),
    ).toEqual({ nested: { c: 3 } });
  });

  it('returns a clone when no sources are given', () => {
    const target = { a: 1 };
    const result = deepMerge(target);
    expect(result).toEqual({ a: 1 });
    expect(result).not.toBe(target);
  });
});
