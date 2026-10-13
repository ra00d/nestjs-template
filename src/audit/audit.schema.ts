import { index, jsonb, pgTable, text } from 'drizzle-orm/pg-core';
import { at } from '../database/fields.js';

/**
 * Append-only audit trail for security-relevant actions (registration,
 * password change, role grants). No updates or deletes by convention —
 * retention is a scheduled `DELETE ... WHERE created_at < ...` job, not
 * application code. Run `pnpm db:generate && pnpm db:migrate` to create it.
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: text('id').primaryKey(),
    /** Who acted, when a signed-in user did; `null` for anonymous acts. */
    actorId: text('actor_id'),
    /** Namespaced action, e.g. `user.registered`. */
    action: text('action').notNull(),
    /** Entity type the action touched, e.g. `user`. */
    entity: text('entity').notNull(),
    /** Entity id, when the action targets one row. */
    entityId: text('entity_id'),
    /** Redacted context (never secrets or hashes). */
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: at('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('audit_logs_actor_id_idx').on(table.actorId),
    index('audit_logs_entity_entity_id_idx').on(
      table.entity,
      table.entityId,
    ),
    index('audit_logs_created_at_idx').on(table.createdAt),
  ],
);

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
