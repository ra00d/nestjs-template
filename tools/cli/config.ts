import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import {
  DEFAULT_CONFIG as DEFAULT_GEN_CONFIG,
  type GenConfig,
} from './commands/gen/lib/config.ts';
import type { EntityDefinition } from './commands/gen/lib/types.ts';

export const DEFAULT_CONFIG_PATH = 'cli.config.ts';

export interface GenCommandConfig {
  config: GenConfig;
  entities: EntityDefinition[];
}

export interface CliConfig {
  gen: GenCommandConfig;
}

/** Partial shape accepted by `defineConfig` — everything falls back to defaults. */
export interface CliConfigInput {
  gen?: {
    config?: GenConfig;
    entities?: EntityDefinition[];
  };
}

export const DEFAULT_CLI_CONFIG: CliConfig = {
  gen: {
    config: { ...DEFAULT_GEN_CONFIG },
    entities: [],
  },
};

export function defineConfig(input?: CliConfigInput): CliConfig {
  return {
    gen: {
      config: { ...DEFAULT_GEN_CONFIG, ...input?.gen?.config },
      entities: input?.gen?.entities ?? [],
    },
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
export async function loadCliConfig(path: string = DEFAULT_CONFIG_PATH): Promise<CliConfig> {
  try {
    const module = await import(pathToFileURL(resolve(path)).href);
    const raw = module.default ?? module.cliConfig ?? module.config;
    const input = typeof raw === 'function' ? raw() : (raw as CliConfigInput | undefined);
    cachedCliConfig = defineConfig(input);
  } catch {
    cachedCliConfig = defineConfig();
  }
  return cachedCliConfig;
}

/** Get the full CLI config. */
export function getConfig(): CliConfig;
/** Get a single top-level config section, e.g. `getConfig('gen')`. */
export function getConfig<K extends keyof CliConfig>(key: K): CliConfig[K];
export function getConfig<K extends keyof CliConfig>(key?: K): CliConfig | CliConfig[K] {
  const config = cachedCliConfig ?? DEFAULT_CLI_CONFIG;
  if (key === undefined) return config;
  return config[key];
}
