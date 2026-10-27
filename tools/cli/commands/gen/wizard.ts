import * as p from '@clack/prompts';
import type {
  EntityDefinition,
  FieldDefinition,
  RelationDefinition,
} from './lib/types';
import type { FieldType } from './lib/types';
import { entityNames } from './lib/names';
import { cancel } from '../../tui/cancel';
import { askField } from './ask-field';
import { askRelation } from './ask-relation';
import { ENTITIES_PATH } from './constants';

export const wizard = async (
  entities: EntityDefinition[],
): Promise<EntityDefinition> => {
  p.intro('Scaffold a module');
  const name = await p.text({
    message: 'Entity name (plural)',
    placeholder: 'posts',
  });
  if (p.isCancel(name)) cancel();
  const entityName = String(name).trim();
  if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(entityName)) {
    p.log.error('Use lowercase kebab-case names like "email-tokens".');
    return cancel();
  }
  if (entities.some((entity) => entityNames(entity).name === entityName)) {
    p.log.error(`${entityName} is already defined in ${ENTITIES_PATH}.`);
    return cancel();
  }

  const fields: FieldDefinition[] = [];
  for (;;) {
    const field = await askField();
    if (fields.some((existing) => existing.name === field.name)) {
      p.log.warn(`Skipped duplicate field ${field.name}.`);
      continue;
    }
    fields.push(field);
    const more = await p.confirm({
      message: 'Add another field?',
      initialValue: true,
    });
    if (p.isCancel(more)) cancel();
    if (!more) break;
  }

  const relations: RelationDefinition[] = [];
  const tables = [
    'users',
    ...entities.map((entity) => entityNames(entity).name),
  ];
  for (;;) {
    const add = await p.confirm({
      message: 'Add a relation?',
      initialValue: relations.length === 0,
    });
    if (p.isCancel(add)) cancel();
    if (!add) break;
    const relation = await askRelation(tables, entities);
    if (
      relation.type === 'one' &&
      !fields.some((field) => field.name === relation.field)
    ) {
      const [target] = relation.references.split('.');
      fields.push({
        name: relation.field,
        type: 'text' as FieldType,
        references: relation.references,
        filterable: false,
      });
      p.log.info(
        `Added the ${relation.field} field, referencing ${target}.id.`,
      );
    }
    relations.push(relation);
  }

  const timestamps = await p.confirm({
    message: 'Add createdAt/updatedAt columns?',
    initialValue: true,
  });
  if (p.isCancel(timestamps)) cancel();
  const isPublic = await p.confirm({
    message: 'Public routes (@Public())?',
    initialValue: false,
  });
  if (p.isCancel(isPublic)) cancel();

  const definition: EntityDefinition = {
    name: entityName,
    fields,
    relations,
    timestamps: Boolean(timestamps),
    public: Boolean(isPublic),
  };
  p.note(
    `${entityName}\n${fields.map((field) => `  ${field.name}: ${field.type}`).join('\n')}${
      relations.length > 0
        ? relations
            .map((relation) => `  -> ${relation.name}: ${relation.type}`)
            .join('\n')
        : ''
    }`,
    'Entity preview',
  );
  const confirmed = await p.confirm({
    message: 'Generate this module?',
    initialValue: true,
  });
  if (p.isCancel(confirmed)) cancel();
  if (!confirmed) return cancel();

  return definition;
};

