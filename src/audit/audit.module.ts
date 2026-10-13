import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { randomUUID } from 'node:crypto';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { auditLogs } from './audit.schema.js';

export interface AuditEntry {
  action: string;
  entity: string;
  actorId?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Best-effort audit writer. The insert never rejects: audit must not break
 * the action it records (e.g. registration when the table is not migrated
 * yet, or the database hiccups). Failures are logged with the entry.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(@InjectDrizzle() private readonly db: NodePgDatabase) {}

  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.db.insert(auditLogs).values({
        id: randomUUID(),
        action: entry.action,
        entity: entry.entity,
        actorId: entry.actorId ?? null,
        entityId: entry.entityId ?? null,
        metadata: entry.metadata ?? null,
      });
    } catch (error) {
      this.logger.warn(
        `audit dropped (${entry.action} on ${entry.entity}): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
