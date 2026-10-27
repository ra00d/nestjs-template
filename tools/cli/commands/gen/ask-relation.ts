import * as p from '@clack/prompts';
import type { RelationDefinition } from './lib/types';
import type { EntityDefinition } from './lib/types';
import { entityNames } from './lib/names';
import { cancel } from '../../tui/cancel';
import { singular } from '../../utils/strings';

export const askRelation = async (
  tables: string[],
  entities: EntityDefinition[],
): Promise<RelationDefinition> => {
  const name = await p.text({
    message: 'Relation name',
    placeholder: 'author',
  });
  if (p.isCancel(name)) cancel();
  const kind = await p.select({
    message: 'Relation kind',
    options: [
      { value: 'one', label: 'one', hint: 'this table holds the foreign key' },
      {
        value: 'many',
        label: 'many',
        hint: 'the other table points back here',
      },
    ],
  });
  if (p.isCancel(kind)) cancel();
  if (kind === 'one') {
    const target = await p.select({
      message: 'Points at table',
      options: tables.map((table) => ({ value: table, label: table })),
    });
    if (p.isCancel(target)) cancel();
    const field = await p.text({
      message: 'Foreign key field on this table',
      placeholder: `${singular(String(target))}Id`,
    });
    if (p.isCancel(field)) cancel();
    return {
      name: String(name),
      type: 'one',
      field: String(field),
      references: `${String(target)}.id`,
    };
  }
  const target = await p.select({
    message: 'Points at table',
    options: entities.map((entity) => ({
      value: entityNames(entity).name,
      label: entityNames(entity).name,
    })),
  });
  if (p.isCancel(target)) cancel();
  const foreignKey = await p.text({
    message: 'Foreign key on the target table',
    placeholder: `${singular(String(name))}Id`,
  });
  if (p.isCancel(foreignKey)) cancel();
  return {
    name: String(name),
    type: 'many',
    target: String(target),
    foreignKey: String(foreignKey),
  };
};

