import type { FieldType } from './lib/types.ts';

/**
 * Shared paths and option lists for the gen command.
 */
export const ENTITIES_PATH = 'tools/entities.ts';
export const APP_MODULE_PATH = 'src/app.module.ts';

export const FIELD_TYPES: { value: FieldType; label: string; hint?: string }[] =
  [
    { value: 'text', label: 'text', hint: 'string column, ilike search' },
    { value: 'uuid', label: 'uuid' },
    { value: 'integer', label: 'integer', hint: 'whole number' },
    { value: 'boolean', label: 'boolean' },
    { value: 'timestamp', label: 'timestamp', hint: 'timestamptz' },
    { value: 'enum', label: 'enum', hint: 'text column restricted to values' },
    {
      value: 'jsonb',
      label: 'jsonb',
      hint: 'structured column, not filterable',
    },
  ];

