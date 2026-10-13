import { retry, sleep, withTimeout } from './async.js';

describe('sleep', () => {
  it('waits at least the requested time', async () => {
    const start = Date.now();
    await sleep(30);
    expect(Date.now() - start).toBeGreaterThanOrEqual(25);
  });
});

describe('retry', () => {
  it('returns the first success without retrying', async () => {
    const fn = vi.fn(async () => 'ok');
    await expect(retry(fn)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries failures until attempts run out', async () => {
    const fn = vi.fn(async () => {
      throw new Error('flaky');
    });
    await expect(
      retry(fn, { attempts: 3, delayMs: 1 }),
    ).rejects.toThrow('flaky');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('recovers when a later attempt succeeds', async () => {
    let calls = 0;
    const result = await retry(
      async () => {
        calls += 1;
        if (calls < 3) throw new Error('flaky');
        return 'recovered';
      },
      { attempts: 3, delayMs: 1 },
    );
    expect(result).toBe('recovered');
    expect(calls).toBe(3);
  });

  it('honors retryIf to fail fast on permanent errors', async () => {
    const fn = vi.fn(async () => {
      throw new Error('permanent');
    });
    await expect(
      retry(fn, { attempts: 3, delayMs: 1, retryIf: () => false }),
    ).rejects.toThrow('permanent');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('withTimeout', () => {
  it('passes through fast promises', async () => {
    await expect(withTimeout(Promise.resolve('fast'), 100)).resolves.toBe(
      'fast',
    );
  });

  it('rejects slow promises with a custom error', async () => {
    const slow = new Promise(() => {});
    await expect(
      withTimeout(slow, 10, () => new Error('too slow')),
    ).rejects.toThrow('too slow');
  });
});
