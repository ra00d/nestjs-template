import type { EmptyRelations } from 'drizzle-orm';
import type { NodePgTransaction } from 'drizzle-orm/node-postgres';
import type { DbOrTx, Tx, TxConfig, TxOptions } from './types.js';
import { isTx, markTx } from './types.js';

/** Drop undefined transaction options so Drizzle receives a clean config. */
export function toTxConfig(options?: TxOptions): TxConfig | undefined {
  if (!options) return undefined;
  const config: TxConfig = {};
  if (options.isolationLevel !== undefined) config.isolationLevel = options.isolationLevel;
  if (options.accessMode !== undefined) config.accessMode = options.accessMode;
  if (options.deferrable !== undefined) config.deferrable = options.deferrable;
  return Object.keys(config).length > 0 ? config : undefined;
}

/**
 * Run `fn` inside a transaction.
 *
 * - When given the top-level database (`Db`), `fn` receives a fresh transaction
 *   and the transaction is committed on success / rolled back on throw. Options
 *   are forwarded to PostgreSQL (`BEGIN ... ISOLATION LEVEL ...`).
 * - When given an existing transaction (`Tx`), `fn` runs in a nested
 *   savepoint (Drizzle `tx.transaction()`) and options are ignored, since
 *   savepoints cannot change isolation level.
 *
 * Transactions returned by `withTx` are marked with {@link TX_MARKER}, so nested
 * calls keep sharing the same outer transaction.
 */
export async function withTx<T>(
  runner: DbOrTx,
  fn: (tx: Tx) => Promise<T>,
  options?: TxOptions,
): Promise<T> {
  if (isTx(runner)) {
    return runner.transaction(async (nested: NodePgTransaction<EmptyRelations>) => {
      markTx(nested as Tx);
      return fn(nested as Tx);
    });
  }

  const config = toTxConfig(options);
  return runner.transaction(async (tx: NodePgTransaction<EmptyRelations>) => {
    markTx(tx as Tx);
    return fn(tx as Tx);
  }, config);
}

/** Alias kept for clarity at call sites. */
export const withTransaction = withTx;
export const runInTransaction = withTx;

export { isTx, markTx };