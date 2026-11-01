import { writeFile } from 'node:fs/promises';
import * as p from '@clack/prompts';
import { Command } from 'commander';
import { check, exportSql, generate, pull } from 'drizzle-kit/cli';
import { getConfig, loadCliConfig, type DbCommandConfig } from '../config';
import { cancel } from '../tui/cancel';
import {
  databaseName,
  ensureDatabase,
  resetDatabase,
  runMigrations,
} from './db/database';
import { runSeed } from './db/seed';

interface DrizzleError {
  code: string;
  message?: string;
}

const formatDrizzleError = (error: DrizzleError): string =>
  `drizzle-kit: ${error.message ?? error.code}`;

const dbConfig = (): DbCommandConfig => getConfig('db');

export function createDbCommand(): Command {
  const db = new Command('db').description(
    'Database operations: generate, check, migrate, create, seed, reset, pull, export.',
  );

  db.command('generate')
    .description('Generate SQL migrations from the schema')
    .argument('[name]', 'migration name')
    .option('--ignore-conflicts', 'skip commutativity conflict checks')
    .action(
      async (
        name: string | undefined,
        options: { ignoreConflicts?: boolean },
      ) => {
        await loadCliConfig();
        const { dialect, schema, out } = dbConfig();
        const result = await generate({
          dialect,
          schema,
          out,
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
            `Run \`pnpm exec drizzle-kit generate --dialect=${dialect} --schema=${schema} --out=${out}\` and pick the renames/creates.`,
          );
        }
        p.log.success(
          'migration_path' in result && result.migration_path
            ? `Generated ${result.migration_path}.`
            : 'Migration generated.',
        );
      },
    );

  db.command('check')
    .description('Check migrations for collisions and consistency')
    .option('--ignore-conflicts', 'skip commutativity conflict checks')
    .action(async (options: { ignoreConflicts?: boolean }) => {
      await loadCliConfig();
      const { dialect, out } = dbConfig();
      const result = await check({
        dialect,
        out,
        ignoreConflicts: options.ignoreConflicts,
      });
      if (result.status !== 'ok') {
        throw new Error(formatDrizzleError(result.error));
      }
      p.log.success(`Migrations are consistent (${result.dialect}).`);
    });

  db.command('migrate')
    .description('Apply the pending migrations')
    .action(async () => {
      await loadCliConfig();
      const { url, out } = dbConfig();
      p.log.step(`Applying migrations from ${out}.`);
      await runMigrations(url, out);
      p.log.success('Migrations applied.');
    });

  db.command('create')
    .description('Create the database if missing, then apply migrations')
    .action(async () => {
      await loadCliConfig();
      const { url, out, maintenanceDatabase } = dbConfig();
      const { name, created } = await ensureDatabase(url, maintenanceDatabase);
      p.log.info(
        created
          ? `Created database "${name}".`
          : `Database "${name}" already exists.`,
      );
      p.log.step(`Applying migrations from ${out}.`);
      await runMigrations(url, out);
      p.log.success('Database is ready.');
    });

  db.command('seed')
    .description('Run the seed entry point via the configured package script')
    .action(async () => {
      await loadCliConfig();
      await runSeed(dbConfig().seedScript);
      p.log.success('Seed finished.');
    });

  db.command('reset')
    .description('Drop every table and re-apply migrations (dev only)')
    .option('--force', 'skip the confirmation prompt')
    .option('--seed', 'run the seed after migrating')
    .action(async (options: { force?: boolean; seed?: boolean }) => {
      await loadCliConfig();
      const { url, out, seedScript } = dbConfig();
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
      p.log.step(`Applying migrations from ${out}.`);
      await runMigrations(url, out);
      if (options.seed) await runSeed(seedScript);
      p.log.success('Database reset.');
    });

  db.command('pull')
    .description(
      'Introspect the database into schema files in the migrations folder (overwrites them)',
    )
    .action(async () => {
      await loadCliConfig();
      const { dialect, out, url } = dbConfig();
      const result = await pull({ dialect, out, url });
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

  db.command('export')
    .description('Print the SQL of the current schema (drizzle-kit export)')
    .option('--out <file>', 'write the SQL to a file instead of stdout')
    .action(async (options: { out?: string }) => {
      await loadCliConfig();
      const { dialect, schema } = dbConfig();
      const result = await exportSql({ dialect, schema, sql: true });
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
