import { VariableDeclarationKind } from 'ts-morph';
import { DRIZZLE_COLUMN_BUILDER } from './mapping.ts';
import { toCamelCase } from './names.ts';
import type { EntityContext } from './context.ts';
import { importPath } from './paths.ts';
import { buildFile } from './project.ts';

const literal = (value: string | number | boolean): string =>
  typeof value === 'string' ? `'${value}'` : String(value);

const columnExpression = (field: EntityContext['fields'][number]): string => {
  if (field.type === 'enum') {
    const values = field.values.map((value) => `'${value}'`).join(', ');
    let expression = `text('${field.column}', { enum: [${values}] })${field.required ? '.notNull()' : ''}`;
    if (field.unique) expression += '.unique()';
    if (field.default !== undefined) expression += `.default(${literal(field.default)})`;
    return expression;
  }
  // Timestamp fields share the `at()` helper with the standard columns.
  const base =
    field.type === 'timestamp'
      ? `at('${field.column}')`
      : field.type === 'jsonb'
        ? `jsonb('${field.column}').$type<Record<string, unknown>>()`
        : `${DRIZZLE_COLUMN_BUILDER[field.type]}('${field.column}')`;
  let expression = base;
  if (field.required) expression += '.notNull()';
  if (field.unique) expression += '.unique()';
  if (field.default !== undefined) expression += `.default(${literal(field.default)})`;
  if (field.references) {
    const [table, column] = field.references.split('.');
    expression += `.references(() => ${toCamelCase(table)}.${column})`;
  }
  return expression;
};

/** Table variables this module's table file must import (excluding its own table). */
export const tableImports = (
  context: EntityContext,
  tableFile: string,
): { moduleSpecifier: string; namedImports: string[] }[] => {
  const own = toCamelCase(context.names.name);
  const targets = new Map<string, string>();
  for (const field of context.fields) {
    if (!field.references) continue;
    const [targetTable] = field.references.split('.');
    const variable = toCamelCase(targetTable);
    if (variable === own || targets.has(variable)) continue;
    const known = context.tables.get(variable);
    targets.set(
      variable,
      known
        ? importPath(tableFile, `${context.settings.modulesDir}/${known.dir}/db/${known.dir}.schema.ts`)
        : importPath(tableFile, context.settings.externalSchema),
    );
  }
  const bySpecifier = new Map<string, string[]>();
  for (const [variable, specifier] of targets) {
    const list = bySpecifier.get(specifier) ?? [];
    list.push(variable);
    bySpecifier.set(specifier, list);
  }
  return [...bySpecifier].map(([moduleSpecifier, namedImports]) => ({
    moduleSpecifier,
    namedImports,
  }));
};

/** `db/posts.schema.ts`: the module's Drizzle table with shared timestamps. */
export const buildTableFile = (context: EntityContext): { path: string; content: string } => {
  const { names, fields, timestamps, moduleDir, settings } = context;
  const table = toCamelCase(names.name);
  const path = `${moduleDir}/db/${names.name}.schema.ts`;
  const needsAt = fields.some((field) => field.type === 'timestamp');

  const builders = new Set<string>(['pgTable', 'text']);
  for (const field of fields) {
    if (field.type === 'timestamp' || field.type === 'enum') continue;
    builders.add(DRIZZLE_COLUMN_BUILDER[field.type]);
  }
  if (fields.some((field) => field.type === 'enum')) builders.add('text');

  const lines = [`pgTable('${names.name}', {`, `  id: text('id').primaryKey(),`];
  for (const field of fields) {
    lines.push(`  ${field.name}: ${columnExpression(field)},`);
  }
  if (timestamps) lines.push(`  ...timestamps,`);
  lines.push('})');

  const content = buildFile(path, (file) => {
    file.addImportDeclaration({
      moduleSpecifier: 'drizzle-orm/pg-core',
      namedImports: [...builders],
    });
    if (timestamps || needsAt) {
      file.addImportDeclaration({
        moduleSpecifier: importPath(path, settings.timestampFields),
        namedImports: [...(timestamps ? ['timestamps'] : []), ...(needsAt ? ['at'] : [])],
      });
    }
    for (const declaration of tableImports(context, path)) {
      file.addImportDeclaration(declaration);
    }
    file.addVariableStatement({
      isExported: true,
      declarationKind: VariableDeclarationKind.Const,
      declarations: [{ name: table, initializer: lines.join('\n') }],
    });
  });

  return { path, content };
};
