import { Test, type TestingModule } from '@nestjs/testing';
import { getDrizzleToken } from '@nestjs/drizzle';
import { auditLogs } from './audit.schema';
import { AuditService } from './audit.module';

describe('AuditService', () => {
  let module: TestingModule;
  let audit: AuditService;
  const inserted: unknown[] = [];
  const db = {
    insert: vi.fn(() => ({
      values: vi.fn(async (row: unknown) => {
        inserted.push(row);
        return [];
      }),
    })),
  };

  beforeEach(async () => {
    inserted.length = 0;
    module = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: getDrizzleToken(), useValue: db },
      ],
    }).compile();
    audit = module.get(AuditService);
  });

  afterEach(async () => {
    await module.close();
  });

  it('writes the entry into audit_logs', async () => {
    await audit.log({
      action: 'user.registered',
      entity: 'user',
      actorId: 'u1',
      entityId: 'u1',
      metadata: { email: 'a@b.co' },
    });
    expect(db.insert).toHaveBeenCalledWith(auditLogs);
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      action: 'user.registered',
      entity: 'user',
      actorId: 'u1',
    });
  });

  it('never rejects when the insert fails', async () => {
    db.insert.mockImplementationOnce(() => {
      throw new Error('relation does not exist');
    });
    await expect(
      audit.log({ action: 'user.registered', entity: 'user' }),
    ).resolves.toBeUndefined();
  });
});
