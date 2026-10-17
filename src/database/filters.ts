import {
  eq,
  gt,
  gte,
  ilike,
  inArray,
  lt,
  lte,
  ne,
  type SQL,
} from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import type { FilterItem, FilterOperator, FilterValue } from './types.js';

/** The columns a repository accepts filters for, keyed by the API field name. */
export type FilterColumns = Record<string, PgColumn>;

/** Builds the Drizzle condition for one operator and value. */
export const filterCondition = (
  column: PgColumn,
  operator: FilterOperator,
  value: FilterValue,
): SQL<unknown> => {
  switch (operator) {
    case 'eq':
      return eq(column, value);
    case 'ne':
      return ne(column, value);
    case 'gt':
      return gt(column, value);
    case 'gte':
      return gte(column, value);
    case 'lt':
      return lt(column, value);
    case 'lte':
      return lte(column, value);
    case 'contains':
      return ilike(column, `%${String(value)}%`);
    case 'in':
      return inArray(column, Array.isArray(value) ? value : [value]);
  }
};

/**
 * Builds every condition of a `filters` payload against the columns the
 * repository exposes. Unknown fields are a programming error: the list-query
 * schema rejects them before a request reaches this point.
 */
export const buildFilterConditions = (
  columns: FilterColumns,
  filters: FilterItem[] = [],
): SQL<unknown>[] =>
  filters.map(({ field, operator, value }) => {
    const column = columns[field];
    if (!column) {
      throw new Error(`Unknown filter field "${field}"`);
    }
    return filterCondition(column, operator, value);
  });

/**
 * Parses the JSON-encoded `?filters=[{"field":"views","operator":"gte","value":10}]`
 * query value, then validates every item against the entity's item schema.
 */
export const filterItemsSchema = <T extends z.ZodType>(item: T) =>
  z
    .string()
    .transform((value, ctx) => {
      try {
        return JSON.parse(value) as unknown;
      } catch {
        ctx.addIssue({
          code: 'custom',
          message: 'filters must be a JSON array',
        });
        return z.NEVER;
      }
    })
    .pipe(z.array(item));
