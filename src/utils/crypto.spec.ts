import { randomBytes } from 'node:crypto';
import {
  decryptString,
  encryptString,
  hashToken,
  randomToken,
  tokensEqual,
} from './crypto.js';

describe('randomToken', () => {
  it('returns unique url-safe tokens', () => {
    const a = randomToken();
    const b = randomToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('rejects non-positive sizes', () => {
    expect(() => randomToken(0)).toThrow(RangeError);
  });
});

describe('hashToken', () => {
  it('is deterministic and hides the input', () => {
    const token = randomToken();
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).not.toContain(token);
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('tokensEqual', () => {
  it('compares in constant time without leaking length', () => {
    expect(tokensEqual('abc', 'abc')).toBe(true);
    expect(tokensEqual('abc', 'abd')).toBe(false);
    expect(tokensEqual('abc', 'abcd')).toBe(false);
  });
});

describe('encryptString/decryptString', () => {
  const key = randomBytes(32);

  it('round-trips through a nonce-missing wire format', () => {
    const sealed = encryptString('top secret', key);
    expect(sealed.split('.')).toHaveLength(3);
    expect(decryptString(sealed, key)).toBe('top secret');
  });

  it('fails on the wrong key or tampered data', () => {
    const sealed = encryptString('top secret', key);
    expect(() => decryptString(sealed, randomBytes(32))).toThrow();
    expect(() => decryptString('not.a.payload', key)).toThrow();
  });

  it('rejects keys that are not 32 bytes', () => {
    expect(() => encryptString('x', randomBytes(16))).toThrow(RangeError);
  });
});
