import { currentTx, DbOrTx } from '@/database';
import { Injectable, Logger } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { randomUUID } from 'crypto';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AuditEntry } from './audit.module';
import { auditLogs } from './audit.schema';

/**
 * Best-effort audit writer. The insert never rejects: audit must not break
 * the action it records (e.g. registration when the table is not migrated
 * yet, or the database hiccups). Failures are logged with the entry.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(@InjectDrizzle() private readonly baseDb: NodePgDatabase) {}

  /** Use the active transaction (if any) over the injected database. */
  private get db(): NodePgDatabase {
    return (
      (currentTx() as unknown as NodePgDatabase | undefined) ?? this.baseDb
    );
  }

  /**
   * Writes an audit entry. Pass a transaction (or any `DbOrTx`) as the
   * second argument to make the write part of a unit of work; otherwise the
   * active (or injected) database is used.
   */
  async log(entry: AuditEntry, executor: DbOrTx = this.db): Promise<void> {
    try {
      await executor.insert(auditLogs).values({
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
  async get() {
    return await this.db.select().from(auditLogs);
  }
}
