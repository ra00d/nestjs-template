import { omit, pick, removeUndefined } from './object';

describe('pick', () => {
  it('copies only the requested keys', () => {
    expect(pick({ a: 1, b: 2, c: 3 }, ['a', 'c'] as const)).toEqual({
      a: 1,
      c: 3,
    });
  });
});

describe('omit', () => {
  it('copies everything except the dropped keys', () => {
    expect(omit({ a: 1, b: 2 }, ['b'] as const)).toEqual({ a: 1 });
  });

  it('does not mutate the source', () => {
    const source = { a: 1, b: 2 };
    omit(source, ['b'] as const);
    expect(source).toEqual({ a: 1, b: 2 });
  });
});

describe('removeUndefined', () => {
  it('strips undefined values but keeps nulls and falsy values', () => {
    expect(
      removeUndefined({ a: 1, b: undefined, c: null, d: 0, e: '' }),
    ).toEqual({ a: 1, c: null, d: 0, e: '' });
  });
});
