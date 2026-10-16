import { writeFile } from 'node:fs/promises';
import * as p from '@clack/prompts';
import { Command } from 'commander';
import { check, exportSql, generate, pull } from 'drizzle-kit/cli';
import { getConfig, loadCliConfig, type DbCommandConfig } from '../config.ts';
import { cancel } from '../tui/cancel.ts';
import { loadDatabaseConfig } from './db/config.ts';
import {
  databaseName,
  ensureDatabase,
  resetDatabase,
  runMigrations,
} from './db/database.ts';
import { runSeed } from './db/seed.ts';

interface DrizzleError {
  code: string;
  message?: string;
}

const formatDrizzleError = (error: DrizzleError): string =>
  `drizzle-kit: ${error.message ?? error.code}`;

const dbConfig = (): DbCommandConfig => getConfig('db');

const configPath = (options: { config?: string }): string =>
  options.config ?? dbConfig().config;

/** Every subcommand that reads drizzle.config.ts accepts `--config`. */
const withConfigOption = (command: Command): Command =>
  command.option(
    '--config <path>',
    'drizzle-kit config file (default: db.config in cli.config.ts)',
  );

export function createDbCommand(): Command {
  const db = new Command('db').description(
    'Database operations: generate, check, migrate, create, seed, reset, pull, export.',
  );

  withConfigOption(
    db
      .command('generate')
      .description('Generate SQL migrations from the schema')
      .argument('[name]', 'migration name')
      .option('--ignore-conflicts', 'skip commutativity conflict checks'),
  ).action(
    async (
      name: string | undefined,
      options: { config?: string; ignoreConflicts?: boolean },
    ) => {
      await loadCliConfig();
      const result = await generate({
        config: configPath(options),
        name,
        ignoreConflicts: options.ignoreConflicts,
      });
      if (result.status === 'error') {
        throw new Error(formatDrizzleError(result.error));
      }
      if (result.status === 'no_changes') {
        p.log.info('No schema changes; nothing to generate.');
        return;
      }
      if (result.status === 'missing_hints') {
        p.log.warn('drizzle-kit needs hints to resolve ambiguous changes:');
        p.log.message(JSON.stringify(result.unresolved, null, 2));
        throw new Error(
          'Run the interactive `pnpm db:generate` and pick the renames/creates.',
        );
      }
      p.log.success(
        'migration_path' in result && result.migration_path
          ? `Generated ${result.migration_path}.`
          : 'Migration generated.',
      );
    },
  );

  withConfigOption(
    db
      .command('check')
      .description('Check migrations for collisions and consistency')
      .option('--ignore-conflicts', 'skip commutativity conflict checks'),
  ).action(async (options: { config?: string; ignoreConflicts?: boolean }) => {
    await loadCliConfig();
    const result = await check({
      config: configPath(options),
      ignoreConflicts: options.ignoreConflicts,
    });
    if (result.status !== 'ok') {
      throw new Error(formatDrizzleError(result.error));
    }
    p.log.success(`Migrations are consistent (${result.dialect}).`);
  });

  withConfigOption(
    db.command('migrate').description('Apply the pending migrations'),
  ).action(async (options: { config?: string }) => {
    await loadCliConfig();
    const { url, migrationsFolder } = await loadDatabaseConfig(
      configPath(options),
    );
    p.log.step(`Applying migrations from ${migrationsFolder}.`);
    await runMigrations(url, migrationsFolder);
    p.log.success('Migrations applied.');
  });

  withConfigOption(
    db
      .command('create')
      .description('Create the database if missing, then apply migrations'),
  ).action(async (options: { config?: string }) => {
    await loadCliConfig();
    const { url, migrationsFolder } = await loadDatabaseConfig(
      configPath(options),
    );
    const { name, created } = await ensureDatabase(
      url,
      dbConfig().maintenanceDatabase,
    );
    p.log.info(
      created
        ? `Created database "${name}".`
        : `Database "${name}" already exists.`,
    );
    p.log.step(`Applying migrations from ${migrationsFolder}.`);
    await runMigrations(url, migrationsFolder);
    p.log.success('Database is ready.');
  });

  db.command('seed')
    .description('Run the seed entry point via the configured package script')
    .action(async () => {
      await loadCliConfig();
      await runSeed(dbConfig().seedScript);
      p.log.success('Seed finished.');
    });

  withConfigOption(
    db
      .command('reset')
      .description('Drop every table and re-apply migrations (dev only)')
      .option('--force', 'skip the confirmation prompt')
      .option('--seed', 'run the seed after migrating'),
  ).action(
    async (options: { config?: string; force?: boolean; seed?: boolean }) => {
      await loadCliConfig();
      const { url, migrationsFolder } = await loadDatabaseConfig(
        configPath(options),
      );
      const name = databaseName(url);
      if (!options.force) {
        if (!process.stdin.isTTY) {
          throw new Error(
            'Reset deletes every table; pass --force when there is no TTY.',
          );
        }
        const confirmed = await p.confirm({
          message: `Drop every table in "${name}" and re-apply migrations?`,
          initialValue: false,
        });
        if (p.isCancel(confirmed) || !confirmed) cancel();
      }
      p.log.step(`Dropping the "public" and "drizzle" schemas in "${name}".`);
      await resetDatabase(url);
      p.log.step(`Applying migrations from ${migrationsFolder}.`);
      await runMigrations(url, migrationsFolder);
      if (options.seed) await runSeed(dbConfig().seedScript);
      p.log.success('Database reset.');
    },
  );

  withConfigOption(
    db
      .command('pull')
      .description(
        'Introspect the database into schema files in the migrations folder (overwrites them)',
      ),
  ).action(async (options: { config?: string }) => {
    await loadCliConfig();
    const result = await pull({ config: configPath(options) });
    if (result.status !== 'ok') {
      throw new Error(formatDrizzleError(result.error));
    }
    p.log.success(`Schema written to ${result.schemaPath}.`);
    if (result.relationsPath) {
      p.log.message(`Relations: ${result.relationsPath}`);
    }
    p.log.message(`Snapshot: ${result.snapshotPath}`);
    if (result.migrationPath) {
      p.log.message(`Migration: ${result.migrationPath}`);
    }
  });

  withConfigOption(
    db
      .command('export')
      .description('Print the SQL of the current schema (drizzle-kit export)')
      .option('--out <file>', 'write the SQL to a file instead of stdout'),
  ).action(async (options: { config?: string; out?: string }) => {
    await loadCliConfig();
    const result = await exportSql({ config: configPath(options), sql: true });
    if (result.status !== 'ok') {
      throw new Error(formatDrizzleError(result.error));
    }
    for (const warning of result.warnings) {
      console.error(`Warning: ${warning}`);
    }
    const sql = result.statements.join('\n');
    if (options.out) {
      await writeFile(options.out, `${sql}\n`, 'utf8');
      p.log.success(
        `Wrote ${result.statements.length} statements to ${options.out}.`,
      );
      return;
    }
    process.stdout.write(`${sql}\n`);
  });

  return db;
}
