import type { SeedFunc } from '@/database';
import { seed } from 'drizzle-seed';
import { roles } from './auth.schema';

export const authSeeder: SeedFunc = async (db) => {
  await seed(db, { roles }).refine((fn) => ({
    roles: {
      count: 3,
      columns: {
        name: fn.valuesFromArray({
          values: ['admin', 'user', 'guest'],
          isUnique: true,
        }),
        slug: fn.valuesFromArray({
          values: ['admin', 'user', 'guest'],
          isUnique: true,
        }),
      },
    },
  }));
};

export default authSeeder;
