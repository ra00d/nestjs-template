import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Client } from 'pg';
import type { DbCommandConfig } from '../../config';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import * as p from '@clack/prompts';

/** The database the connection string points at, without the leading slash. */
export const databaseName = (url: string): string =>
  decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));

/** The same connection, but against the maintenance database (for `CREATE DATABASE`). */
const maintenanceUrl = (url: string, database: string): string => {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
};

/** `CREATE DATABASE` when missing, so `db create` is idempotent. */
export const ensureDatabase = async (
  url: string,
  maintenanceDatabase = 'postgres',
): Promise<{ name: string; created: boolean }> => {
  const name = databaseName(url);
  if (!name) {
    throw new Error('DATABASE_URL names no database to create.');
  }
  const client = new Client({
    connectionString: maintenanceUrl(url, maintenanceDatabase),
  });
  await client.connect();
  try {
    const { rowCount } = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [name],
    );
    if (rowCount) return { name, created: false };
    await client.query(`CREATE DATABASE ${client.escapeIdentifier(name)}`);
    return { name, created: true };
  } finally {
    await client.end();
  }
};

/**
 * Drop the application schemas (`public` for the tables, `drizzle` for the
 * migration history) and recreate `public`, leaving the database empty.
 */
export const resetDatabase = async (url: string): Promise<void> => {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('DROP SCHEMA IF EXISTS "drizzle" CASCADE');
    await client.query('DROP SCHEMA IF EXISTS "public" CASCADE');
    await client.query('CREATE SCHEMA "public"');
  } finally {
    await client.end();
  }
};

const hasMigrations = (folder: string): boolean =>
  existsSync(folder) &&
  readdirSync(folder).some((entry) =>
    existsSync(join(folder, entry, 'migration.sql')),
  );

/** Apply the pending SQL migrations with the drizzle-orm migrator. */
export const runMigrations = async (
  url: string,
  migrationsFolder: string,
): Promise<void> => {
  if (existsSync(join(migrationsFolder, 'meta', '_journal.json'))) {
    throw new Error(
      `The migrations in "${migrationsFolder}" use the old drizzle-kit layout. Run \`drizzle-kit up\` to upgrade them.`,
    );
  }
  if (!hasMigrations(migrationsFolder)) {
    throw new Error(
      `No SQL migrations in "${migrationsFolder}". Generate them first: \`pnpm db generate\`.`,
    );
  }
  const db = drizzle(url);
  try {
    await migrate(db, { migrationsFolder });
  } finally {
    await db.$client.end();
  }
};

// export const generateMigration = async (
//   opts: Pick<DbCommandConfig, 'schema' | 'dialect' | 'out'> & {
//     name?: string;
//     ignoreConflicts?: boolean;
//   },
// ) => {
//   const { name, ignoreConflicts, schema, dialect, out } = opts;
//   const flags = [`--dialect=${dialect}`, ` --schema=${schema}`, `--out=${out}`];
//   if (name) {
//     flags.push(`--name=${name}`);
//   }
//   if (ignoreConflicts) {
//     flags.push('--ignore-conflicts');
//   }
//   const child = spawn('pnpm', ['exec', 'drizzle-kit', 'generate', ...flags], {
//     stdio: 'inherit',
//     shell: false,
//   });
//
//   child.on('exit', (code) => {
//     process.exitCode = code ?? 1;
//   });
// };
//
// export const pullSchema = async (
//   opts: Pick<DbCommandConfig, 'dialect' | 'out' | 'url'>,
// ) => {};
// export const exportSql = async (
//   opts: Pick<DbCommandConfig, 'dialect' | 'schema'>,
// ) => {};
// export const checkDB = async (
//   opts: Pick<DbCommandConfig, 'dialect' | 'url'> & {
//     ignoreConflicts?: boolean;
//   },
// ) => {};
//

type DrizzleCommand = 'generate' | 'pull' | 'export' | 'check';

const runDrizzleCommand = (
  command: DrizzleCommand,
  flags: string[] = [],
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', ['exec', 'drizzle-kit', command, ...flags], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');

    child.stdout.on('data', (data: string) => {
      stdout += data;
    });

    child.stderr.on('data', (data: string) => {
      stderr += data;
    });

    child.once('error', reject);
    child.once('close', (code, signal) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(
        new Error(
          signal
            ? `drizzle-kit ${command} terminated by signal ${signal}\n Error: ${stderr}`
            : `drizzle-kit ${command} exited with code ${code}\n Error: ${stderr}`,
        ),
      );
    });
  });
};

export const generateMigration = async (
  opts: Pick<DbCommandConfig, 'schema' | 'dialect' | 'out'> & {
    name?: string;
    ignoreConflicts?: boolean;
  },
) => {
  const { name, ignoreConflicts, schema, dialect, out } = opts;

  const flags = [`--dialect=${dialect}`, `--schema=${schema}`, `--out=${out}`];

  if (name) {
    flags.push(`--name=${name}`);
  }

  if (ignoreConflicts) {
    flags.push('--ignore-conflicts');
  }

  return runDrizzleCommand('generate', flags);
};

export const pullSchema = async (
  opts: Pick<DbCommandConfig, 'dialect' | 'out' | 'url'>,
) => {
  const { dialect, out, url } = opts;

  const flags = [`--dialect=${dialect}`, `--url=${url}`, `--out=${out}`];

  return runDrizzleCommand('pull', flags);
};

export const exportSql = async (
  opts: Pick<DbCommandConfig, 'dialect' | 'schema'> & { out?: string },
) => {
  const { dialect, schema, out } = opts;

  const flags = [`--dialect=${dialect}`, `--schema=${schema}`, '--sql=true'];

  const sql = await runDrizzleCommand('export', flags);
  if (out && typeof sql == 'string') {
    await writeFile(out, `${sql}\n`, 'utf8');
    return `Wrote sql statements to ${out}.`;
  }
};

export const checkDB = async (
  opts: Pick<DbCommandConfig, 'dialect'> &
    Partial<Pick<DbCommandConfig, 'out'>> & {
      ignoreConflicts?: boolean;
    },
) => {
  const { dialect, out, ignoreConflicts } = opts;

  const flags = [`--dialect=${dialect}`];

  if (out) {
    flags.push(`--out=${out}`);
  }

  if (ignoreConflicts) {
    flags.push('--ignore-conflicts');
  }

  return runDrizzleCommand('check', flags);
};
