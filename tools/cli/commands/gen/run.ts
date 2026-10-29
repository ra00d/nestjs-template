import * as p from '@clack/prompts';
import type { EntityDefinition } from './lib/types';
import type { ResolvedConfig } from './lib/config';
import { buildPlan } from './lib/plan';
import { applyPlan } from './lib/apply';
import { planLines } from './plan-lines';
import { SCHEMA_BARREL } from './lib/edit-targets';

export const run = async (
  definitions: EntityDefinition[],
  allEntities: EntityDefinition[],
  settings: ResolvedConfig,
  options: { dryRun?: boolean; force?: boolean },
): Promise<void> => {
  const plans = buildPlan(definitions, allEntities, settings);
  const lines = planLines(
    definitions,
    allEntities,
    settings,
    Boolean(options.force),
  );
  if (options.dryRun) {
    p.note(lines.join('\n'), 'Dry run');
    return;
  }

  const spinner = p.spinner();
  spinner.start(
    `Scaffolding ${plans.length} ${plans.length === 1 ? 'module' : 'modules'}...`,
  );
  let result: Awaited<ReturnType<typeof applyPlan>>;
  try {
    result = await applyPlan(plans, {
      force: Boolean(options.force),
      entities: allEntities,
      settings,
    });
  } catch (error) {
    spinner.stop('Failed.');
    throw error;
  }
  spinner.stop('Done.');

  const created = result.changes.filter(
    (change) => change.action === 'created',
  ).length;
  const skipped = result.changes.filter(
    (change) => change.action === 'skipped',
  ).length;
  p.note(
    [
      ...result.changes.map((change) => `[${change.action}] ${change.path}`),
      ...result.edited.map((path) => `[edited] ${path}`),
    ].join('\n'),
    'Changes',
  );
  if (skipped > 0) {
    p.log.warn(
      `${skipped} file${skipped === 1 ? '' : 's'} already exist. Use --force to overwrite them.`,
    );
  }
  if (created > 0 && result.edited.includes(SCHEMA_BARREL)) {
    p.log.info(
      `New tables and relation parts were wired into ${SCHEMA_BARREL}.`,
    );
  }
  for (const warning of result.warnings) {
    p.log.warn(warning);
  }
};
