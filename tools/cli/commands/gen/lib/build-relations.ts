import { VariableDeclarationKind } from 'ts-morph';
import { toCamelCase } from './names.ts';
import type { EntityContext } from './context.ts';
import { importPath } from './paths.ts';
import { buildFile } from './project.ts';

/** Tables the relations part needs: own table first, then referenced tables. */
const neededTables = (context: EntityContext): string[] => {
  const own = toCamelCase(context.names.name);
  const others = new Set<string>();
  for (const relation of context.relations) {
    const target =
      relation.type === 'one'
        ? relation.references.split('.')[0]
        : relation.target;
    const variable = toCamelCase(target);
    if (variable !== own) others.add(variable);
  }
  return [own, ...[...others].sort()];
};

const tableSpecifier = (context: EntityContext, relationsFile: string, variable: string): string => {
  const own = toCamelCase(context.names.name);
  if (variable === own) return `./${context.names.name}.schema`;
  const known = context.tables.get(variable);
  return known
    ? importPath(relationsFile, `${context.settings.modulesDir}/${known.dir}/db/${known.dir}.schema.ts`)
    : importPath(relationsFile, context.settings.externalSchema);
};

const relationMember = (
  context: EntityContext,
  relation: EntityContext['relations'][number],
): string => {
  const table = toCamelCase(context.names.name);
  if (relation.type === 'one') {
    const [targetTable, targetColumn] = relation.references.split('.');
    const target = toCamelCase(targetTable);
    return `${relation.name}: r.one.${target}({ from: r.${table}.${relation.field}, to: r.${target}.${targetColumn} }),`;
  }
  const target = toCamelCase(relation.target);
  const localKey = relation.localKey ?? 'id';
  return `${relation.name}: r.many.${target}({ from: r.${table}.${localKey}, to: r.${target}.${relation.foreignKey} }),`;
};

/**
 * `db/posts.relations.ts`: this module's relations part, built with
 * `defineRelationsPart`. The part only imports tables (never other parts),
 * so module files stay acyclic: composition happens in
 * `src/database/relations.ts`.
 */
export const buildRelationsFile = (
  context: EntityContext,
): { path: string; content: string } | null => {
  if (context.relations.length === 0) return null;
  const { names, moduleDir } = context;
  const table = toCamelCase(names.name);
  const path = `${moduleDir}/db/${names.name}.relations.ts`;
  const tables = neededTables(context);

  const bySpecifier = new Map<string, string[]>();
  for (const variable of tables) {
    const specifier = tableSpecifier(context, path, variable);
    const list = bySpecifier.get(specifier) ?? [];
    list.push(variable);
    bySpecifier.set(specifier, list);
  }

  const schemaObject = `{ ${tables.join(', ')} }`;
  const members = context.relations
    .map((relation) => `    ${relationMember(context, relation)}`)
    .join('\n');
  const initializer = `defineRelationsPart(${schemaObject}, (r) => ({\n  ${table}: {\n${members}\n  },\n}))`;

  const content = buildFile(path, (file) => {
    file.addImportDeclaration({
      moduleSpecifier: 'drizzle-orm',
      namedImports: ['defineRelationsPart'],
    });
    for (const [moduleSpecifier, namedImports] of bySpecifier) {
      file.addImportDeclaration({ moduleSpecifier, namedImports });
    }
    file.addVariableStatement({
      isExported: true,
      declarationKind: VariableDeclarationKind.Const,
      declarations: [{ name: `${table}Relations`, initializer }],
    });
  });

  return { path, content };
};
