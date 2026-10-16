import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Client } from 'pg';

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
