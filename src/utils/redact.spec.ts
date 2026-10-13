import { DEFAULT_SENSITIVE_FIELDS, redactSensitive } from './redact.js';

describe('redactSensitive', () => {
  it('strips default fields at the top level', () => {
    expect(
      redactSensitive({ email: 'a@b.co', password: 's3cret' }),
    ).toEqual({ email: 'a@b.co', password: '[Redacted]' });
  });

  it('matches case-insensitively and inside longer names', () => {
    expect(
      redactSensitive({
        PasswordHash: 'h',
        currentPASSWORD: 'c',
        pinCode: '1234',
        refreshToken: 't',
      }),
    ).toEqual({
      PasswordHash: '[Redacted]',
      currentPASSWORD: '[Redacted]',
      pinCode: '[Redacted]',
      refreshToken: '[Redacted]',
    });
  });

  it('redacts nested objects and arrays', () => {
    expect(
      redactSensitive({
        users: [{ email: 'a@b.co', secret: 's' }],
        meta: { attempt: { otp: '999' } },
      }),
    ).toEqual({
      users: [{ email: 'a@b.co', secret: '[Redacted]' }],
      meta: { attempt: { otp: '[Redacted]' } },
    });
  });

  it('does not mutate the input', () => {
    const input = { password: 's3cret', nested: { token: 't' } };
    redactSensitive(input);
    expect(input).toEqual({ password: 's3cret', nested: { token: 't' } });
  });

  it('replaces circular references instead of recursing forever', () => {
    const input: Record<string, unknown> = { password: 'x' };
    input['self'] = input;
    expect(redactSensitive(input)).toEqual({
      password: '[Redacted]',
      self: '[Circular]',
    });
  });

  it('passes class instances through by reference', () => {
    const at = new Date('2026-01-01');
    const buffer = Buffer.from('bytes');
    const out = redactSensitive({ at, buffer, n: 1 });
    expect(out.at).toBe(at);
    expect(out.buffer).toBe(buffer);
    expect(out.n).toBe(1);
  });

  it('passes primitives through untouched', () => {
    expect(redactSensitive('str')).toBe('str');
    expect(redactSensitive(42)).toBe(42);
    expect(redactSensitive(null)).toBeNull();
    expect(redactSensitive(undefined)).toBeUndefined();
  });

  it('accepts custom fields and a custom censor', () => {
    expect(
      redactSensitive(
        { ssn: '1', internalCode: 'x', password: 'p' },
        { fields: ['internalCode'], censor: '***' },
      ),
    ).toEqual({ ssn: '***', internalCode: '***', password: '***' });
  });

  it('can replace the defaults entirely', () => {
    expect(
      redactSensitive(
        { password: 'p', internalCode: 'x' },
        { fields: ['internalCode'], replaceDefaults: true },
      ),
    ).toEqual({ password: 'p', internalCode: '[Redacted]' });
  });

  it('caps runaway depth', () => {
    let deep: Record<string, unknown> = { password: 'p' };
    for (let i = 0; i < 30; i += 1) deep = { nested: deep };
    expect(JSON.stringify(redactSensitive(deep))).not.toContain('"p"');
  });

  it('exposes a non-empty default field list', () => {
    expect(DEFAULT_SENSITIVE_FIELDS.length).toBeGreaterThan(0);
  });
});
