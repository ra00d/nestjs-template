import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { DbCommandConfig } from '../../config';
import { registerTsResolver } from '../../ts-resolver';

type Seeder = (db: NodePgDatabase) => Promise<void>;

interface SeederModule {
  default?: unknown;
}

const loadModule = async <T>(path: string): Promise<T> => {
  registerTsResolver();
  return (await import(
    /* webpackIgnore: true */ pathToFileURL(resolve(path)).href
  )) as T;
};

const loadSeeder = async (path: string): Promise<Seeder> => {
  const module = await loadModule<SeederModule>(path);
  if (typeof module.default !== 'function') {
    throw new Error(
      `Seeder "${path}" must default-export a function, e.g. \`export default authSeeder;\`.`,
    );
  }
  return module.default as Seeder;
};

/**
 * Run every seeder configured in `db.seeders` against one database
 * connection. Each module owns its tables: a seeder receives the Drizzle
 * instance and seeds only what it needs. Seeder modules default-export a
 * `SeedFunc` from `src/database/types.ts`.
 */
export const runSeeders = async (
  config: Pick<DbCommandConfig, 'url' | 'seeders'>,
): Promise<void> => {
  if (config.seeders.length === 0) {
    throw new Error(
      'No seeders configured. Add them to db.seeders in cli.config.ts.',
    );
  }

  const seeders = await Promise.all(config.seeders.map(loadSeeder));
  const db = drizzle(config.url);
  try {
    for (const seeder of seeders) {
      await seeder(db);
    }
  } finally {
    await db.$client.end();
  }
};
