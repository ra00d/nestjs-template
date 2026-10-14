import { Scope } from 'ts-morph';
import { DRIZZLE_CONDITION_BUILDER, OPERATORS_BY_TYPE } from './mapping.ts';
import { toCamelCase } from './names.ts';
import type { EntityContext } from './context.ts';
import { importPath, targetEntityType, targetTypeName } from './paths.ts';
import { buildFile } from './project.ts';

/** `query.views.gte` for operator keys, `query.title` for plain field names. */
const access = (key: string): string => (/^[A-Za-z_$][\w$]*$/.test(key) ? `query.${key}` : `query['${key}']`);

/** Table variables the repository loads relations from (excluding its own table). */
const relationTables = (
  context: EntityContext,
  repositoryFile: string,
): { moduleSpecifier: string; namedImports: string[] }[] => {
  const own = toCamelCase(context.names.name);
  const targets = new Map<string, string>();
  for (const relation of context.relations) {
    const raw = relation.type === 'one' ? relation.references.split('.')[0] : relation.target;
    const variable = toCamelCase(raw);
    if (variable === own || targets.has(variable)) continue;
    const known = context.tables.get(variable);
    targets.set(
      variable,
      known
        ? importPath(repositoryFile, `${context.settings.modulesDir}/${known.dir}/db/${known.dir}.schema.ts`)
        : importPath(repositoryFile, context.settings.externalSchema),
    );
  }
  const bySpecifier = new Map<string, string[]>();
  for (const [variable, specifier] of targets) {
    const list = bySpecifier.get(specifier) ?? [];
    list.push(variable);
    bySpecifier.set(specifier, list);
  }
  return [...bySpecifier].map(([moduleSpecifier, namedImports]) => ({ moduleSpecifier, namedImports }));
};

/** One batch-load block per relation, stitching rows onto the entities. */
const includeBlock = (context: EntityContext, relation: EntityContext['relations'][number]): string => {
  if (relation.type === 'one') {
    const [targetTable, targetColumn] = relation.references.split('.');
    const target = toCamelCase(targetTable);
    const targetType = targetTypeName(context, targetTable);
    return [
      `if (include?.has('${relation.name}')) {`,
      `  const ids = [...new Set(rows.map((row) => row.${relation.field}))];`,
      `  const related: ${targetType}[] = await this.db.select().from(${target}).where(inArray(${target}.${targetColumn}, ids));`,
      `  const byId = new Map(related.map((item) => [item.${targetColumn}, item]));`,
      `  for (const row of rows) row.${relation.name} = byId.get(row.${relation.field}) ?? null;`,
      `}`,
    ].join('\n');
  }
  const target = toCamelCase(relation.target);
  const localKey = relation.localKey ?? 'id';
  const targetType = targetTypeName(context, relation.target);
  return [
    `if (include?.has('${relation.name}')) {`,
    `  const ids = [...new Set(rows.map((row) => row.${localKey}))];`,
    `  const related: ${targetType}[] = await this.db.select().from(${target}).where(inArray(${target}.${relation.foreignKey}, ids));`,
    `  const byParentId = new Map<string, ${targetType}[]>();`,
    `  for (const item of related) {`,
    `    const list = byParentId.get(item.${relation.foreignKey}) ?? [];`,
    `    list.push(item);`,
    `    byParentId.set(item.${relation.foreignKey}, list);`,
    `  }`,
    `  for (const row of rows) row.${relation.name} = byParentId.get(row.${localKey}) ?? [];`,
    `}`,
  ].join('\n');
};

/** `repositories/posts.repository.ts`: Drizzle CRUD, filters, pagination, relation loading. */
export const buildRepositoryFile = (context: EntityContext): { path: string; content: string } => {
  const { names, listFields, searchableFields, relations, moduleDir } = context;
  const table = toCamelCase(names.name);
  const path = `${moduleDir}/repositories/${names.name}.repository.ts`;
  const hasRelations = relations.length > 0;

  const sqlConditions: string[] = [];
  const sqlImports = new Set<string>(['eq', 'and', 'asc', 'desc', 'type SQL']);
  for (const field of listFields) {
    for (const operator of OPERATORS_BY_TYPE[field.type]) {
      const key = operator === 'eq' ? field.name : `${field.name}.${operator}`;
      const value = operator === 'contains' ? `\`%\${${access(key)}}%\`` : access(key);
      sqlConditions.push(
        `  if (${access(key)} !== undefined) conditions.push(${DRIZZLE_CONDITION_BUILDER[operator]}(${table}.${field.name}, ${value}));`,
      );
      sqlImports.add(DRIZZLE_CONDITION_BUILDER[operator]);
    }
  }
  if (searchableFields.length > 0) {
    sqlImports.add('ilike');
    sqlImports.add('or');
    const predicates = searchableFields.map((field) => `ilike(${table}.${field.name}, \`%\${query.search}%\`)`).join(', ');
    // `or()` returns `undefined` when every predicate is `undefined`: the
    // guard keeps the `conditions` list free of it.
    sqlConditions.push(
      `  if (query.search) {\n    const searchFilter = or(${predicates});\n    if (searchFilter) conditions.push(searchFilter);\n  }`,
    );
  }
  if (hasRelations) sqlImports.add('inArray');

  const entityImports = new Map<string, string>();
  for (const relation of relations) {
    const raw = relation.type === 'one' ? relation.references.split('.')[0] : relation.target;
    const { type, from } = targetEntityType(context, path, raw);
    if (!entityImports.has(from)) entityImports.set(from, type);
  }

  const imports: { moduleSpecifier: string; namedImports: string[]; isTypeOnly?: boolean }[] = [
    { moduleSpecifier: 'node:crypto', namedImports: ['randomUUID'] },
    { moduleSpecifier: '@nestjs/common', namedImports: ['Injectable'] },
    { moduleSpecifier: '@nestjs/drizzle', namedImports: ['InjectDrizzle'] },
    { moduleSpecifier: 'drizzle-orm', namedImports: [...sqlImports] },
    { moduleSpecifier: 'drizzle-orm/node-postgres', namedImports: ['NodePgDatabase'], isTypeOnly: true },
    {
      moduleSpecifier: importPath(path, 'src/database/transaction.ts'),
      namedImports: ['currentTx'],
    },
    {
      moduleSpecifier: importPath(path, `${moduleDir}/db/${names.name}.schema.ts`),
      namedImports: [table],
    },
    ...relationTables(context, path).map((declaration) => ({ ...declaration })),
    ...[...entityImports].map(([moduleSpecifier, type]) => ({ moduleSpecifier, namedImports: [type], isTypeOnly: true })),
    { moduleSpecifier: importPath(path, `${moduleDir}/${names.base}.ts`), namedImports: [names.entity], isTypeOnly: true },
    {
      moduleSpecifier: importPath(path, `${moduleDir}/dto/create-${names.base}.dto.ts`),
      namedImports: [`Create${names.entity}Dto`],
      isTypeOnly: true,
    },
    {
      moduleSpecifier: importPath(path, `${moduleDir}/dto/update-${names.base}.dto.ts`),
      namedImports: [`Update${names.entity}Dto`],
      isTypeOnly: true,
    },
    {
      moduleSpecifier: importPath(path, `${moduleDir}/dto/list-${names.base}.query.ts`),
      namedImports: [`List${names.entity}QueryDto`],
      isTypeOnly: true,
    },
  ];

  const findAllStatements = [
    'const conditions = this.getFilterConditions(query);',
    'const where = conditions.length > 0 ? and(...conditions) : undefined;',
    `const [rows, total] = await Promise.all([
  this.db
    .select()
    .from(${table})
    .where(where)
    .orderBy(query.order === 'asc' ? asc(${table}[query.sort]) : desc(${table}[query.sort]))
    .limit(query.limit)
    .offset((query.page - 1) * query.limit),
  this.db.$count(${table}, conditions.length > 0 ? and(...conditions) : undefined),
]);`,
    ...(hasRelations ? ['return { data: await this.withIncludes(rows, query.include), total };'] : ['return { data: rows, total };']),
  ];

  const findByIdStatements = hasRelations
    ? [
        `const [row] = await this.db.select().from(${table}).where(eq(${table}.id, id));`,
        'if (!row) return null;',
        'const [first] = await this.withIncludes([row], include);',
        'return first;',
      ]
    : [`const [row] = await this.db.select().from(${table}).where(eq(${table}.id, id));`, 'return row ?? null;'];

  const content = buildFile(path, (file) => {
    for (const declaration of imports) {
      file.addImportDeclaration(declaration);
    }
    file.addClass({
      name: `${names.plural}Repository`,
      isExported: true,
      decorators: [{ name: 'Injectable', arguments: [] }],
      ctors: [
        {
          parameters: [
            {
              name: 'baseDb',
              type: 'NodePgDatabase',
              scope: Scope.Private,
              isReadonly: true,
              decorators: [{ name: 'InjectDrizzle', arguments: [] }],
            },
          ],
          statements: [],
        },
      ],
      getAccessors: [
        {
          name: 'db',
          returnType: 'NodePgDatabase',
          statements: [
            'return (currentTx() as unknown as NodePgDatabase | undefined) ?? this.baseDb;',
          ],
        },
      ],
      methods: [
        {
          name: 'create',
          isAsync: true,
          parameters: [{ name: 'data', type: `Create${names.entity}Dto` }],
          returnType: `Promise<${names.entity}>`,
          statements: [
            `const [created] = await this.db.insert(${table}).values({ id: randomUUID(), ...data }).returning();`,
            'return created;',
          ],
        },
        {
          name: 'findById',
          isAsync: true,
          parameters: [
            { name: 'id', type: 'string' },
            ...(hasRelations ? [{ name: 'include', type: 'Set<string>', hasQuestionToken: true }] : []),
          ],
          returnType: `Promise<${names.entity} | null>`,
          statements: findByIdStatements,
        },
        {
          name: 'findAll',
          isAsync: true,
          parameters: [{ name: 'query', type: `List${names.entity}QueryDto` }],
          returnType: `Promise<{ data: ${names.entity}[]; total: number }>`,
          statements: findAllStatements,
        },
        {
          name: 'update',
          isAsync: true,
          parameters: [
            { name: 'id', type: 'string' },
            { name: 'data', type: `Update${names.entity}Dto` },
          ],
          returnType: `Promise<${names.entity} | null>`,
          statements: [
            `const [updated] = await this.db.update(${table}).set(data).where(eq(${table}.id, id)).returning();`,
            'return updated ?? null;',
          ],
        },
        {
          name: 'remove',
          isAsync: true,
          parameters: [{ name: 'id', type: 'string' }],
          returnType: 'Promise<void>',
          statements: [`await this.db.delete(${table}).where(eq(${table}.id, id));`],
        },
        {
          name: 'getFilterConditions',
          scope: Scope.Private,
          parameters: [{ name: 'query', type: `List${names.entity}QueryDto` }],
          returnType: 'SQL<unknown>[]',
          statements: [
            'const conditions: SQL<unknown>[] = [];',
            ...sqlConditions,
            'return conditions;',
          ],
        },
        ...(hasRelations
          ? [
              {
                name: 'withIncludes',
                isAsync: true,
                scope: Scope.Private,
                parameters: [
                  { name: 'rows', type: `${names.entity}[]` },
                  { name: 'include', type: 'Set<string>', hasQuestionToken: true },
                ],
                returnType: `Promise<${names.entity}[]>`,
                statements: [
                  'if (rows.length === 0) return rows;',
                  ...relations.map((relation) => includeBlock(context, relation)),
                  'return rows;',
                ],
              },
            ]
          : []),
      ],
    });
  });

  return { path, content };
};
