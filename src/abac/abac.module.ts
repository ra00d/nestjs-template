import { Module } from '@nestjs/common';
import { AbacController } from './abac.controller';
import { AbacGuard } from './abac.guard';
import { AbacRepository } from './abac.repository';
import { AbacService } from './abac.service';

/**
 * The dynamic ABAC engine: `AbacService` (evaluate + manage policies),
 * `AbacGuard` (route enforcement; import this module and use
 * `@UseGuards(AbacGuard)` with `@Abac({…})`), and the policy CRUD API.
 *
 * Depends on the global `DrizzleModule` (database), `AuditModule` (policy
 * change history) and `AuthenticationModule` (the signed-in user).
 */
@Module({
  controllers: [AbacController],
  providers: [AbacRepository, AbacService, AbacGuard],
  exports: [AbacService, AbacRepository, AbacGuard],
})
export class AbacModule {}
