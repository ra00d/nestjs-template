import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { format as prettierFormat } from 'prettier';
import { IndentationText, Project, QuoteKind } from 'ts-morph';
import { DEFAULT_CONFIG, type ResolvedConfig } from './config';
import {
  RELATIONS_BARREL,
  SCHEMA_BARREL,
  applyAppModuleEdits,
  applyRelationsBarrel,
  applySchemaBarrel,
  applySchemaEdits,
} from './edit-targets';
import { entityNames, toKebabCase } from './names';
import type { EntityPlan } from './plan';
import type { EntityDefinition } from './types';

export interface Change {
  path: string;
  action: 'created' | 'skipped';
}

export interface ApplyResult {
  changes: Change[];
  warnings: string[];
  /** Files edited in place (schema/relations barrels and app module). */
  edited: string[];
}

/** Formats with the repo's Prettier settings; keeps the raw source on a syntax error. */
const format = async (source: string): Promise<string> => {
  try {
    return await prettierFormat(source, {
      parser: 'typescript',
      singleQuote: true,
      trailingComma: 'all',
    });
  } catch {
    return source;
  }
};

const writeFiles = async (
  plans: EntityPlan[],
  force: boolean,
  root: string,
): Promise<Change[]> => {
  const changes: Change[] = [];
  for (const plan of plans) {
    for (const file of plan.files) {
      const target = join(root, file.path);
      if (!force && existsSync(target)) {
        changes.push({ path: file.path, action: 'skipped' });
        continue;
      }
      mkdirSync(join(target, '..'), { recursive: true });
      writeFileSync(target, await format(file.content), 'utf8');
      changes.push({ path: file.path, action: 'created' });
    }
  }
  return changes;
};

/**
 * Writes the planned files, then keeps the schema/relations barrels and
 * `src/app.module.ts` in sync (additive and idempotent, pruning entries of
 * entities that left the definitions). Only the entities of this run are
 * registered; references are validated against the full definition list.
 */
export const applyPlan = async (
  plans: EntityPlan[],
  options: {
    force: boolean;
    entities: EntityDefinition[];
    /** Base directory for every path. Defaults to the process working directory. */
    root?: string;
    /** Generation settings. Defaults to `tools/gen.config.ts` values. */
    settings?: ResolvedConfig;
  },
): Promise<ApplyResult> => {
  const root = options.root ?? process.cwd();
  const settings = options.settings ?? DEFAULT_CONFIG;
  const changes = await writeFiles(plans, options.force, root);
  const warnings: string[] = [];
  const edited: string[] = [];
  if (plans.length === 0) {
    return { changes, warnings, edited };
  }

  const externalSchemaFile = join(root, settings.externalSchema);
  const appModuleFile = join(root, 'src/app.module.ts');
  const schemaBarrelFile = join(root, SCHEMA_BARREL);
  const relationsBarrelFile = join(root, RELATIONS_BARREL);
  const modulesRoot = join(root, settings.modulesDir);

  const project = new Project({
    manipulationSettings: {
      indentationText: IndentationText.TwoSpaces,
      quoteKind: QuoteKind.Single,
    },
  });
  // Hand-written tables, for reference validation. The file is only read,
  // never rewritten: module tables live in each module's `db/` folder.
  const externalTables = existsSync(externalSchemaFile)
    ? project
        .addSourceFileAtPath(externalSchemaFile)
        .getVariableDeclarations()
        .filter((declaration) =>
          (declaration.getInitializer()?.getText() ?? '').startsWith(
            'pgTable(',
          ),
        )
        .map((declaration) => declaration.getName())
    : [];
  const schemaResult = applySchemaEdits(
    options.entities,
    settings,
    externalTables,
  );
  warnings.push(...schemaResult.warnings);

  // Folders the generator no longer owns: removing an entity unregisters its
  // module, but its files stay until deleted by hand.
  if (existsSync(modulesRoot)) {
    const known = new Set(
      options.entities.map((entity) => entityNames(entity).name),
    );
    for (const entry of readdirSync(modulesRoot, { withFileTypes: true })) {
      if (entry.isDirectory() && !known.has(toKebabCase(entry.name))) {
        warnings.push(
          `${settings.modulesDir}/${entry.name}/ is not defined in tools/entities.ts.`,
        );
      }
    }
  }

  const barrelResult = applySchemaBarrel(
    project,
    schemaBarrelFile,
    plans.map((plan) => plan.entity),
    settings,
    root,
  );
  warnings.push(...barrelResult.warnings);
  if (barrelResult.changed) {
    writeFileSync(
      schemaBarrelFile,
      await format(readFileSync(schemaBarrelFile, 'utf8')),
      'utf8',
    );
    edited.push(schemaBarrelFile);
  }

  const relationsBarrelResult = applyRelationsBarrel(
    project,
    relationsBarrelFile,
    plans.map((plan) => plan.entity),
    settings,
    root,
  );
  warnings.push(...relationsBarrelResult.warnings);
  if (relationsBarrelResult.changed) {
    writeFileSync(
      relationsBarrelFile,
      await format(readFileSync(relationsBarrelFile, 'utf8')),
      'utf8',
    );
    edited.push(relationsBarrelFile);
  }

  const appModuleResult = applyAppModuleEdits(
    project,
    appModuleFile,
    plans.map((plan) => plan.entity),
    settings,
    root,
  );
  warnings.push(...appModuleResult.warnings);
  if (appModuleResult.changed) {
    writeFileSync(
      appModuleFile,
      await format(readFileSync(appModuleFile, 'utf8')),
      'utf8',
    );
    edited.push(appModuleFile);
  }

  return { changes, warnings, edited };
};
