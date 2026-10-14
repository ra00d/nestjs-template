import * as p from '@clack/prompts';
import type { FieldDefinition, FieldType } from './lib/types.ts';
import { cancel } from '../../tui/cancel.ts';
import { FIELD_TYPES } from './constants.ts';

export const askField = async (): Promise<FieldDefinition> => {
  const name = await p.text({
    message: 'Field name (camelCase)',
    placeholder: 'title',
    defaultValue: 'title',
  });
  if (p.isCancel(name)) cancel();
  if (!/^[a-z][A-Za-z0-9]*$/.test(String(name))) {
    p.log.error('Names must be camelCase, e.g. "authorId".');
    return askField();
  }
  const type = await p.select({ message: 'Field type', options: FIELD_TYPES });
  if (p.isCancel(type)) cancel();
  if (type === 'enum') {
    const values = await p.text({
      message: 'Enum values, comma-separated',
      placeholder: 'draft, published',
    });
    if (p.isCancel(values)) cancel();
    const list = String(values)
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (list.length === 0) {
      p.log.error('An enum field needs at least one value.');
      return askField();
    }
    return { name: String(name), type, values: list };
  }
  const required = await p.confirm({
    message: 'Required?',
    initialValue: true,
  });
  if (p.isCancel(required)) cancel();
  const searchable = await p.confirm({
    message: 'Searchable through ?search=?',
    initialValue: false,
  });
  if (p.isCancel(searchable)) cancel();
  const field: FieldDefinition = {
    name: String(name),
    type: type as FieldType,
    required: Boolean(required),
  };
  if (searchable) field.searchable = true;
  return field;
};

