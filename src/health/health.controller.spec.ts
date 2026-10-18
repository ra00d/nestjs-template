import { Test, type TestingModule } from '@nestjs/testing';
import { getDrizzleToken } from '@nestjs/drizzle';
import {
  HealthCheckService,
  HealthIndicatorService,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { REDIS_STORE } from '../redis/redis.constants';

describe('HealthController', () => {
  let module: TestingModule;
  let controller: HealthController;

  const db = { execute: vi.fn(async () => []) };
  const redis = { set: vi.fn(async () => true), get: vi.fn(async () => '1') };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          // Runs the real indicator functions against the mocked services.
          provide: HealthCheckService,
          useValue: {
            check: async (indicators: Array<() => Promise<unknown>>) => {
              const info: Record<string, unknown> = {};
              for (const run of indicators) {
                Object.assign(info, await run());
              }
              return { status: 'ok', info };
            },
          },
        },
        {
          provide: HealthIndicatorService,
          useValue: {
            check: (key: string) => ({
              attempt: (
                fn: (options: { signal: AbortSignal }) => Promise<unknown>,
              ) => ({
                withTimeout: async () => {
                  await fn({ signal: new AbortController().signal });
                  return { [key]: { status: 'up' } };
                },
              }),
            }),
          },
        },
        {
          provide: MemoryHealthIndicator,
          useValue: {
            checkHeap: async () => ({ memory_heap: { status: 'up' } }),
          },
        },
        { provide: getDrizzleToken(), useValue: db },
        { provide: REDIS_STORE, useValue: redis },
      ],
    }).compile();
    controller = module.get(HealthController);
  });

  afterEach(async () => {
    await module.close();
  });

  it('reports up when the database and redis answer', async () => {
    await expect(controller.check()).resolves.toEqual({
      status: 'ok',
      info: {
        memory_heap: { status: 'up' },
        database: { status: 'up' },
        redis: { status: 'up' },
      },
    });
    expect(db.execute).toHaveBeenCalledOnce();
    expect(redis.set).toHaveBeenCalledWith('health:ping', '1', 5000);
  });

  it('propagates a database failure', async () => {
    db.execute.mockRejectedValueOnce(new Error('connection refused'));
    await expect(controller.check()).rejects.toThrow('connection refused');
  });
});
