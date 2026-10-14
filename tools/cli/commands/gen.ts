import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import * as p from '@clack/prompts';
import { Command } from 'commander';
import { Project } from 'ts-morph';
import { appendEntity } from './gen/lib/append-entity.ts';
import { resolveConfig } from './gen/lib/config.ts';
import { entityNames } from './gen/lib/names.ts';
import { buildPlan } from './gen/lib/plan.ts';
import { getConfig, loadCliConfig } from '../config.ts';
import { wizard } from './gen/wizard.ts';
import { run } from './gen/run.ts';
import { ENTITIES_PATH } from './gen/constants.ts';

export function createGenCommand(): Command {
  const program = new Command();
  program
    .name('gen')
    .description('Scaffold NestJS modules from cli.config.ts into src/.')
    .argument(
      '[entities...]',
      'entity names to generate; all of them when omitted',
    )
    .option('--dry-run', 'print the plan without writing files')
    .option('--force', 'overwrite files from earlier runs')
    .option('--list', 'list the defined entities and their files')
    .action(
      async (
        names: string[],
        options: { dryRun?: boolean; force?: boolean; list?: boolean },
      ) => {
        await loadCliConfig();
        const { config, entities } = getConfig('gen');
        const settings = resolveConfig(config);
        if (options.list) {
          p.intro('cli.config.ts');
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
            for (const file of buildPlan([entity], entities, settings)[0]
              .files) {
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
            'No entities defined. Add one to cli.config.ts or run `pnpm gen add` for the interactive wizard.',
          );
          process.exit(1);
        }
        p.intro('Scaffolding modules');
        await run(selected, entities, settings, {
          dryRun: options.dryRun,
          force: options.force,
        });
        p.outro('Done.');
      },
    );

  program
    .command('add')
    .description('Add a new entity to cli.config.ts via the interactive wizard')
    .option('--dry-run', 'print the plan without writing files')
    .option('--force', 'overwrite files from earlier runs')
    .action(async (options: { dryRun?: boolean; force?: boolean }) => {
      if (!process.stdin.isTTY) {
        p.log.error(
          'The interactive wizard needs a TTY. Define the entity in cli.config.ts instead.',
        );
        process.exit(1);
      }
      await loadCliConfig();
      const { config, entities } = getConfig('gen');
      const settings = resolveConfig(config);
      const definition = await wizard(entities);
      if (options.dryRun) {
        await run([definition], [...entities, definition], settings, {
          dryRun: true,
          force: options.force,
        });
        p.log.info(
          `Dry run: ${entityNames(definition).name} was not added to ${ENTITIES_PATH}.`,
        );
        p.outro('Done.');
        return;
      }
      await appendEntity(new Project(), ENTITIES_PATH, definition);
      p.log.step(`Added ${entityNames(definition).name} to ${ENTITIES_PATH}.`);
      await run([definition], [...entities, definition], settings, {
        force: options.force,
      });
      p.outro('Done.');
    });

  return program;
}

const isDirectRun = (): boolean => {
  try {
    return fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? '');
  } catch {
    return false;
  }
};

if (isDirectRun()) {
  createGenCommand()
    .parseAsync(process.argv)
    .catch((error) => {
      if (error instanceof Error) {
        p.log.error(error.message);
      }
      process.exit(1);
    });
}
