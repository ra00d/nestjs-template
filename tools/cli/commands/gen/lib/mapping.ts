import type { FieldType } from './types';

/** List-query operators accepted in the `?filters=` item payload. */
export type Operator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in';

export const OPERATORS_BY_TYPE: Record<FieldType, Operator[]> = {
  text: ['eq', 'ne', 'contains', 'in'],
  uuid: ['eq', 'ne', 'in'],
  integer: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in'],
  boolean: ['eq', 'ne'],
  timestamp: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in'],
  enum: ['eq', 'ne', 'in'],
  jsonb: [],
};

/** `jsonb` is structured data: equality filters are not generated for it. */
export const isFilterableType = (type: FieldType): boolean => OPERATORS_BY_TYPE[type].length > 0;

/** Drizzle pg-core column builder per field type. */
export const DRIZZLE_COLUMN_BUILDER: Record<FieldType, string> = {
  text: 'text',
  uuid: 'uuid',
  integer: 'integer',
  boolean: 'boolean',
  timestamp: 'timestamp',
  enum: 'text',
  jsonb: 'jsonb',
};

/** Zod validator for one field in the create/update DTOs. */
export const zodField = (type: FieldType, values?: string[]): string => {
  switch (type) {
    case 'uuid':
      return 'z.string().uuid()';
    case 'integer':
      return 'z.number().int()';
    case 'boolean':
      return 'z.boolean()';
    case 'timestamp':
      return 'z.date()';
    case 'enum':
      return `z.enum([${(values ?? []).map((value) => `'${value}'`).join(', ')}])`;
    case 'jsonb':
      return 'z.record(z.string(), z.unknown())';
    default:
      return 'z.string().min(1)';
  }
};

/** TypeScript type of one field in the entity interface. */
export const tsField = (type: FieldType, values?: string[]): string => {
  switch (type) {
    case 'uuid':
    case 'text':
      return 'string';
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'timestamp':
      return 'Date';
    case 'enum':
      return (values ?? []).map((value) => `'${value}'`).join(' | ');
    case 'jsonb':
      return 'Record<string, unknown>';
  }
};

/** Zod validator for one filter value inside the JSON `?filters=` payload. */
export const zodFilterValue = (type: FieldType, values?: string[]): string => {
  switch (type) {
    case 'integer':
      return 'z.coerce.number().int()';
    case 'boolean':
      return 'z.coerce.boolean()';
    case 'timestamp':
      return 'z.coerce.date()';
    case 'enum':
      return `z.enum([${(values ?? []).map((value) => `'${value}'`).join(', ')}])`;
    default:
      return 'z.string()';
  }
};

export const DEFAULT_LIST_LIMIT = 20;
export const MAX_LIST_LIMIT = 100;
