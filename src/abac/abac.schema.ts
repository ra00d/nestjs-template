import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from '../auth/db/auth.schema';
import { at, timestamps } from '../database/fields';
import type { AbacRules } from './abac.types';

/**
 * Dynamic ABAC policies: one row per rule set, evaluated by
 * `AbacService.authorize` against the subject, resource attributes and
 * environment of a request.
 *
 * Notes on the shape:
 * - `id` is an identity column, the modern equivalent of `SERIAL`.
 * - `created_by` is `text` (not `UUID`) because `users.id` is `text` here;
 *   deleting the actor keeps the policy, with the reference set to `NULL`.
 * - `slug` is unique: policies are addressable by it (`getPolicyBySlug`,
 *   seeds), so two rows may not share one. Drop the index if that is
 *   unwanted — nothing else depends on it.
 * - Timestamps use the shared `timestamps` columns (`TIMESTAMPTZ`), so
 *   `updated_at` advances on every write and `deleted_at` marks a soft
 *   delete, matching the rest of the schema.
 *
 * Rules are validated by `abacRulesSchema` before they reach this column;
 * the JSON shape is described by `AbacRules` in `abac.types.ts`.
 */
export const abacPolicies = pgTable(
  'abac_policy',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    ...timestamps,
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    /** Entity being accessed, e.g. `comment`. */
    resource: text('resource').notNull(),
    /** Action being performed, e.g. `update`. */
    action: text('action').notNull(),
    /** Subject / resource / environment rules; see `AbacRules`. */
    rules: jsonb('rules').$type<AbacRules>().notNull(),
    effect: text('effect', { enum: ['allow', 'deny'] })
      .notNull()
      .default('allow'),
    /** Lower = higher priority; ties go to `deny`. */
    priority: integer('priority').notNull().default(100),
    isActive: boolean('is_active').notNull().default(true),
    expiresAt: at('expires_at'),
    createdBy: text('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
  },
  (table) => [
    index('abac_policy_resource_action_priority_idx').on(
      table.resource,
      table.action,
      table.priority,
    ),
    uniqueIndex('abac_policy_slug_idx').on(table.slug),
    check(
      'abac_policy_effect_check',
      sql`${table.effect} IN ('allow', 'deny')`,
    ),
  ],
);

export type AbacPolicyRecord = typeof abacPolicies.$inferSelect;
export type NewAbacPolicyRecord = typeof abacPolicies.$inferInsert;
