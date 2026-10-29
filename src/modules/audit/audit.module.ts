import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';

export interface AuditEntry {
  action: string;
  entity: string;
  actorId?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}
@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
