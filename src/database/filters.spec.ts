import { SQL } from 'drizzle-orm';
import { integer, PgDialect, pgTable, text } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { buildFilterConditions, filterItemsSchema } from './filters';

const items = pgTable('items', {
  name: text('name'),
  views: integer('views'),
});

// The shape a generated list-query builds per entity: fields, their allowed
// operators, and the value type each operator expects.
const itemSchema = z.union([
  z.object({
    field: z.literal('name'),
    operator: z.enum(['eq', 'ne', 'contains']),
    value: z.string(),
  }),
  z.object({
    field: z.literal('name'),
    operator: z.literal('in'),
    value: z.array(z.string()),
  }),
  z.object({
    field: z.literal('views'),
    operator: z.enum(['eq', 'ne', 'gt', 'gte', 'lt', 'lte']),
    value: z.coerce.number().int(),
  }),
  z.object({
    field: z.literal('views'),
    operator: z.literal('in'),
    value: z.array(z.coerce.number().int()),
  }),
]);

const dialect = new PgDialect();

describe('filterItemsSchema', () => {
  it('parses an array of JSON-encoded items and coerces values per field type', () => {
    const parsed = filterItemsSchema(itemSchema).parse([
      '{"field":"views","operator":"gte","value":"10"}',
      '{"field":"name","operator":"contains","value":"foo"}',
    ]);

    expect(parsed).toEqual([
      { field: 'views', operator: 'gte', value: 10 },
      { field: 'name', operator: 'contains', value: 'foo' },
    ]);
  });

  it('parses a single JSON-encoded item', () => {
    const parsed = filterItemsSchema(itemSchema).parse(
      '{"field":"views","operator":"gte","value":"10"}',
    );

    expect(parsed).toEqual({ field: 'views', operator: 'gte', value: 10 });
  });

  it('rejects malformed JSON', () => {
    const result = filterItemsSchema(itemSchema).safeParse('not json');

    expect(result.success).toBe(false);
  });

  it('rejects fields the entity does not expose', () => {
    const result = filterItemsSchema(itemSchema).safeParse(
      '{"field":"missing","operator":"eq","value":"x"}',
    );

    expect(result.success).toBe(false);
  });

  it('rejects operators the field does not support', () => {
    const result = filterItemsSchema(itemSchema).safeParse(
      '{"field":"name","operator":"gte","value":"x"}',
    );

    expect(result.success).toBe(false);
  });
});

describe('buildFilterConditions', () => {
  const columns = { name: items.name, views: items.views };

  it('builds one condition per filter item', () => {
    const conditions = buildFilterConditions(columns, [
      { field: 'name', operator: 'contains', value: 'foo' },
      { field: 'views', operator: 'gte', value: 10 },
    ]);

    expect(conditions).toHaveLength(2);
    for (const condition of conditions) {
      expect(condition).toBeInstanceOf(SQL);
    }
  });

  it('renders the expected SQL per operator', () => {
    const [contains] = buildFilterConditions(columns, [
      { field: 'name', operator: 'contains', value: 'foo' },
    ]);
    const [gte] = buildFilterConditions(columns, [
      { field: 'views', operator: 'gte', value: 10 },
    ]);
    const [inCondition] = buildFilterConditions(columns, [
      { field: 'views', operator: 'in', value: [1, 2] },
    ]);

    expect(dialect.sqlToQuery(contains!)).toEqual({
      sql: '"items"."name" ilike $1',
      params: ['%foo%'],
    });
    expect(dialect.sqlToQuery(gte!)).toEqual({
      sql: '"items"."views" >= $1',
      params: [10],
    });
    expect(dialect.sqlToQuery(inCondition!)).toEqual({
      sql: '"items"."views" in ($1, $2)',
      params: [1, 2],
    });
  });

  it('throws for a field the repository does not expose', () => {
    expect(() =>
      buildFilterConditions(columns, [
        { field: 'missing', operator: 'eq', value: 'x' },
      ]),
    ).toThrow('Unknown filter field "missing"');
  });
});
