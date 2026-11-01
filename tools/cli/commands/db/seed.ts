import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { DbCommandConfig } from '../../config';
import { registerTsResolver } from '../../ts-resolver';

type Seeder = (fn: any) => Record<string, any>;

interface SeederModule {
  default?: unknown;
}

interface SchemaModule {
  schema?: Record<string, any>;
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
 * Run every seeder configured in `db.seeders` against the database, using the
 * tables exported by `db.schema`. Seeder modules default-export a
 * `SeederFunc`, e.g. `src/modules/auth/db/seed.ts`.
 */
export const runSeeders = async (
  config: Pick<DbCommandConfig, 'url' | 'schema' | 'seeders'>,
): Promise<void> => {
  if (config.seeders.length === 0) {
    throw new Error(
      'No seeders configured. Add them to db.seeders in cli.config.ts.',
    );
  }

  const schemaModule = await loadModule<SchemaModule>(config.schema);
  if (!schemaModule.schema) {
    throw new Error(`"${config.schema}" must export a \`schema\` object.`);
  }

  const seeders = await Promise.all(config.seeders.map(loadSeeder));
  const { seed } = await import('drizzle-seed');
  const db = drizzle(config.url);
  try {
    await seed(db, schemaModule.schema).refine((fn) =>
      seeders.reduce<Record<string, any>>(
        (tables, seeder) => ({ ...tables, ...seeder(fn) }),
        {},
      ),
    );
  } finally {
    await db.$client.end();
  }
};
