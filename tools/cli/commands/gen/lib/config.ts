/** Options controlling the generation process. See `tools/gen.config.ts`. */
export interface GenConfig {
  /** Base directory for generated modules, relative to the repository root. Default `'src/modules'`. */
  modulesDir?: string;
  /** Central schema holding hand-written tables, relative to the repository root. Default `'src/database/schema.ts`. */
  externalSchema?: string;
  /** Type locations for hand-written tables, keyed by table: `{ users: 'src/users/user.ts' }`. Defaults to `<module>/../<table>/<singular>.ts`. */
  externalTypes?: Record<string, string>;
  /** Shared column definitions spread into every table, e.g. `src/database/fields.ts`. */
  timestampFields?: string;
}

export interface ResolvedConfig {
  modulesDir: string;
  externalSchema: string;
  externalTypes: Record<string, string>;
  timestampFields: string;
}

export const DEFAULT_CONFIG: ResolvedConfig = {
  modulesDir: 'src/modules',
  externalSchema: 'src/database/schema.ts',
  externalTypes: {},
  timestampFields: 'src/database/fields.ts',
};

const normalize = (value: string): string => value.replace(/\\/g, '/').replace(/\/+$/, '');

/** Merges user options over the defaults. */
export const resolveConfig = (overrides?: GenConfig): ResolvedConfig => ({
  modulesDir: overrides?.modulesDir ? normalize(overrides.modulesDir) : DEFAULT_CONFIG.modulesDir,
  externalSchema: overrides?.externalSchema ? normalize(overrides.externalSchema) : DEFAULT_CONFIG.externalSchema,
  externalTypes: overrides?.externalTypes ?? DEFAULT_CONFIG.externalTypes,
  timestampFields: overrides?.timestampFields ? normalize(overrides.timestampFields) : DEFAULT_CONFIG.timestampFields,
});

/** Typed helper for `tools/gen.config.ts`. */
export const defineConfig = (config: GenConfig): GenConfig => config;
