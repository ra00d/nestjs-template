import KeyvRedis from '@keyv/redis';
import { Test } from '@nestjs/testing';
import { REDIS_STORE } from './redis.constants';
import { RedisModule } from './redis.module';

describe('RedisModule', () => {
  it('provides a KeyvRedis store without connecting eagerly', async () => {
    const module = await Test.createTestingModule({
      imports: [
        RedisModule.forRoot({
          url: 'redis://localhost:6379',
          namespace: 'test',
          isGlobal: false,
        }),
      ],
    }).compile();

    const store = module.get<KeyvRedis<any>>(REDIS_STORE);
    expect(store).toBeInstanceOf(KeyvRedis);
    expect(store.namespace).toBe('test');
    // Closing the module disconnects a never-connected client without throwing.
    await expect(module.close()).resolves.toBeUndefined();
  });

  it('supports forRootAsync', async () => {
    const module = await Test.createTestingModule({
      imports: [
        RedisModule.forRootAsync({
          useFactory: () => ({
            url: 'redis://localhost:6379',
            isGlobal: false,
          }),
        }),
      ],
    }).compile();

    try {
      const store = module.get<typeof KeyvRedis>(REDIS_STORE);
      expect(store).toBeInstanceOf(KeyvRedis);
    } finally {
      await module.close();
    }
  });
});
