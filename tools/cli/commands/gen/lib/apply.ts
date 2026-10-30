import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { format as prettierFormat } from 'prettier';
import { IndentationText, Project, QuoteKind } from 'ts-morph';
import { DEFAULT_CONFIG, type ResolvedConfig } from './config';
import {
  applyAppModuleEdits,
  applySchemaBarrel,
  applySchemaEdits,
  SCHEMA_BARREL,
} from './edit-targets';
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
