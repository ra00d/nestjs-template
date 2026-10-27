import { getConfig, loadCliConfig } from '../../../config';
import { resolveConfig } from '../lib/config';

import * as p from '@clack/prompts';
import { entityNames } from '../lib/names';
import { buildPlan } from '../lib/plan';
import { run } from '../run';

export const generateEntity = async (
  names: string[],
  options: { dryRun?: boolean; force?: boolean; list?: boolean },
) => {
  await loadCliConfig();
  const { config, entities } = getConfig('gen');
  const settings = resolveConfig(config);
  if (options.list) {
    p.intro('cli.config');
    if (entities.length === 0) {
      p.log.info(
        'No entities defined. Run `pnpm gen add` for the interactive wizard.',
      );
    }
    for (const entity of entities) {
      const names2 = entityNames(entity);
      p.log.message(
        `${names2.name}  ->  ${names2.plural}Module at @Controller('${names2.route}')`,
      );
      for (const file of buildPlan([entity], entities, settings)[0].files) {
        p.log.message(`  ${file.path}`);
      }
    }
    p.outro(
      `${entities.length} ${entities.length === 1 ? 'entity' : 'entities'} defined.`,
    );
    return;
  }

  const requested =
    names.length > 0
      ? names
      : entities.map((entity) => entityNames(entity).name);
  const selected = entities.filter((entity) =>
    requested.includes(entityNames(entity).name),
  );
  if (names.length > 0) {
    for (const name of names) {
      if (!entities.some((entity) => entityNames(entity).name === name)) {
        p.log.error(
          `Unknown entity "${name}". Defined: ${entities.map((entity) => entityNames(entity).name).join(', ') || 'none'}.`,
        );
        process.exit(1);
      }
    }
  }
  if (selected.length === 0) {
    p.log.error(
      'No entities defined. Add one to cli.config or run `pnpm gen add` for the interactive wizard.',
    );
    process.exit(1);
  }
  p.intro('Scaffolding modules');
  await run(selected, entities, settings, {
    dryRun: options.dryRun,
    force: options.force,
  });
  p.outro('Done.');
};
