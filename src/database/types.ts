import { relations } from '@/db';
import { Brand } from '@/types';
import type { SQL, SQLWrapper } from 'drizzle-orm';
import type {
  NodePgDatabase,
  NodePgTransaction,
} from 'drizzle-orm/node-postgres';
import type {
  AnyPgColumn,
  PgTable,
  PgTableWithColumns,
  PgTransactionConfig,
  TableConfig,
} from 'drizzle-orm/pg-core';

/**
 * The Drizzle database attached through `DrizzleModule`. Use this when a
 * repository or service does not care whether it runs on a database or
 * inside a transaction.
 */
export type DB = NodePgDatabase<typeof relations>;

/**
 * A transaction created by `Db.transaction()`. Transactional reads and
 * writes use this type.
 */
export type Tx = NodePgTransaction<typeof relations>;

/** Anything a repository can query against. */
export type DbOrTx = DB | Tx;

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

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */
/** Tables managed by this repository must have an `id` primary key. */
export type TableWithId = PgTable & {
  id: any;
};

export type ColumnLike = Brand<any, 'Column'>; // structural constraint kept loose — see note below

export type Select<
  S extends PgTable,
  T extends PgTableWithColumns<S['_']> = PgTableWithColumns<S['_']>,
> = T['$inferSelect'];
export type Insert<
  S extends PgTable,
  T extends PgTableWithColumns<S['_']> = PgTableWithColumns<S['_']>,
> = T['$inferInsert'];

export type Id = string | number;

export interface OrderByItem<T extends TableWithId> {
  /** Must be a column of the table — fully type-checked. */
  column: T[keyof T];
  direction: 'asc' | 'desc';
}

export interface ListParams<T extends TableWithId> {
  where?: SQL;
  orderBy?: OrderByItem<T>[];
  limit?: number;
  offset?: number;
}

export interface CursorParams<T extends TableWithId> extends Omit<
  ListParams<T>,
  'offset'
> {
  /** Pass the `nextCursor` from the previous page to get the next page. */
  cursor?: unknown;
  /** Column the cursor refers to. Defaults to `id`. */
  cursorColumn?: T[keyof T];
}

export interface Page<T> {
  rows: T[];
  /** Pass this as `cursor` to fetch the next page. `null` when exhausted. */
  nextCursor?: unknown;
}

export interface BaseRepoOptions {
  /** Human-readable name for error messages. Defaults to the table name. */
  entityName?: string;
  /**
   * Name of the `updatedAt` timestamp column, if the table has one.
   * When set, `updateById`/`update` stamp it automatically.
   */
  updatedAtColumn?: keyof PgTable; // e.g. 'updatedAt'
}
