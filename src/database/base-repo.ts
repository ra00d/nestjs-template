import { eq, asc, desc, sql, type SQL } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import {
  BaseRepoOptions,
  CursorParams,
  Id,
  Insert,
  ListParams,
  Page,
  Select,
  TableWithId,
  Tx,
} from './types';

export class NotFoundError extends Error {
  constructor(entity: string, id: unknown) {
    super(`${entity} with id ${String(id)} not found`);
    this.name = 'NotFoundError';
  }
}

/* ------------------------------------------------------------------ */
/* Base Repository                                                     */
/* ------------------------------------------------------------------ */

export class BaseRepository<TTable extends TableWithId> {
  protected readonly entityName: string;
  protected readonly updatedAtColumn?: string;

  constructor(
    /** Exposed so derived repos can reference columns: `this.table.id` etc. */
    public readonly table: TTable,
    protected readonly dbInstance: any /*DB | Tx*/,
    options: BaseRepoOptions = {},
  ) {
    this.entityName =
      // options.entityName ??
      // (table as unknown as { [TableSymbolName]: string })[TableSymbolName] ??
      'Entity';
    this.updatedAtColumn = options.updatedAtColumn as string | undefined;
  }

  /* ------------------------------ Create ------------------------------ */

  async create(data: Insert<TTable>): Promise<Select<TTable>> {
    const [row] = await this.dbInstance
      .insert(this.table)
      .values(data)
      .returning();
    return row;
  }

  async createMany(data: Insert<TTable>[]): Promise<Select<TTable>[]> {
    return this.dbInstance.insert(this.table).values(data).returning();
  }

  /**
   * Insert or update when the id already exists.
   * `data` must include the primary key.
   */
  async upsertById(data: Insert<TTable> & { id: Id }): Promise<Select<TTable>> {
    const [row] = await this.dbInstance
      .insert(this.table)
      .values(data)
      .onConflictDoUpdate({ target: this.table.id, set: data })
      .returning();
    return row;
  }

  /* ------------------------------- Read ------------------------------- */

  async findById(id: Id): Promise<Select<TTable> | undefined> {
    const [row] = await this.dbInstance
      .select()
      .from(this.table)
      .where(eq(this.table.id, id))
      .limit(1);
    return row;
  }

  async findByIdOrThrow(id: Id): Promise<Select<TTable>> {
    const row = await this.findById(id);
    if (!row) throw new NotFoundError(this.entityName, id);
    return row;
  }

  async findOne(where: SQL): Promise<Select<TTable> | undefined> {
    const [row] = await this.dbInstance
      .select()
      .from(this.table)
      .where(where)
      .limit(1);
    return row;
  }

  async findOneOrThrow(where: SQL): Promise<Select<TTable>> {
    const row = await this.findOne(where);
    if (!row) throw new NotFoundError(this.entityName, '<filtered>');
    return row;
  }

  async findMany(params: ListParams<TTable> = {}): Promise<Select<TTable>[]> {
    let query = this.dbInstance.select().from(this.table).$dynamic();

    if (params.where) query = query.where(params.where);
    if (params.orderBy?.length) {
      query = query.orderBy(
        ...params.orderBy.map((o) =>
          o.direction === 'asc' ? asc(o.column) : desc(o.column),
        ),
      );
    }
    return query.limit(params.limit ?? 50).offset(params.offset ?? 0);
  }

  /**
   * Keyset (cursor) pagination. Fetches `limit + 1` rows to detect the
   * end of the result set. Use this for infinite-scroll / large tables —
   * offset pagination degrades badly past a few thousand rows.
   */
  async findManyCursor(
    params: CursorParams<TTable> = {},
  ): Promise<Page<Select<TTable>>> {
    const limit = params.limit ?? 50;
    const cursorColumn = (params.cursorColumn ??
      this.table.id) as TTable[keyof TTable];
    const direction = params.orderBy?.[0]?.direction ?? 'asc';
    const comparator = direction === 'desc' ? sql`<` : sql`>`;

    let query = this.dbInstance.select().from(this.table).$dynamic();

    if (params.where) query = query.where(params.where);
    if (params.cursor != null) {
      query = query.where(sql`${cursorColumn} ${comparator} ${params.cursor}`);
    }
    if (params.orderBy?.length) {
      query = query.orderBy(
        ...params.orderBy.map((o) =>
          o.direction === 'asc' ? asc(o.column) : desc(o.column),
        ),
      );
    } else {
      query = query.orderBy(asc(cursorColumn));
    }

    const rows = await query.limit(limit + 1);
    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;

    return {
      rows: pageRows,
      nextCursor: hasMore
        ? (pageRows[pageRows.length - 1] as Record<string, unknown>)[
            (params.cursorColumn as unknown as string) ?? 'id'
          ]
        : null,
    };
  }

  async count(where?: SQL): Promise<number> {
    const [result] = await this.dbInstance
      .select({ value: sql<number>`count(*)` })
      .from(this.table)
      .where(where);
    return Number(result?.value ?? 0);
  }

  async exists(where: SQL): Promise<boolean> {
    return (await this.count(where)) > 0;
  }

  /* ------------------------------ Update ------------------------------ */

  async updateById(
    id: Id,
    data: Partial<Insert<TTable>>,
  ): Promise<Select<TTable> | undefined> {
    const [row] = await this.dbInstance
      .update(this.table)
      .set(this.withTimestamp(data))
      .where(eq(this.table.id, id))
      .returning();
    return row;
  }

  async updateByIdOrThrow(
    id: Id,
    data: Partial<Insert<TTable>>,
  ): Promise<Select<TTable>> {
    const row = await this.updateById(id, data);
    if (!row) throw new NotFoundError(this.entityName, id);
    return row;
  }

  async update(
    where: SQL,
    data: Partial<Insert<TTable>>,
  ): Promise<Select<TTable>[]> {
    return this.dbInstance
      .update(this.table)
      .set(this.withTimestamp(data))
      .where(where)
      .returning();
  }

  /* ------------------------------ Delete ------------------------------ */

  async deleteById(id: Id): Promise<boolean> {
    const result = await this.dbInstance
      .delete(this.table)
      .where(eq(this.table.id, id))
      .returning({ id: this.table.id });
    return result.length > 0;
  }

  async deleteMany(where: SQL): Promise<number> {
    const rows = await this.dbInstance
      .delete(this.table)
      .where(where)
      .returning({ id: this.table.id });
    return rows.length;
  }

  /* --------------------------- Transactions --------------------------- */

  /**
   * Returns a clone of this repository bound to a transaction,
   * so every write participates in it.
   *
   *   await db.transaction(async (tx) => {
   *     const users = userRepo.withTx(tx);
   *     await users.create({ ... });
   *   });
   */
  withTx(tx: Tx): this {
    const Ctor = this.constructor as new (
      table: TTable,
      // FIXME: add types
      dbInstance: any, // DB | Tx,
      options: BaseRepoOptions,
    ) => this;
    return new Ctor(this.table, tx, {
      entityName: this.entityName,
      updatedAtColumn: this.updatedAtColumn as keyof PgTable,
    });
  }

  /* ---------------------------- Escape hatch --------------------------- */

  /**
   * Direct access to the query builder for cases the generic layer
   * doesn't cover (joins, groupBy, aggregates). Prefer adding a named
   * method in the derived repository over using this at call sites.
   */
  get queryBuilder() {
    return this.dbInstance.select().from(this.table).$dynamic();
  }

  /* ------------------------------ Internal ----------------------------- */

  protected withTimestamp(
    data: Partial<Insert<TTable>>,
  ): Partial<Insert<TTable>> {
    if (!this.updatedAtColumn) return data;
    return { ...data, [this.updatedAtColumn]: new Date() } as Partial<
      Insert<TTable>
    >;
  }
}
