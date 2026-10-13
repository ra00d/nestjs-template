import { timestamp } from 'drizzle-orm/pg-core';

export const at = (name: string) =>
  timestamp(name, { withTimezone: true, mode: 'date' });

export const timestamps = {
  createdAt: at('created_at').defaultNow(),
  updatedAt: at('updated_at').$onUpdate(() => new Date()),
  deletedAt: at('deleted_at'),
};
