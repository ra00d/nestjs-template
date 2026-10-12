import { timestamp } from 'drizzle-orm/pg-core';

export const at = (name: string) =>
  timestamp(name, { withTimezone: true, mode: 'date' });

export type Datebase = any;
