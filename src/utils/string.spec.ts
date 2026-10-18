import { maskEmail, normalizeEmail, slugify, truncate } from './string';

describe('normalizeEmail', () => {
  it('trims, lowercases, and NFC-normalizes', () => {
    expect(normalizeEmail('  A@B.C ')).toBe('a@b.c');
    expect(normalizeEmail('é@example.com')).toBe('é@example.com');
  });
});

describe('maskEmail', () => {
  it('keeps the first letter and the domain', () => {
    expect(maskEmail('ada@example.com')).toBe('a••@example.com');
  });

  it('hides malformed input entirely', () => {
    expect(maskEmail('not-an-email')).toBe('•••');
  });
});

describe('slugify', () => {
  it('lowercases, strips diacritics, and collapses separators', () => {
    expect(slugify('  Héllo,  World!  ')).toBe('hello-world');
    expect(slugify('a---b___c')).toBe('a-b-c');
  });

  it('caps the length without trailing dashes', () => {
    expect(slugify('abcdefghij', 5)).toBe('abcde');
    expect(slugify('abc def ghi', 7)).toBe('abc-def');
  });
});

describe('truncate', () => {
  it('returns short strings untouched', () => {
    expect(truncate('hi', 5)).toBe('hi');
  });

  it('cuts on code points and appends the suffix', () => {
    expect(truncate('abcdef', 5)).toBe('abcd…');
    expect(truncate('abcdef', 5, '...')).toBe('ab...');
  });

  it('cuts on graphemes so emoji stay whole', () => {
    expect(truncate('😀😀😀', 2)).toBe('😀…');
    expect(truncate('👨‍👩‍👧‍👦ab', 2)).toBe('👨‍👩‍👧‍👦…');
  });

  it('rejects negative lengths', () => {
    expect(() => truncate('x', -1)).toThrow(RangeError);
  });
});
