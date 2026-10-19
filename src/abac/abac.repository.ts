import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { and, asc, eq, gt, ilike, isNull, or } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { currentTx } from '../database/transaction';
import { slugify } from '../utils/string';
import { abacPolicies, type AbacPolicyRecord } from './abac.schema';
import type { AbacEffect, AbacRules } from './abac.types';

/** Everything `createPolicy` accepts; the column defaults fill the rest. */
export interface CreateAbacPolicyInput {
  name: string;
  slug?: string;
  description?: string | null;
  resource: string;
  action: string;
  rules: AbacRules;
  effect?: AbacEffect;
  priority?: number;
  isActive?: boolean;
  expiresAt?: Date | null;
  /** `users.id` of the creator; `null` for system-seeded policies. */
  createdBy?: string | null;
}

/** The mutable half of a policy; `createdBy` stays as first written. */
export type UpdateAbacPolicyInput = Partial<
  Omit<CreateAbacPolicyInput, 'createdBy'>
>;

/** Filters accepted by {@link AbacRepository.list}. */
export interface AbacPolicyFilter {
  resource?: string;
  action?: string;
  effect?: AbacEffect;
  isActive?: boolean;
  /** Case-insensitive `name`/`slug` substring. */
  search?: string;
  /** Include soft-deleted rows (admin views). Defaults to `false`. */
  includeDeleted?: boolean;
}

/**
 * Persistence for `abac_policy`. Reads honour the same transaction scope as
 * the rest of the app (`currentTx()`), and nothing here enforces `effect` or
 * `priority` semantics — that belongs to `AbacService` / the evaluator.
 */
@Injectable()
export class AbacRepository {
  constructor(@InjectDrizzle() private readonly baseDb: NodePgDatabase) {}

  /** Use the active transaction (if any) over the injected database. */
  private get db(): NodePgDatabase {
    return (
      (currentTx() as unknown as NodePgDatabase | undefined) ?? this.baseDb
    );
  }

  async create(input: CreateAbacPolicyInput): Promise<AbacPolicyRecord> {
    const [created] = await this.db
      .insert(abacPolicies)
      .values({
        name: input.name,
        slug: input.slug ?? (slugify(input.name) || input.name),
        description: input.description ?? null,
        resource: input.resource,
        action: input.action,
        rules: input.rules,
        effect: input.effect ?? 'allow',
        priority: input.priority ?? 100,
        isActive: input.isActive ?? true,
        expiresAt: input.expiresAt ?? null,
        createdBy: input.createdBy ?? null,
      })
      .returning();
    return created;
  }

  async findById(
    id: number,
    includeDeleted = false,
  ): Promise<AbacPolicyRecord | null> {
    const [row] = await this.db
      .select()
      .from(abacPolicies)
      .where(
        includeDeleted
          ? eq(abacPolicies.id, id)
          : and(eq(abacPolicies.id, id), isNull(abacPolicies.deletedAt)),
      );
    return row ?? null;
  }

  async findBySlug(
    slug: string,
    includeDeleted = false,
  ): Promise<AbacPolicyRecord | null> {
    const [row] = await this.db
      .select()
      .from(abacPolicies)
      .where(
        includeDeleted
          ? eq(abacPolicies.slug, slug)
          : and(eq(abacPolicies.slug, slug), isNull(abacPolicies.deletedAt)),
      );
    return row ?? null;
  }

  /** All policies matching `filter`, in evaluation order (priority, then id). */
  async list(filter: AbacPolicyFilter = {}): Promise<AbacPolicyRecord[]> {
    const conditions = [];
    if (!filter.includeDeleted) {
      conditions.push(isNull(abacPolicies.deletedAt));
    }
    if (filter.resource) {
      conditions.push(eq(abacPolicies.resource, filter.resource));
    }
    if (filter.action) {
      conditions.push(eq(abacPolicies.action, filter.action));
    }
    if (filter.effect) {
      conditions.push(eq(abacPolicies.effect, filter.effect));
    }
    if (filter.isActive !== undefined) {
      conditions.push(eq(abacPolicies.isActive, filter.isActive));
    }
    if (filter.search) {
      const term = `%${filter.search.replace(/([%_\\])/g, '\\$1')}%`;
      conditions.push(
        or(ilike(abacPolicies.name, term), ilike(abacPolicies.slug, term)),
      );
    }
    return this.db
      .select()
      .from(abacPolicies)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(abacPolicies.priority), asc(abacPolicies.id));
  }

  /**
   * Applies a partial update to a live (not soft-deleted) policy and returns
   * the updated row, or `null` when there is no such policy. An empty input
   * reads the row instead of writing it.
   */
  async update(
    id: number,
    input: UpdateAbacPolicyInput,
  ): Promise<AbacPolicyRecord | null> {
    if (Object.keys(input).length === 0) {
      return this.findById(id);
    }
    const [updated] = await this.db
      .update(abacPolicies)
      .set(input)
      .where(and(eq(abacPolicies.id, id), isNull(abacPolicies.deletedAt)))
      .returning();
    return updated ?? null;
  }

  /** Soft-deletes a policy; `null` when it was missing or already deleted. */
  async softDelete(id: number): Promise<AbacPolicyRecord | null> {
    const [deleted] = await this.db
      .update(abacPolicies)
      .set({ deletedAt: new Date() })
      .where(and(eq(abacPolicies.id, id), isNull(abacPolicies.deletedAt)))
      .returning();
    return deleted ?? null;
  }

  /**
   * The policies an authorization request is evaluated against: same
   * resource/action, active, not soft-deleted, not expired at `now`, in
   * precedence order (priority ascending, id ascending for ties).
   */
  async policiesFor(
    resource: string,
    action: string,
    now: Date = new Date(),
  ): Promise<AbacPolicyRecord[]> {
    return this.db
      .select()
      .from(abacPolicies)
      .where(
        and(
          eq(abacPolicies.resource, resource),
          eq(abacPolicies.action, action),
          eq(abacPolicies.isActive, true),
          isNull(abacPolicies.deletedAt),
          or(isNull(abacPolicies.expiresAt), gt(abacPolicies.expiresAt, now)),
        ),
      )
      .orderBy(asc(abacPolicies.priority), asc(abacPolicies.id));
  }
}
