// All drizzle schemas and relations

import * as abacSchema from './modules/abac/abac.schema';
import * as auditSchema from './modules/audit/audit.schema';
import * as authSchema from './modules/auth/db';
import * as authRelations from './modules/auth/db/auth.relations';

// Flat table exports keep every table visible to drizzle-kit.
export * from './modules/abac/abac.schema';
export * from './modules/audit/audit.schema';
export * from './modules/auth/db';

export const schema = {
  ...authSchema,
  ...auditSchema,
  ...abacSchema,
};

export const relations = {
  ...authRelations.authRelations,
};
