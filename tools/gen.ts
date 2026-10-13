#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Scopes a NestJS module out of tools/entities.ts.
 *
 *   pnpm gen                 generate all defined entities
 *   pnpm gen posts comments   the named entities
 *   pnpm gen add             interactive wizard to define a new entity
 *   pnpm gen --list          defined entities and their files
 *   pnpm gen --dry-run       print the plan, write nothing
 *   pnpm gen --force         overwrite files from earlier runs
 *
 * Run by Node's built-in type stripping, so this file (and everything in
 * tools/) sticks to erasable syntax: no enums, namespaces, or parameter
 * properties.
 */
import { existsSync } from 'node:fs';
import * as p from '@clack/prompts';
import { Command } from 'commander';
import { Project } from 'ts-morph';
import { appendEntity } from './lib/append-entity.ts';
import { SCHEMA_BARREL } from './lib/edit-targets.ts';
import { resolveConfig } from './lib/config.ts';
import { entityNames } from './lib/names.ts';
import { buildPlan } from './lib/plan.ts';
import { applyPlan } from './lib/apply.ts';
import type { FieldType } from './lib/types.ts';
import type { EntityDefinition, FieldDefinition, RelationDefinition } from './lib/types.ts';
import { entities } from './entities.ts';
import { config as userConfig } from './gen.config.ts';

const settings = resolveConfig(userConfig);

const ENTITIES_PATH = 'tools/entities.ts';
const APP_MODULE_PATH = 'src/app.module.ts';

const FIELD_TYPES: { value: FieldType; label: string; hint?: string }[] = [
  { value: 'text', label: 'text', hint: 'string column, ilike search' },
  { value: 'uuid', label: 'uuid' },
  { value: 'integer', label: 'integer', hint: 'whole number' },
  { value: 'boolean', label: 'boolean' },
  { value: 'timestamp', label: 'timestamp', hint: 'timestamptz' },
  { value: 'enum', label: 'enum', hint: 'text column restricted to values' },
  { value: 'jsonb', label: 'jsonb', hint: 'structured column, not filterable' },
];

const cancel = (): never => {
  p.cancel('Aborted.');
  return process.exit(0);
};

const askField = async (): Promise<FieldDefinition> => {
  const name = await p.text({ message: 'Field name (camelCase)', placeholder: 'title', defaultValue: 'title' });
  if (p.isCancel(name)) cancel();
  if (!/^[a-z][A-Za-z0-9]*$/.test(String(name))) {
    p.log.error('Names must be camelCase, e.g. "authorId".');
    return askField();
  }
  const type = await p.select({ message: 'Field type', options: FIELD_TYPES });
  if (p.isCancel(type)) cancel();
  if (type === 'enum') {
    const values = await p.text({ message: 'Enum values, comma-separated', placeholder: 'draft, published' });
    if (p.isCancel(values)) cancel();
    const list = String(values)
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (list.length === 0) {
      p.log.error('An enum field needs at least one value.');
      return askField();
    }
    return { name: String(name), type, values: list };
  }
  const required = await p.confirm({ message: 'Required?', initialValue: true });
  if (p.isCancel(required)) cancel();
  const searchable = await p.confirm({ message: 'Searchable through ?search=?', initialValue: false });
  if (p.isCancel(searchable)) cancel();
  const field: FieldDefinition = { name: String(name), type: type as FieldType, required: Boolean(required) };
  if (searchable) field.searchable = true;
  return field;
};

const askRelation = async (tables: string[]): Promise<RelationDefinition> => {
  const name = await p.text({ message: 'Relation name', placeholder: 'author' });
  if (p.isCancel(name)) cancel();
  const kind = await p.select({
    message: 'Relation kind',
    options: [
      { value: 'one', label: 'one', hint: 'this table holds the foreign key' },
      { value: 'many', label: 'many', hint: 'the other table points back here' },
    ],
  });
  if (p.isCancel(kind)) cancel();
  if (kind === 'one') {
    const target = await p.select({ message: 'Points at table', options: tables.map((table) => ({ value: table, label: table })) });
    if (p.isCancel(target)) cancel();
    const field = await p.text({ message: 'Foreign key field on this table', placeholder: `${singular(String(target))}Id` });
    if (p.isCancel(field)) cancel();
    return { name: String(name), type: 'one', field: String(field), references: `${String(target)}.id` };
  }
  const target = await p.select({
    message: 'Points at table',
    options: entities.map((entity) => ({ value: entityNames(entity).name, label: entityNames(entity).name })),
  });
  if (p.isCancel(target)) cancel();
  const foreignKey = await p.text({ message: 'Foreign key on the target table', placeholder: `${singular(String(name))}Id` });
  if (p.isCancel(foreignKey)) cancel();
  return { name: String(name), type: 'many', target: String(target), foreignKey: String(foreignKey) };
};

const singular = (value: string): string => (value.endsWith('s') ? value.slice(0, -1) : value);

const wizard = async (): Promise<EntityDefinition> => {
  p.intro('Scaffold a module');
  const name = await p.text({ message: 'Entity name (plural)', placeholder: 'posts' });
  if (p.isCancel(name)) cancel();
  const entityName = String(name).trim();
  if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(entityName)) {
    p.log.error('Use lowercase kebab-case names like "email-tokens".');
    return cancel();
  }
  if (entities.some((entity) => entityNames(entity).name === entityName)) {
    p.log.error(`${entityName} is already defined in ${ENTITIES_PATH}.`);
    return cancel();
  }

  const fields: FieldDefinition[] = [];
  for (;;) {
    const field = await askField();
    if (fields.some((existing) => existing.name === field.name)) {
      p.log.warn(`Skipped duplicate field ${field.name}.`);
      continue;
    }
    fields.push(field);
    const more = await p.confirm({ message: 'Add another field?', initialValue: true });
    if (p.isCancel(more)) cancel();
    if (!more) break;
  }

  const relations: RelationDefinition[] = [];
  const tables = ['users', ...entities.map((entity) => entityNames(entity).name)];
  for (;;) {
    const add = await p.confirm({ message: 'Add a relation?', initialValue: relations.length === 0 });
    if (p.isCancel(add)) cancel();
    if (!add) break;
    const relation = await askRelation(tables);
    if (relation.type === 'one' && !fields.some((field) => field.name === relation.field)) {
      const [target] = relation.references.split('.');
      fields.push({ name: relation.field, type: 'text', references: relation.references, filterable: false });
      p.log.info(`Added the ${relation.field} field, referencing ${target}.id.`);
    }
    relations.push(relation);
  }

  const timestamps = await p.confirm({ message: 'Add createdAt/updatedAt columns?', initialValue: true });
  if (p.isCancel(timestamps)) cancel();
  const isPublic = await p.confirm({ message: 'Public routes (@Public())?', initialValue: false });
  if (p.isCancel(isPublic)) cancel();

  const definition: EntityDefinition = { name: entityName, fields, relations, timestamps: Boolean(timestamps), public: Boolean(isPublic) };
  p.note(
    `${entityName}\n${fields.map((field) => `  ${field.name}: ${field.type}`).join('\n')}${
      relations.length > 0 ? relations.map((relation) => `  -> ${relation.name}: ${relation.type}`).join('\n') : ''
    }`,
    'Entity preview',
  );
  const confirmed = await p.confirm({ message: 'Generate this module?', initialValue: true });
  if (p.isCancel(confirmed)) cancel();
  if (!confirmed) return cancel();

  return definition;
};

const planLines = (definitions: EntityDefinition[], force: boolean): string[] => {
  const lines: string[] = [];
  for (const entity of definitions) {
    const { name, dir } = entityNames(entity);
    lines.push(`${name}  (${settings.modulesDir}/${dir}/)`);
    for (const file of buildPlan([entity], entities, settings)[0].files) {
      const state = existsSync(file.path) ? (force ? 'overwrite' : 'skip (exists)') : 'create';
      lines.push(`  [${state}] ${file.path}`);
    }
  }
  lines.push(`[edit]     ${SCHEMA_BARREL}`);
  lines.push(`[edit]     ${APP_MODULE_PATH}`);
  return lines;
};

const run = async (
  definitions: EntityDefinition[],
  allEntities: EntityDefinition[],
  options: { dryRun?: boolean; force?: boolean },
): Promise<void> => {
  const plans = buildPlan(definitions, allEntities, settings);
  const lines = planLines(definitions, Boolean(options.force));
  if (options.dryRun) {
    p.note(lines.join('\n'), 'Dry run');
    return;
  }

  const spinner = p.spinner();
  spinner.start(`Scaffolding ${plans.length} ${plans.length === 1 ? 'module' : 'modules'}...`);
  let result: Awaited<ReturnType<typeof applyPlan>>;
  try {
    result = await applyPlan(plans, { force: Boolean(options.force), entities: allEntities, settings });
  } catch (error) {
    spinner.stop('Failed.');
    throw error;
  }
  spinner.stop('Done.');

  const created = result.changes.filter((change) => change.action === 'created').length;
  const skipped = result.changes.filter((change) => change.action === 'skipped').length;
  p.note(
    [
      ...result.changes.map((change) => `[${change.action}] ${change.path}`),
      ...result.edited.map((path) => `[edited] ${path}`),
    ].join('\n'),
    'Changes',
  );
  if (skipped > 0) {
    p.log.warn(`${skipped} file${skipped === 1 ? '' : 's'} already exist. Use --force to overwrite them.`);
  }
  if (created > 0 && result.edited.includes(SCHEMA_BARREL)) {
    p.log.info('New tables were added under each module’s db/ folder and wired into src/db-schema.ts.');
  }
  for (const warning of result.warnings) {
    p.log.warn(warning);
  }
};

const program = new Command();
program
  .name('gen')
  .description('Scaffold NestJS modules from tools/entities.ts into src/.')
  .argument('[entities...]', 'entity names to generate; all of them when omitted')
  .option('--dry-run', 'print the plan without writing files')
  .option('--force', 'overwrite files from earlier runs')
  .option('--list', 'list the defined entities and their files')
  .action(async (names: string[], options: { dryRun?: boolean; force?: boolean; list?: boolean }) => {
    if (options.list) {
      p.intro('tools/entities.ts');
      if (entities.length === 0) {
        p.log.info('No entities defined. Run `pnpm gen add` for the interactive wizard.');
      }
      for (const entity of entities) {
        const names2 = entityNames(entity);
        p.log.message(`${names2.name}  ->  ${names2.plural}Module at @Controller('${names2.route}')`);
        for (const file of buildPlan([entity], entities, settings)[0].files) {
          p.log.message(`  ${file.path}`);
        }
      }
      p.outro(`${entities.length} ${entities.length === 1 ? 'entity' : 'entities'} defined.`);
      return;
    }

    const requested = names.length > 0 ? names : entities.map((entity) => entityNames(entity).name);
    const selected = entities.filter((entity) => requested.includes(entityNames(entity).name));
    if (names.length > 0) {
      for (const name of names) {
        if (!entities.some((entity) => entityNames(entity).name === name)) {
          p.log.error(`Unknown entity "${name}". Defined: ${entities.map((entity) => entityNames(entity).name).join(', ') || 'none'}.`);
          process.exit(1);
        }
      }
    }
    if (selected.length === 0) {
      p.log.error('No entities defined. Add one to tools/entities.ts or run `pnpm gen add` for the interactive wizard.');
      process.exit(1);
    }
    p.intro('Scaffolding modules');
    await run(selected, entities, { dryRun: options.dryRun, force: options.force });
    p.outro('Done.');
  });

program
  .command('add')
  .description('Add a new entity to tools/entities.ts via the interactive wizard')
  .option('--dry-run', 'print the plan without writing files')
  .option('--force', 'overwrite files from earlier runs')
  .action(async (options: { dryRun?: boolean; force?: boolean }) => {
    if (!process.stdin.isTTY) {
      p.log.error('The interactive wizard needs a TTY. Define the entity in tools/entities.ts instead.');
      process.exit(1);
    }
    const definition = await wizard();
    if (options.dryRun) {
      await run([definition], [...entities, definition], { dryRun: true, force: options.force });
      p.log.info(`Dry run: ${entityNames(definition).name} was not added to ${ENTITIES_PATH}.`);
      p.outro('Done.');
      return;
    }
    await appendEntity(new Project(), ENTITIES_PATH, definition);
    p.log.step(`Added ${entityNames(definition).name} to ${ENTITIES_PATH}.`);
    await run([definition], [...entities, definition], { force: options.force });
    p.outro('Done.');
  });

program.parseAsync(process.argv).catch((error) => {
  if (error instanceof Error) {
    p.log.error(error.message);
  }
  process.exit(1);
});
