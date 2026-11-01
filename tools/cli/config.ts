import 'dotenv/config';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import {
  DEFAULT_CONFIG as DEFAULT_GEN_CONFIG,
  type GenConfig,
} from './commands/gen/lib/config';
import type { EntityDefinition } from './commands/gen/lib/types';
import { registerTsResolver } from './ts-resolver';

export const DEFAULT_CONFIG_PATH = 'cli.config.ts';

export interface GenCommandConfig {
  config: GenConfig;
  entities: EntityDefinition[];
}

/** Dialects accepted by drizzle-kit. */
export type DbDialect =
  | 'postgresql'
  | 'mysql'
  | 'sqlite'
  | 'turso'
  | 'singlestore'
  | 'mssql'
  | 'cockroach'
  | 'duckdb';

/** Settings for the `db` command; all fall back to the template defaults. */
export interface DbCommandConfig {
  /** Database dialect drizzle-kit runs against. */
  dialect: DbDialect;
  /** Glob path(s) to the Drizzle schema. */
  schema: string;
  /** Migrations output folder; the drizzle-orm migrator reads from it. */
  out: string;
  /** PostgreSQL connection URL. */
  url: string;
  /** Package script `db seed` (and `db reset --seed`) runs. */
  seedScript: string;
  /** Maintenance database `db create` connects to for `CREATE DATABASE`. */
  maintenanceDatabase: string;
}

export interface CliConfig {
  /**
   * the root direcotry of the project
   */
  rootDir: string;
  gen: GenCommandConfig;
  db: DbCommandConfig;
}

/** Partial shape accepted by `defineConfig` — everything falls back to defaults. */
export interface CliConfigInput {
  rootDir?: string;
  gen?: {
    config?: GenConfig;
    entities?: EntityDefinition[];
  };
  db?: Partial<DbCommandConfig>;
}

/** Fallbacks mirror what the `db` command would use without cli.config.ts. */
export const DEFAULT_DB_CONFIG: DbCommandConfig = {
  dialect: 'postgresql',
  schema: './src/db-schema.ts',
  out: './drizzle',
  url:
    process.env['DATABASE_URL'] ?? 'postgres://localhost:5432/nestjs_template',
  seedScript: 'db:seed',
  maintenanceDatabase: 'postgres',
};

export const DEFAULT_CLI_CONFIG: CliConfig = {
  rootDir: 'src',
  gen: {
    config: { ...DEFAULT_GEN_CONFIG },
    entities: [],
  },
  db: { ...DEFAULT_DB_CONFIG },
};

export function defineConfig(input?: CliConfigInput): CliConfig {
  return {
    rootDir: input?.rootDir || DEFAULT_CLI_CONFIG.rootDir,
    gen: {
      config: { ...DEFAULT_GEN_CONFIG, ...input?.gen?.config },
      entities: input?.gen?.entities ?? [],
    },
    db: { ...DEFAULT_DB_CONFIG, ...input?.db },
  };
}

export default defineConfig;

let cachedCliConfig: CliConfig | undefined;

/** Override the in-memory config (useful for tests and programmatic use). */
export function setCliConfig(config: CliConfigInput | CliConfig): CliConfig {
  cachedCliConfig = defineConfig(config);
  return cachedCliConfig;
}

/** Clear the cached config so the next `getConfig` falls back to defaults. */
export function resetCliConfig(): void {
  cachedCliConfig = undefined;
}

/**
 * Load the CLI config file (`cli.config.ts` by default) and cache it.
 * Falls back to {@link DEFAULT_CLI_CONFIG} when the file is missing or invalid.
 */
export async function loadCliConfig(
  path: string = DEFAULT_CONFIG_PATH,
): Promise<CliConfig> {
  registerTsResolver();
  try {
    const module = await import(
      /* webpackIgnore: true */ pathToFileURL(resolve(path)).href
    );
    const raw = module.default ?? module.cliConfig ?? module.config;
    const input =
      typeof raw === 'function' ? raw() : (raw as CliConfigInput | undefined);
    cachedCliConfig = defineConfig(input);
  } catch (error) {
    if (existsSync(resolve(path))) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Could not load ${path}: ${message}`);
    }
    cachedCliConfig = defineConfig();
  }
  return cachedCliConfig;
}

/** Get the full CLI config. */
export function getConfig(): CliConfig;
/** Get a single top-level config section, e.g. `getConfig('gen')`. */
export function getConfig<K extends keyof CliConfig>(key: K): CliConfig[K];
export function getConfig<K extends keyof CliConfig>(
  key?: K,
): CliConfig | CliConfig[K] {
  const config = cachedCliConfig ?? DEFAULT_CLI_CONFIG;
  if (key === undefined) return config;
  return config[key];
}
