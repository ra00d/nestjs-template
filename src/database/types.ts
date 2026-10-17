import type { EmptyRelations } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { NodePgTransaction } from 'drizzle-orm/node-postgres';
import type { PgTransactionConfig } from 'drizzle-orm/pg-core';

/**
 * The Drizzle database attached through `DrizzleModule`. Use this when a
 * repository or service does not care whether it runs on a database or
 * inside a transaction.
 */
export type Db = NodePgDatabase<EmptyRelations>;

/**
 * A transaction created by `Db.transaction()`. Transactional reads and
 * writes use this type.
 */
export type Tx = NodePgTransaction<EmptyRelations>;

/** Anything a repository can query against. */
export type DbOrTx = Db | Tx;

/** PostgreSQL transaction options forwarded to `BEGIN ...`. */
export type TxConfig = PgTransactionConfig;

export type IsolationLevel = PgTransactionConfig['isolationLevel'];

export interface TxOptions {
  /** forwarded to Drizzle as `isolationLevel` */
  isolationLevel?: IsolationLevel;
  /** forwarded to Drizzle as `accessMode` */
  accessMode?: PgTransactionConfig['accessMode'];
  /** forwarded to Drizzle as `deferrable` */
  deferrable?: PgTransactionConfig['deferrable'];
}

/**
 * Branding symbol used by {@link markTx} / {@link isTx} to tell a transaction
 * created by this helper from a plain database client.
 */
export const TX_MARKER: unique symbol = Symbol('nestjs-template.transaction');

export function markTx<T extends Tx>(tx: T): T {
  (tx as Record<symbol, unknown>)[TX_MARKER] = true;
  return tx;
}

export function isTx(value: unknown): value is Tx {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<symbol, unknown>)[TX_MARKER] === true
  );
}

/*
 * Filtering types
 */
/** Operators accepted by a {@link FilterItem}, e.g. `{ field: 'views', operator: 'gte', value: 10 }`. */
export type FilterOperator =
  'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in';

/**
 * A filter value. `in` carries an array; timestamps may arrive as ISO strings
 * and are coerced to `Date` by the list-query schema before reaching a
 * repository.
 */
export type FilterValue =
  | string
  | number
  | boolean
  | Date
  | ReadonlyArray<string | number | Date>
  | string[];

export type FilterItem = {
  field: string;
  operator: FilterOperator;
  value: FilterValue;
};
