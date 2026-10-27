import { VariableDeclarationKind } from 'ts-morph';
import { zodField } from './mapping';
import type { EntityContext } from './context';
import { importPath } from './paths';
import { buildFile } from './project';

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

/** `dto/list-post.query.ts`: base query, sort, filters and includes. */
export const buildListQueryFile = (context: EntityContext): { path: string; content: string } => {
  const { names, listFields, relations, sortableFields, defaultSort, moduleDir } = context;
  const path = `${moduleDir}/dto/list-${names.base}.query.ts`;

  const entries = [
    '  ...baseQuerySchema.shape,',
    `  sort: z.enum([${quoted(sortableFields.map((field) => field.name))}]).default('${defaultSort}'),`,
  ];
  if (listFields.length > 0) {
    entries.push('  filters: createFiltersSchema(filterFields).optional(),');
  }
  entries.push('  search: z.string().optional(),');
  if (relations.length > 0) {
    entries.push(
      "  include: z.string().transform((value) => new Set(value.split(',').filter(Boolean))).optional(),",
    );
  }
  const initializer = `z.object({\n${entries.join('\n')}\n}).meta({ id: 'list${names.entity}QuerySchema' })`;

  const content = buildFile(path, (file) => {
    file.addImportDeclaration({ moduleSpecifier: 'zod', namedImports: ['z'] });
    file.addImportDeclaration({ moduleSpecifier: '@/common', namedImports: ['baseQuerySchema'] });
    if (listFields.length > 0) {
      file.addImportDeclaration({
        moduleSpecifier: importPath(path, 'src/database/filters.ts'),
        namedImports: ['createFiltersSchema'],
      });
      file.addVariableStatement({
        declarationKind: VariableDeclarationKind.Const,
        declarations: [
          {
            name: 'filterFields',
            initializer: `z.enum([${quoted(listFields.map((field) => field.name))}])`,
          },
        ],
      });
    }
    const listStatement = file.addVariableStatement({
      isExported: true,
      declarationKind: VariableDeclarationKind.Const,
      declarations: [{ name: `list${names.entity}QuerySchema`, initializer }],
    });
    if (listFields.length > 0) {
      // ts-morph glues consecutive variable statements together; keep the
      // filter fields visually separate from the query schema.
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
