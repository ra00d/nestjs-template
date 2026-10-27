import 'dotenv/config';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { registerTsResolver } from '../../ts-resolver';

/** Where the SQL migrations live and how to reach PostgreSQL. */
export interface DatabaseConfig {
  /** `out` in drizzle.config.ts; the folder the drizzle-orm migrator reads. */
  migrationsFolder: string;
  /** `dbCredentials.url` in drizzle.config.ts. */
  url: string;
}

/** The parts of `drizzle.config.ts` this CLI needs. */
interface DrizzleConfigLike {
  out?: string;
  dbCredentials?: { url?: string };
}

/** Fallbacks mirror drizzle.config.ts so `db` still works without one. */
const FALLBACK_MIGRATIONS_FOLDER = './drizzle';
const FALLBACK_DATABASE_URL = 'postgres://localhost:5432/nestjs_template';

/**
 * Load `drizzle.config.ts` for the migrations folder and the connection URL.
 *
 * The drizzle-kit SDK reads the config itself; the drizzle-orm migrator and
 * the `db create`/`db reset` helpers need both values in-process. Importing
 * the config also triggers its `dotenv/config`, so `.env` is honoured.
 */
export async function loadDatabaseConfig(
  path: string,
): Promise<DatabaseConfig> {
  const fallback: DatabaseConfig = {
    migrationsFolder: FALLBACK_MIGRATIONS_FOLDER,
    url: process.env['DATABASE_URL'] ?? FALLBACK_DATABASE_URL,
  };
  if (!existsSync(resolve(path))) return fallback;
  registerTsResolver();
  const module = (await import(
    /* webpackIgnore: true */ pathToFileURL(resolve(path)).href
  )) as {
    default?: DrizzleConfigLike;
  };
  const config = module.default ?? {};
  return {
    migrationsFolder: config.out ?? fallback.migrationsFolder,
    url: config.dbCredentials?.url ?? fallback.url,
  };
}
