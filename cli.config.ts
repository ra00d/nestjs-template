import 'dotenv/config';
import defineConfig from './tools/cli/config';
import { config } from './tools/gen.config';
import { entities } from './tools/entities';

export default defineConfig({
  gen: { config, entities },
  db: {
    // Drizzle Kit options (dialect, schema and migrations folder).
    dialect: 'postgresql',
    schema: './src/db.ts',
    out: './drizzle',
    url:
      process.env['DATABASE_URL'] ??
      'postgres://localhost:5432/nestjs_template',
    // Seeder modules `db seed` (and `db reset --seed`) run, in order.
    seeders: ['./src/modules/auth/db/seed.ts'],
    // Maintenance database `db create` connects to for `CREATE DATABASE`.
    maintenanceDatabase: 'postgres',
  },
});
