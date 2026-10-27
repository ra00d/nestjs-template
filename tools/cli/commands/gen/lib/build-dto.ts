import { VariableDeclarationKind } from 'ts-morph';
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  OPERATORS_BY_TYPE,
  zodField,
  zodFilterValue,
} from './mapping';
import type { EntityContext } from './context';
import { importPath } from './paths';
import { buildFile } from './project';

const quoted = (values: string[]): string => values.map((value) => `'${value}'`).join(', ');

/** One `z.object({ field, operator, value })` alternative of a filter item. */
const filterItemObject = (field: string, operators: string[], value: string): string =>
  [
    'z.object({',
    `  field: z.literal('${field}'),`,
    `  operator: ${operators.length === 1 ? `z.literal('${operators[0]}')` : `z.enum([${quoted(operators)}])`},`,
    `  value: ${value},`,
    '})',
  ].join('\n');

const indent = (text: string): string =>
  text
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');

/** `dto/create-post.dto.ts`: the creation schema and its DTO. */
export const buildCreateDtoFile = (context: EntityContext): { path: string; content: string } => {
  const { names, moduleDir } = context;
  const path = `${moduleDir}/dto/create-${names.base}.dto.ts`;
  const initializer =
    `z.object({\n${context.fields
      .map((field) => {
        const value = zodField(field.type, field.values);
        // A column default fills the value in: the client may omit the field.
        // Otherwise a nullable column accepts explicit nulls.
        const optional = field.default !== undefined ? '.optional()' : field.required ? '' : '.nullish()';
        return `  ${field.name}: ${value}${optional},`;
      })
      .join('\n')}\n}).meta({ id: 'create${names.entity}Schema' })`;

  const content = buildFile(path, (file) => {
    file.addImportDeclaration({ moduleSpecifier: 'zod', namedImports: ['z'] });
    file.addVariableStatement({
      isExported: true,
      declarationKind: VariableDeclarationKind.Const,
      declarations: [{ name: `create${names.entity}Schema`, initializer }],
    });
    file.addTypeAlias({
      isExported: true,
      name: `Create${names.entity}Dto`,
      type: `z.infer<typeof create${names.entity}Schema>`,
    });
  });

  return { path, content };
};

/** `dto/update-post.dto.ts`: the partial-update schema and its DTO. */
export const buildUpdateDtoFile = (context: EntityContext): { path: string; content: string } => {
  const { names, moduleDir } = context;
  const path = `${moduleDir}/dto/update-${names.base}.dto.ts`;
  const initializer =
    `z.object({\n${context.fields
      .map((field) => `  ${field.name}: ${zodField(field.type, field.values)}.optional(),`)
      .join('\n')}\n}).meta({ id: 'update${names.entity}Schema' })`;

  const content = buildFile(path, (file) => {
    file.addImportDeclaration({ moduleSpecifier: 'zod', namedImports: ['z'] });
    file.addVariableStatement({
      isExported: true,
      declarationKind: VariableDeclarationKind.Const,
      declarations: [{ name: `update${names.entity}Schema`, initializer }],
    });
    file.addTypeAlias({
      isExported: true,
      name: `Update${names.entity}Dto`,
      type: `z.infer<typeof update${names.entity}Schema>`,
    });
  });

  return { path, content };
};

/** `dto/list-post.query.ts`: pagination, sort, filters, search and includes. */
export const buildListQueryFile = (context: EntityContext): { path: string; content: string } => {
  const { names, listFields, searchableFields, relations, sortableFields, defaultSort, moduleDir } = context;
  const path = `${moduleDir}/dto/list-${names.base}.query.ts`;

  // One union alternative per field value shape: the scalar operators plus a
  // separate `in` alternative that arrays the same value schema. Enum
  // operators stay enum-typed: a plain `z.string()` would fail the column's
  // literal union in both the SQL conditions and the RQB filter.
  const filterAlternatives: string[] = [];
  for (const field of listFields) {
    const operators = OPERATORS_BY_TYPE[field.type];
    const scalar = zodFilterValue(field.type, field.values);
    const scalarOperators = operators.filter((operator) => operator !== 'in');
    if (scalarOperators.length > 0) {
      filterAlternatives.push(filterItemObject(field.name, scalarOperators, scalar));
    }
    if (operators.includes('in')) {
      filterAlternatives.push(filterItemObject(field.name, ['in'], `z.array(${scalar})`));
    }
  }
  const filterSchema = `${names.base}FilterItemSchema`;

  const entries: { key: string; value: string }[] = [
    { key: 'page', value: 'z.coerce.number().int().min(1).default(1)' },
    { key: 'limit', value: `z.coerce.number().int().min(1).max(${MAX_LIST_LIMIT}).default(${DEFAULT_LIST_LIMIT})` },
    { key: 'sort', value: `z.enum([${quoted(sortableFields.map((field) => field.name))}]).default('${defaultSort}')` },
    { key: 'order', value: "z.enum(['asc', 'desc']).default('desc')" },
  ];
  if (filterAlternatives.length > 0) {
    entries.push({ key: 'filters', value: `filterItemsSchema(${filterSchema}).optional()` });
  }
  if (searchableFields.length > 0) {
    entries.push({ key: 'search', value: 'z.string().optional()' });
  }
  if (relations.length > 0) {
    entries.push({
      key: 'include',
      value: 'z.string().transform((value) => new Set(value.split(\',\').filter(Boolean))).optional()',
    });
  }
  const initializer = `z.object({\n${entries
    .map((entry) => `  ${/^[A-Za-z_$][\w$]*$/.test(entry.key) ? entry.key : `'${entry.key}'`}: ${entry.value},`)
    .join('\n')}\n}).meta({ id: 'list${names.entity}QuerySchema' })`;

  const content = buildFile(path, (file) => {
    file.addImportDeclaration({ moduleSpecifier: 'zod', namedImports: ['z'] });
    if (filterAlternatives.length > 0) {
      file.addImportDeclaration({
        moduleSpecifier: importPath(path, 'src/database/filters.ts'),
        namedImports: ['filterItemsSchema'],
      });
      file.addVariableStatement({
        declarationKind: VariableDeclarationKind.Const,
        declarations: [
          {
            name: filterSchema,
            initializer: `z.union([\n${filterAlternatives.map((alternative) => indent(alternative)).join(',\n')}\n])`,
          },
        ],
      });
    }
    const listStatement = file.addVariableStatement({
      isExported: true,
      declarationKind: VariableDeclarationKind.Const,
      declarations: [{ name: `list${names.entity}QuerySchema`, initializer }],
    });
    if (filterAlternatives.length > 0) {
      // ts-morph glues consecutive variable statements together; keep the
      // filter union visually separate from the query schema.
      file.insertText(listStatement.getStart(), '\n');
    }
    file.addTypeAlias({
      isExported: true,
      name: `List${names.entity}QueryDto`,
      type: `z.infer<typeof list${names.entity}QuerySchema>`,
    });
    if (relations.length > 0) {
      file.addVariableStatement({
        isExported: true,
        declarationKind: VariableDeclarationKind.Const,
        declarations: [
          {
            name: 'parseIncludes',
            initializer: '(value?: string): Set<string> => new Set((value ?? \'\').split(\',\').filter(Boolean))',
          },
        ],
      });
    }
  });

  return { path, content };
};
