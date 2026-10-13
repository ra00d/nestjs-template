import { getClientIp, getUserAgent } from './request.js';

describe('getClientIp', () => {
  it('prefers the first forwarded address', () => {
    expect(
      getClientIp({ headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } }),
    ).toBe('1.2.3.4');
  });

  it('falls back to the socket address, then unknown', () => {
    expect(getClientIp({ ip: '9.9.9.9' })).toBe('9.9.9.9');
    expect(getClientIp({ socket: { remoteAddress: '::1' } })).toBe('::1');
    expect(getClientIp({})).toBe('unknown');
  });
});

describe('getUserAgent', () => {
  it('returns the header or unknown', () => {
    expect(getUserAgent({ headers: { 'user-agent': 'curl/8' } })).toBe(
      'curl/8',
    );
    expect(getUserAgent({ headers: {} })).toBe('unknown');
    expect(getUserAgent({})).toBe('unknown');
  });
});
