import { tsField } from './mapping';
import type { EntityContext } from './context';
import { targetEntityType } from './paths';
import { buildFile } from './project';

/** `post.ts`: the entity interface, its relation fields and the list page shape. */
export const buildEntityFile = (context: EntityContext): { path: string; content: string } => {
  const { names, fields, timestamps, relations, moduleDir } = context;
  const path = `${moduleDir}/${names.base}.ts`;

  const relationImports = new Map<string, string>();
  for (const relation of relations) {
    const target = relation.type === 'one' ? relation.references.split('.')[0] : relation.target;
    const { type, from } = targetEntityType(context, path, target);
    relationImports.set(from, type);
  }

  const relationProps = relations.map((relation): { name: string; type: string } => {
    const target = relation.type === 'one' ? relation.references.split('.')[0] : relation.target;
    const { type } = targetEntityType(context, path, target);
    return {
      name: relation.name,
      type: relation.type === 'one' ? `${type} | null` : `${type}[]`,
    };
  });

  const properties = [
    { name: 'id', type: 'string', optional: false },
    ...fields.map((field) => ({
      name: field.name,
      type: field.required ? tsField(field.type, field.values) : `${tsField(field.type, field.values)} | null`,
      optional: false,
    })),
    // Shared timestamp columns (`...timestamps` in the table file) are
    // nullable at the database level.
    ...(timestamps
      ? [
          { name: 'createdAt', type: 'Date | null', optional: false },
          { name: 'updatedAt', type: 'Date | null', optional: false },
          { name: 'deletedAt', type: 'Date | null', optional: false },
        ]
      : []),
    // Relations are only present when requested through `?include=`.
    ...relationProps.map((relation) => ({ name: relation.name, type: relation.type, optional: true })),
  ];

  const content = buildFile(path, (file) => {
    for (const [from, type] of relationImports) {
      file.addImportDeclaration({ moduleSpecifier: from, namedImports: [type], isTypeOnly: true });
    }
    file.addInterface({
      name: names.entity,
      isExported: true,
      properties: properties.map((property) => ({ name: property.name, type: property.type, hasQuestionToken: property.optional })),
    });
    file.addInterface({
      name: `${names.entity}Page`,
      isExported: true,
      properties: [
        { name: 'data', type: `${names.entity}[]` },
        { name: 'meta', type: '{ page: number; limit: number; total: number; totalPages: number }' },
      ],
    });
  });

  return { path, content };
};
