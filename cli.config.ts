import defineConfig from './tools/cli/config';
import { config } from './tools/gen.config';
import { entities } from './tools/entities';

export default defineConfig({
  gen: { config, entities },
  db: {
    // drizzle-kit config file the db command reads (migrations folder + URL).
    config: 'drizzle.config.ts',
    // Package script `db seed` (and `db reset --seed`) runs.
    seedScript: 'db:seed',
    // Maintenance database `db create` connects to for `CREATE DATABASE`.
    maintenanceDatabase: 'postgres',
  },
});
