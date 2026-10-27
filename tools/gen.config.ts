import { defineConfig } from './cli/commands/gen/lib/config';

/**
 * Generation settings. `modulesDir` is where new modules are scaffolded,
 * relative to the repository root; the generator computes every import from
 * it, so any depth works. `externalSchema` points at the schema file holding
 * hand-written tables (referenced but never rewritten for generated tables),
 * and `externalTypes` maps those tables to the files exporting their entity
 * types (used for relation fields).
 */
export const config = defineConfig({
  modulesDir: 'src/modules',
  externalSchema: 'src/auth/db/auth.schema.ts',
  externalTypes: { users: 'src/auth/types/user.ts' },
});
