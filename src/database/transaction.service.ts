import { InjectDrizzle } from '@nestjs/drizzle';
import { Injectable } from '@nestjs/common';
import type { DbOrTx, Tx, TxOptions } from './types.js';
import { withTx } from './transaction.js';

/**
 * NestJS-friendly transaction helper. Inject it wherever you need to group
 * multiple repository or service calls into a single unit of work.
 *
 * @example
 * ```ts
 * await this.transactionService.transaction(async (tx) => {
 *   const user = await this.users.create(email, { passwordHash }, tx);
 *   await this.audit.log({ action: 'user.registered', entity: 'user' }, tx);
 *   return user;
 * });
 * ```
 */
@Injectable()
export class TransactionService {
  constructor(@InjectDrizzle() private readonly db: DbOrTx) {}

  /** Run `fn` inside a transaction with the options forwarded to PostgreSQL. */
  transaction<T>(
    fn: (tx: Tx) => Promise<T>,
    options?: TxOptions,
  ): Promise<T> {
    return this.run(fn, options);
  }

  run<T>(fn: (tx: Tx) => Promise<T>, options?: TxOptions): Promise<T> {
    return withTx(this.db, fn, options);
  }

  runInTransaction<T>(
    fn: (tx: Tx) => Promise<T>,
    options?: TxOptions,
  ): Promise<T> {
    return this.run(fn, options);
  }

  withTx<T>(fn: (tx: Tx) => Promise<T>, options?: TxOptions): Promise<T> {
    return this.run(fn, options);
  }

  withTransaction<T>(fn: (tx: Tx) => Promise<T>, options?: TxOptions): Promise<T> {
    return this.run(fn, options);
  }

  execute<T>(fn: (tx: Tx) => Promise<T>, options?: TxOptions): Promise<T> {
    return this.run(fn, options);
  }
}
