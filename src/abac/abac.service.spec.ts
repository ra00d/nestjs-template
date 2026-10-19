import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { AuditService } from '../audit/audit.module';
import { AbacRepository } from './abac.repository';
import type { AbacPolicyRecord } from './abac.schema';
import { AbacService } from './abac.service';

const record = (overrides: Partial<AbacPolicyRecord> = {}): AbacPolicyRecord =>
  ({
    id: 1,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    deletedAt: null,
    name: 'policy',
    slug: 'policy',
    description: null,
    resource: 'comment',
    action: 'update',
    rules: {},
    effect: 'allow',
    priority: 100,
    isActive: true,
    expiresAt: null,
    createdBy: null,
    ...overrides,
  }) as AbacPolicyRecord;

describe('AbacService', () => {
  let module: TestingModule;
  let service: AbacService;
  const repository = {
    create: vi.fn(),
    findById: vi.fn(),
    findBySlug: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    policiesFor: vi.fn(),
  };
  const audit = { log: vi.fn(async () => undefined) };

  beforeEach(async () => {
    vi.clearAllMocks();
    module = await Test.createTestingModule({
      providers: [
        AbacService,
        { provide: AbacRepository, useValue: repository },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    service = module.get(AbacService);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('authorize', () => {
    it('evaluates candidates with UTC environment defaults', async () => {
      repository.policiesFor.mockResolvedValue([
        record({
          rules: { environment: { time: { start: '09:00', end: '18:00' } } },
        }),
      ]);

      const decision = await service.authorize({
        subject: { id: 'user-1', authenticated: true },
        resource: 'comment',
        action: 'update',
        now: new Date('2026-06-01T10:00:00Z'),
      });

      expect(decision).toMatchObject({ allowed: true, reason: 'matched' });
      expect(repository.policiesFor).toHaveBeenCalledWith(
        'comment',
        'update',
        new Date('2026-06-01T10:00:00Z'),
      );
    });

    it('lets the caller override environment attributes', async () => {
      repository.policiesFor.mockResolvedValue([
        record({
          rules: { environment: { time: { start: '09:00', end: '18:00' } } },
        }),
      ]);

      const decision = await service.authorize({
        subject: { id: 'user-1', authenticated: true },
        resource: 'comment',
        action: 'update',
        environment: { time: '20:00:00' },
      });

      expect(decision.allowed).toBe(false);
    });
  });

  describe('authorizeOrFail', () => {
    it('throws ForbiddenException on a default deny', async () => {
      repository.policiesFor.mockResolvedValue([]);
      await expect(
        service.authorizeOrFail({
          subject: { authenticated: false },
          resource: 'comment',
          action: 'update',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('policy management', () => {
    it('stamps the actor as creator and audits the change', async () => {
      repository.create.mockResolvedValue(
        record({ id: 7, createdBy: 'actor-1' }),
      );

      await service.createPolicy(
        { name: 'owners', resource: 'comment', action: 'update', rules: {} },
        'actor-1',
      );

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ createdBy: 'actor-1' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'abac.policy.created',
          entity: 'abac_policy',
          entityId: '7',
          actorId: 'actor-1',
        }),
      );
    });

    it('throws NotFoundException when updating a missing policy', async () => {
      repository.update.mockResolvedValue(null);
      await expect(service.updatePolicy(42, { priority: 1 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('audits updates and soft deletes', async () => {
      repository.update.mockResolvedValue(record({ priority: 1 }));
      await service.updatePolicy(1, { priority: 1 }, 'actor-1');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'abac.policy.updated',
          metadata: expect.objectContaining({ changes: ['priority'] }),
        }),
      );

      repository.softDelete.mockResolvedValue(record());
      await service.deletePolicy(1, 'actor-1');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'abac.policy.deleted',
          entityId: '1',
        }),
      );
    });

    it('throws NotFoundException when deleting a missing policy', async () => {
      repository.softDelete.mockResolvedValue(null);
      await expect(service.deletePolicy(42)).rejects.toThrow(NotFoundException);
    });
  });
});
