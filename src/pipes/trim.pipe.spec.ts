import { TrimPipe } from './trim.pipe.js';

describe('TrimPipe', () => {
  const pipe = new TrimPipe();

  it('returns nullish values untouched', () => {
    expect(pipe.transform(undefined)).toBeUndefined();
    expect(pipe.transform(null)).toBeNull();
  });

  it('trims a top-level string', () => {
    expect(pipe.transform('  hello  ')).toBe('hello');
  });

  it('trims every string in an object, recursively', () => {
    expect(
      pipe.transform({
        email: '  A@B.C ',
        password: ' s3cret ',
        nested: { name: ' Ada ' },
        tags: [' x ', 'y  '],
        age: 30,
        active: true,
      }),
    ).toEqual({
      email: 'A@B.C',
      password: 's3cret',
      nested: { name: 'Ada' },
      tags: ['x', 'y'],
      age: 30,
      active: true,
    });
  });

  it('does not mutate the input object', () => {
    const input = { name: ' Ada ' };
    pipe.transform(input);
    expect(input).toEqual({ name: ' Ada ' });
  });
});
