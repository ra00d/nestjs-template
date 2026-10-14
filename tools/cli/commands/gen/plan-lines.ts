import { existsSync } from 'node:fs';
import type { EntityDefinition } from './lib/types.ts';
import type { ResolvedConfig } from './lib/config.ts';
import { buildPlan } from './lib/plan.ts';
import { entityNames } from './lib/names.ts';
import { SCHEMA_BARREL } from './lib/edit-targets.ts';
import { APP_MODULE_PATH } from './constants.ts';

export const planLines = (
  definitions: EntityDefinition[],
  allEntities: EntityDefinition[],
  settings: ResolvedConfig,
  force: boolean,
): string[] => {
  const lines: string[] = [];
  for (const entity of definitions) {
    const { name, dir } = entityNames(entity);
    lines.push(`${name}  (${settings.modulesDir}/${dir}/)`);
    for (const file of buildPlan([entity], allEntities, settings)[0].files) {
      const state = existsSync(file.path)
        ? force
          ? 'overwrite'
          : 'skip (exists)'
        : 'create';
      lines.push(`  [${state}] ${file.path}`);
    }
  }
  lines.push(`[edit]     ${SCHEMA_BARREL}`);
  lines.push(`[edit]     ${APP_MODULE_PATH}`);
  return lines;
};

