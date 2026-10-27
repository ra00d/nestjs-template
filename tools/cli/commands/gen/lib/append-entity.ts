import { Project, SyntaxKind } from 'ts-morph';
import type { EntityDefinition } from './types';

/** Renders a definition as the `defineEntity({...})` block used in entities.ts. */
export const entityDefinitionText = (entity: EntityDefinition): string => {
  const lines = ['defineEntity({', `  name: '${entity.name}',`];
  if (entity.route) lines.push(`  route: '${entity.route}',`);
  lines.push('  fields: [');
  for (const field of entity.fields) {
    const parts = [`name: '${field.name}'`, `type: '${field.type}'`];
    if (field.required === false) parts.push('required: false');
    if (field.unique) parts.push('unique: true');
    if (field.default !== undefined) {
      parts.push(`default: ${typeof field.default === 'string' ? `'${field.default}'` : String(field.default)}`);
    }
    if (field.values) parts.push(`values: [${field.values.map((value) => `'${value}'`).join(', ')}]`);
    if (field.references) parts.push(`references: '${field.references}'`);
    if (field.searchable) parts.push('searchable: true');
    lines.push(`    { ${parts.join(', ')} },`);
  }
  lines.push('  ],');
  if (entity.relations && entity.relations.length > 0) {
    lines.push('  relations: [');
    for (const relation of entity.relations) {
      const parts =
        relation.type === 'one'
          ? [`name: '${relation.name}'`, "type: 'one'", `field: '${relation.field}'`, `references: '${relation.references}'`]
          : [
              `name: '${relation.name}'`,
              "type: 'many'",
              `target: '${relation.target}'`,
              `foreignKey: '${relation.foreignKey}'`,
              ...(relation.localKey ? [`localKey: '${relation.localKey}'`] : []),
            ];
      lines.push(`    { ${parts.join(', ')} },`);
    }
    lines.push('  ],');
  }
  if (entity.timestamps === false) lines.push('  timestamps: false,');
  if (entity.public) lines.push('  public: true,');
  lines.push('})');
  return lines.join('\n');
};

/** Appends the entity to the `entities` array of tools/entities.ts. */
export const appendEntity = async (project: Project, entitiesPath: string, entity: EntityDefinition): Promise<void> => {
  const file = project.addSourceFileAtPath(entitiesPath);
  const array = file
    .getVariableDeclaration('entities')
    ?.getInitializerIfKind(SyntaxKind.ArrayLiteralExpression);
  if (!array) {
    throw new Error(`${entitiesPath} has no entities array to append to.`);
  }
  array.addElement(entityDefinitionText(entity));
  file.saveSync();
  const { readFileSync, writeFileSync } = await import('node:fs');
  const { format } = await import('prettier');
  const formatted = await format(readFileSync(entitiesPath, 'utf8'), {
    parser: 'typescript',
    singleQuote: true,
    trailingComma: 'all',
  });
  writeFileSync(entitiesPath, formatted, 'utf8');
};
