import type { RedisStore } from './redis.options';
import { RedisService } from './redis.service';

function createService() {
  const client = {
    get: vi.fn(),
    set: vi.fn(),
    mGet: vi.fn(),
    mSet: vi.fn(),
    del: vi.fn(),
    exists: vi.fn(),
    expire: vi.fn(),
    ttl: vi.fn(),
    persist: vi.fn(),
    incrBy: vi.fn(),
    decrBy: vi.fn(),
    scan: vi.fn(),
    hGet: vi.fn(),
    hSet: vi.fn(),
    hGetAll: vi.fn(),
    hDel: vi.fn(),
    publish: vi.fn(),
  };
  const store = {
    getClient: vi.fn(async () => client),
    createKeyPrefix: vi.fn((key: string) => `test::${key}`),
    getKeyWithoutPrefix: vi.fn((key: string) =>
      key.startsWith('test::') ? key.slice('test::'.length) : key,
    ),
  };
  const service = new RedisService(store as unknown as RedisStore);
  return { client, service, store };
}

describe('RedisService', () => {
  it('connects once on init and reuses the client', async () => {
    const { service, store } = createService();

    await service.onModuleInit();
    await expect(service.getClient()).resolves.toBeDefined();
    expect(store.getClient).toHaveBeenCalledTimes(1);
  });

  it('namespaces keys and passes TTLs in seconds', async () => {
    const { client, service } = createService();
    client.get.mockResolvedValue('value');
    client.set.mockResolvedValue('OK');

    await expect(service.get('key')).resolves.toBe('value');
    expect(client.get).toHaveBeenCalledWith('test::key');

    await expect(service.set('key', 42, 30)).resolves.toBe(true);
    expect(client.set).toHaveBeenCalledWith('test::key', '42', { EX: 30 });

    await expect(service.set('key', 'value')).resolves.toBe(true);
    expect(client.set).toHaveBeenLastCalledWith(
      'test::key',
      'value',
      undefined,
    );
  });

  it('supports batch reads, writes, deletes, and existence checks', async () => {
    const { client, service } = createService();
    client.mGet.mockResolvedValue(['a', null]);
    client.mSet.mockResolvedValue('OK');
    client.del.mockResolvedValue(2);
    client.exists.mockResolvedValue(1);

    await expect(service.getMany(['a', 'b'])).resolves.toEqual(['a', null]);
    expect(client.mGet).toHaveBeenCalledWith(['test::a', 'test::b']);

    await expect(service.setMany({ a: 1, b: 'two' })).resolves.toBe(true);
    expect(client.mSet).toHaveBeenCalledWith([
      ['test::a', '1'],
      ['test::b', 'two'],
    ]);

    await expect(service.delete('a', 'b')).resolves.toBe(2);
    expect(client.del).toHaveBeenCalledWith(['test::a', 'test::b']);

    await expect(service.has('a')).resolves.toBe(true);
    expect(client.exists).toHaveBeenCalledWith(['test::a']);
  });

  it('delegates expiry and counter commands', async () => {
    const { client, service } = createService();
    client.expire.mockResolvedValue(1);
    client.ttl.mockResolvedValue(30);
    client.persist.mockResolvedValue(1);
    client.incrBy.mockResolvedValue(5);
    client.decrBy.mockResolvedValue(4);

    await expect(service.expire('key', 30)).resolves.toBe(true);
    expect(client.expire).toHaveBeenCalledWith('test::key', 30);

    await expect(service.ttl('key')).resolves.toBe(30);
    expect(client.ttl).toHaveBeenCalledWith('test::key');

    await expect(service.persist('key')).resolves.toBe(true);
    expect(client.persist).toHaveBeenCalledWith('test::key');

    await expect(service.increment('counter', 5)).resolves.toBe(5);
    expect(client.incrBy).toHaveBeenCalledWith('test::counter', 5);

    await expect(service.decrement('counter')).resolves.toBe(4);
    expect(client.decrBy).toHaveBeenCalledWith('test::counter', 1);
  });

  it('iterates every SCAN page and strips the namespace', async () => {
    const { client, service } = createService();
    client.scan
      .mockResolvedValueOnce({
        cursor: '1',
        keys: ['test::a', 'test::b'],
      })
      .mockResolvedValueOnce({ cursor: '0', keys: ['test::c'] });

    await expect(service.keys()).resolves.toEqual(['a', 'b', 'c']);
    expect(client.scan).toHaveBeenNthCalledWith(1, '0', {
      MATCH: 'test::*',
      COUNT: 100,
    });
    expect(client.scan).toHaveBeenNthCalledWith(2, '1', {
      MATCH: 'test::*',
      COUNT: 100,
    });
  });

  it('delegates hash commands and publishing', async () => {
    const { client, service } = createService();
    client.hSet.mockResolvedValue(1);
    client.hGet.mockResolvedValue('value');
    client.hGetAll.mockResolvedValue({ field: 'value' });
    client.hDel.mockResolvedValue(1);
    client.publish.mockResolvedValue(2);

    await expect(service.hSet('hash', 'field', 'value')).resolves.toBe(1);
    expect(client.hSet).toHaveBeenCalledWith('test::hash', 'field', 'value');

    await expect(service.hSet('hash', { other: 2 })).resolves.toBe(1);
    expect(client.hSet).toHaveBeenCalledWith('test::hash', { other: '2' });

    await expect(service.hGet('hash', 'field')).resolves.toBe('value');
    expect(client.hGet).toHaveBeenCalledWith('test::hash', 'field');

    await expect(service.hGetAll('hash')).resolves.toEqual({
      field: 'value',
    });
    expect(client.hGetAll).toHaveBeenCalledWith('test::hash');

    await expect(service.hDelete('hash', 'field')).resolves.toBe(1);
    expect(client.hDel).toHaveBeenCalledWith('test::hash', ['field']);

    await expect(service.publish('events', 'payload')).resolves.toBe(2);
    expect(client.publish).toHaveBeenCalledWith('events', 'payload');
  });
});
