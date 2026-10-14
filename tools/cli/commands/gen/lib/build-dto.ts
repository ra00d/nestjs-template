import { VariableDeclarationKind } from 'ts-morph';
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  OPERATORS_BY_TYPE,
  zodField,
  zodOperatorValue,
  zodQueryField,
} from './mapping.ts';
import type { EntityContext } from './context.ts';
import { buildFile } from './project.ts';

const quoted = (values: string[]): string => values.map((value) => `'${value}'`).join(', ');

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
      .join('\n')}\n})`;

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
      .join('\n')}\n})`;

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

  const entries: { key: string; value: string }[] = [
    { key: 'page', value: 'z.coerce.number().int().min(1).default(1)' },
    { key: 'limit', value: `z.coerce.number().int().min(1).max(${MAX_LIST_LIMIT}).default(${DEFAULT_LIST_LIMIT})` },
    { key: 'sort', value: `z.enum([${quoted(sortableFields.map((field) => field.name))}]).default('${defaultSort}')` },
    { key: 'order', value: "z.enum(['asc', 'desc']).default('desc')" },
  ];
  for (const field of listFields) {
    const operators = OPERATORS_BY_TYPE[field.type];
    if (operators.includes('eq')) {
      entries.push({ key: field.name, value: `${zodQueryField(field.type, field.values)}.optional()` });
    }
    for (const operator of operators) {
      if (operator === 'eq') continue;
      // Enum operators stay enum-typed: a plain `z.string()` would fail the
      // column's literal union in both the SQL conditions and the RQB filter.
      const value =
        field.type === 'enum'
          ? operator === 'in'
            ? `z.string().transform((value) => value.split(',')).pipe(z.array(z.enum([${quoted(field.values)}])))`
            : `z.enum([${quoted(field.values)}])`
          : zodOperatorValue(field.type, operator);
      entries.push({ key: `${field.name}.${operator}`, value: `${value}.optional()` });
    }
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
    .join('\n')}\n})`;

  const content = buildFile(path, (file) => {
    file.addImportDeclaration({ moduleSpecifier: 'zod', namedImports: ['z'] });
    file.addVariableStatement({
      isExported: true,
      declarationKind: VariableDeclarationKind.Const,
      declarations: [{ name: `list${names.entity}QuerySchema`, initializer }],
    });
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
