import { Test, type TestingModule } from '@nestjs/testing';
import { CacheModule } from './cache.module';
import { CacheService } from './cache.service';

describe('CacheService (in-memory store)', () => {
  let module: TestingModule;
  let cache: CacheService;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [CacheModule.forRoot({ store: new Map(), isGlobal: false })],
    }).compile();
    cache = module.get(CacheService);
  });

  afterEach(async () => {
    await module.close();
  });

  it('returns undefined for a missing key', async () => {
    await expect(cache.get('missing')).resolves.toBeUndefined();
  });

  it('sets and gets a value', async () => {
    await expect(cache.set('greeting', 'hello')).resolves.toBe(true);
    await expect(cache.get<string>('greeting')).resolves.toBe('hello');
  });

  it('deletes a single key and an array of keys', async () => {
    await cache.set('a', 1);
    await cache.set('b', 2);
    await expect(cache.delete('a')).resolves.toBe(true);
    await expect(cache.get('a')).resolves.toBeUndefined();
    await expect(cache.delete(['b'])).resolves.toEqual([true]);
    await expect(cache.get('b')).resolves.toBeUndefined();
  });

  it('checks existence with has/hasMany', async () => {
    await cache.set('present', true);
    await expect(cache.has('present')).resolves.toBe(true);
    await expect(cache.has('absent')).resolves.toBe(false);
    await expect(cache.hasMany(['present', 'absent'])).resolves.toEqual([
      true,
      false,
    ]);
  });

  it('supports batch set/get/delete', async () => {
    await expect(
      cache.setMany([
        { key: 'k1', value: 'v1' },
        { key: 'k2', value: 'v2' },
      ]),
    ).resolves.toEqual([true, true]);
    await expect(cache.getMany<string>(['k1', 'k2', 'k3'])).resolves.toEqual([
      'v1',
      'v2',
      undefined,
    ]);
    await expect(cache.deleteMany(['k1', 'k2'])).resolves.toEqual([true, true]);
  });

  it('wrap() caches the loader result', async () => {
    const loader = vi.fn(async () => 'computed');
    await expect(cache.wrap('expensive', loader)).resolves.toBe('computed');
    await expect(cache.wrap('expensive', loader)).resolves.toBe('computed');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('wrap() rethrows loader errors without caching', async () => {
    const loader = vi.fn(async () => {
      throw new Error('boom');
    });
    await expect(cache.wrap('broken', loader)).rejects.toThrow('boom');
    await expect(cache.get('broken')).resolves.toBeUndefined();
  });

  it('expires entries after their TTL', async () => {
    await cache.set('short-lived', 'value', 20);
    await expect(cache.get('short-lived')).resolves.toBe('value');
    await new Promise((resolve) => setTimeout(resolve, 40));
    await expect(cache.get('short-lived')).resolves.toBeUndefined();
  });

  it('clear() removes cached entries', async () => {
    await cache.set('temp', 1);
    await cache.clear();
    await expect(cache.get('temp')).resolves.toBeUndefined();
  });
});
