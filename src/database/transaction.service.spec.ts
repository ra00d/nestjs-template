import { getDrizzleToken } from '@nestjs/drizzle';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TransactionService } from './transaction.service.js';
import { markTx, isTx } from './types.js';

describe('TransactionService', () => {
  let module: TestingModule;
  let service: TransactionService;
  const tx: Record<string, unknown> = { id: 'tx' };
  const db = {
    transaction: vi.fn(async (cb: (tx: any) => Promise<unknown>, config?: unknown) => {
      const seed = Object.create(tx);
      seed.config = config;
      markTx(seed as any);
      return cb(seed);
    }),
  };

  beforeEach(async () => {
    db.transaction.mockClear();
    module = await Test.createTestingModule({
      providers: [TransactionService, { provide: getDrizzleToken(), useValue: db }],
    }).compile();
    service = module.get(TransactionService);
  });

  afterEach(async () => {
    await module.close();
  });

  it('runs the callback inside a transaction and returns its result', async () => {
    const result = await service.run(async (t) => {
      expect(isTx(t)).toBe(true);
      return 42;
    });
    expect(result).toBe(42);
    expect(db.transaction).toHaveBeenCalledTimes(1);
  });

  it('forwards transaction options to Drizzle', async () => {
    await service.run(async () => 'ok', {
      isolationLevel: 'serializable',
      accessMode: 'read write',
      deferrable: true,
    });
    const config = db.transaction.mock.calls[0]?.[1];
    expect(config).toEqual({
      isolationLevel: 'serializable',
      accessMode: 'read write',
      deferrable: true,
    });
  });

  it('omits the config when no options are given', async () => {
    await service.run(async () => 'ok');
    expect(db.transaction.mock.calls[0]?.[1]).toBeUndefined();
  });

  it('exposes alias methods', async () => {
    for (const method of ['transaction', 'runInTransaction', 'withTx', 'withTransaction', 'execute'] as const) {
      await (service as any)[method](async () => 1);
    }
    expect(db.transaction).toHaveBeenCalledTimes(5);
  });
});