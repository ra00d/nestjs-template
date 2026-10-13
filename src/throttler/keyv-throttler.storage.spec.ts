import { KeyvThrottlerStorage } from './keyv-throttler.storage.js';
import type { RedisStore } from '../redis/redis.options.js';

describe('KeyvThrottlerStorage (in-memory Map store)', () => {
  const ttl = 60_000;
  const limit = 2;
  let storage: KeyvThrottlerStorage;

  beforeEach(() => {
    // A Map satisfies the Keyv store contract; no Redis needed.
    storage = new KeyvThrottlerStorage(new Map() as unknown as RedisStore);
  });

  it('counts hits until the limit without blocking', async () => {
    await expect(
      storage.increment('ip', ttl, limit, 0, 'default'),
    ).resolves.toMatchObject({ totalHits: 1, isBlocked: false });
    await expect(
      storage.increment('ip', ttl, limit, 0, 'default'),
    ).resolves.toMatchObject({ totalHits: 2, isBlocked: false });
  });

  it('blocks past the limit and reports block expiry', async () => {
    await storage.increment('ip', ttl, limit, 30_000, 'default');
    await storage.increment('ip', ttl, limit, 30_000, 'default');
    const blocked = await storage.increment('ip', ttl, limit, 30_000, 'default');
    expect(blocked.isBlocked).toBe(true);
    expect(blocked.totalHits).toBe(limit + 1);
    expect(blocked.timeToBlockExpire).toBeGreaterThan(0);
  });

  it('tracks named throttlers independently', async () => {
    await storage.increment('ip', ttl, 1, 0, 'strict');
    await expect(
      storage.increment('ip', ttl, 1, 0, 'strict'),
    ).resolves.toMatchObject({ isBlocked: true });
    await expect(
      storage.increment('ip', ttl, 1, 0, 'lenient'),
    ).resolves.toMatchObject({ isBlocked: false, totalHits: 1 });
  });

  it('keeps different tracker keys independent', async () => {
    await storage.increment('a', ttl, 1, 0, 'default');
    await expect(
      storage.increment('b', ttl, 1, 0, 'default'),
    ).resolves.toMatchObject({ isBlocked: false });
  });
});
