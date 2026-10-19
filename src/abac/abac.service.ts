import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.module';
import { abacEnvironment, evaluateAbac } from './abac.evaluator';
import {
  AbacRepository,
  type AbacPolicyFilter,
  type CreateAbacPolicyInput,
  type UpdateAbacPolicyInput,
} from './abac.repository';
import type { AbacPolicyRecord } from './abac.schema';
import type { AbacDecision, AbacRequest } from './abac.types';

/**
 * The database half of the ABAC engine: evaluates requests against the
 * stored policies and manages the policies themselves.
 *
 * Every write is audited (`abac.policy.created`, `.updated`, `.deleted`)
 * through the global `AuditService`, best-effort, so a full history of who
 * changed which rule sits in `audit_logs`.
 *
 * @example
 * const decision = await abac.authorize({
 *   subject: toAbacSubject(user),
 *   resource: 'comment',
 *   action: 'update',
 *   attributes: { ownerId: comment.authorId, status: comment.status },
 * });
 * if (!decision.allowed) throw new ForbiddenException();
 */
@Injectable()
export class AbacService {
  private readonly logger = new Logger(AbacService.name);

  constructor(
    private readonly policies: AbacRepository,
    private readonly audit: AuditService,
  ) {}

  /**
   * Evaluates one authorization question. The caller's `environment` is
   * merged over the UTC defaults, and expired/inactive/deleted policies are
   * never considered. The answer is default-deny and carries the deciding
   * policy plus every match.
   */
  async authorize(request: AbacRequest): Promise<AbacDecision> {
    const now = request.now ?? new Date();
    const candidates = await this.policies.policiesFor(
      request.resource,
      request.action,
      now,
    );
    const decision = evaluateAbac(
      {
        ...request,
        now,
        environment: { ...abacEnvironment(now), ...request.environment },
      },
      candidates,
    );
    if (decision.allowed) {
      this.logger.debug(
        `allow ${request.resource}:${request.action} (${decision.policy?.slug ?? 'unknown'})`,
      );
    } else {
      this.logger.debug(
        `deny ${request.resource}:${request.action} (${decision.reason})`,
      );
    }
    return decision;
  }

  /** Like {@link authorize}, but throws `ForbiddenException` on a deny. */
  async authorizeOrFail(request: AbacRequest): Promise<AbacDecision> {
    const decision = await this.authorize(request);
    if (!decision.allowed) {
      throw new ForbiddenException('Forbidden');
    }
    return decision;
  }

  // Policy management

  async createPolicy(
    input: CreateAbacPolicyInput,
    actorId?: string | null,
  ): Promise<AbacPolicyRecord> {
    const policy = await this.policies.create({
      ...input,
      createdBy: input.createdBy ?? actorId ?? null,
    });
    await this.audit.log({
      action: 'abac.policy.created',
      entity: 'abac_policy',
      entityId: String(policy.id),
      actorId: actorId ?? null,
      metadata: describe(policy),
    });
    return policy;
  }

  /** All policies matching `filter`, in evaluation order. */
  async listPolicies(
    filter: AbacPolicyFilter = {},
  ): Promise<AbacPolicyRecord[]> {
    return this.policies.list(filter);
  }

  /** One live policy; throws `NotFoundException` when it is missing or deleted. */
  async getPolicy(id: number): Promise<AbacPolicyRecord> {
    const policy = await this.policies.findById(id);
    if (!policy) {
      throw new NotFoundException(`abac policy ${id} was not found`);
    }
    return policy;
  }

  /** One live policy by slug, or `null`; handy for seeds and bootstraps. */
  async findPolicyBySlug(slug: string): Promise<AbacPolicyRecord | null> {
    return this.policies.findBySlug(slug);
  }

  /** Partial update; throws `NotFoundException` when the policy is missing or deleted. */
  async updatePolicy(
    id: number,
    input: UpdateAbacPolicyInput,
    actorId?: string | null,
  ): Promise<AbacPolicyRecord> {
    const updated = await this.policies.update(id, input);
    if (!updated) {
      throw new NotFoundException(`abac policy ${id} was not found`);
    }
    await this.audit.log({
      action: 'abac.policy.updated',
      entity: 'abac_policy',
      entityId: String(updated.id),
      actorId: actorId ?? null,
      metadata: { ...describe(updated), changes: Object.keys(input) },
    });
    return updated;
  }

  /** Soft-deletes a policy; throws `NotFoundException` when it is already gone. */
  async deletePolicy(id: number, actorId?: string | null): Promise<void> {
    const deleted = await this.policies.softDelete(id);
    if (!deleted) {
      throw new NotFoundException(`abac policy ${id} was not found`);
    }
    await this.audit.log({
      action: 'abac.policy.deleted',
      entity: 'abac_policy',
      entityId: String(deleted.id),
      actorId: actorId ?? null,
      metadata: describe(deleted),
    });
  }
}

const describe = (policy: AbacPolicyRecord) => ({
  name: policy.name,
  slug: policy.slug,
  resource: policy.resource,
  action: policy.action,
  effect: policy.effect,
  priority: policy.priority,
  isActive: policy.isActive,
});
