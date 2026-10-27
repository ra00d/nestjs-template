import { isFilterableType } from './mapping';
import { entityNames, toCamelCase, toSnakeCase, type EntityNames } from './names';
import { DEFAULT_CONFIG, type ResolvedConfig } from './config';
import type { EntityDefinition, FieldDefinition, RelationDefinition } from './types';

export interface ComputedField extends FieldDefinition {
  /** Snake_case column name as stored in the database. */
  column: string;
  values: string[];
  required: boolean;
  filterable: boolean;
  sortable: boolean;
  searchable: boolean;
}

export interface EntityContext {
  entity: EntityDefinition;
  names: EntityNames;
  fields: ComputedField[];
  timestamps: boolean;
  relations: RelationDefinition[];
  /** `searchable` fields, for the list query's `?search=` match. */
  searchableFields: ComputedField[];
  /** Filterable fields, excluding the `id` primary key (filtered by path). */
  listFields: ComputedField[];
  /** Columns usable in `?sort=`, including the synthesized timestamps. */
  sortableFields: { name: string }[];
  defaultSort: string;
  /** Every known table: variable name -> module dir and variable, for cross-module imports. */
  tables: Map<string, { dir: string; table: string }>;
  /** Repo-relative module root, e.g. `src/modules/posts`. */
  moduleDir: string;
  /** Generation settings (modules dir, external schema and types). */
  settings: ResolvedConfig;
}

export const createContext = (
  entity: EntityDefinition,
  tables: EntityContext['tables'] = new Map(),
  settings: ResolvedConfig = DEFAULT_CONFIG,
): EntityContext => {
  const fields = (entity.fields ?? []).map((field): ComputedField => ({
    ...field,
    column: field.column ?? toSnakeCase(field.name),
    values: field.values ?? [],
    required: field.required ?? true,
    filterable: (field.filterable ?? true) && isFilterableType(field.type),
    sortable: field.sortable ?? true,
    searchable: field.searchable ?? false,
  }));
  const timestamps = entity.timestamps ?? true;
  const timestampsSortable = timestamps ? [{ name: 'createdAt' }, { name: 'updatedAt' }] : [];
  const sortableFields = fields.filter((field) => field.sortable).map((field) => ({ name: field.name }));
  const names = entityNames(entity);
  return {
    entity,
    names,
    fields,
    timestamps,
    relations: entity.relations ?? [],
    searchableFields: fields.filter((field) => field.searchable),
    listFields: fields.filter((field) => field.filterable && field.name !== 'id'),
    sortableFields: [...timestampsSortable, ...sortableFields],
    defaultSort: timestamps ? 'createdAt' : (fields[0]?.name ?? 'id'),
    tables,
    moduleDir: `${settings.modulesDir}/${names.dir}`,
    settings,
  };
};

/** Builds every context with a shared table lookup for cross-module imports. */
export const createContexts = (entities: EntityDefinition[], settings: ResolvedConfig = DEFAULT_CONFIG): EntityContext[] => {
  const contexts = entities.map((entity) => createContext(entity, new Map(), settings));
  const tables: EntityContext['tables'] = new Map(
    contexts.map((context) => [toCamelCase(context.names.name), { dir: context.names.dir, table: toCamelCase(context.names.name) }]),
  );
  for (const context of contexts) {
    context.tables = tables;
  }
  return contexts;
};
