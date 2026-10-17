import type { users } from '../db/auth.schema';

/** A `users` row minus the password hash, which never leaves `UsersRepository`. */
export type UserRecord = Omit<typeof users.$inferSelect, 'passwordHash'>;

/**
 * A signed-in user: the account's columns plus the role slugs assigned to it
 * through `user_roles` and the names of the permissions it holds, directly
 * through `user_permissions` and through `role_permissions`. Derived from the
 * schema, so a column change cannot drift from the type.
 */
export interface User extends UserRecord {
  roles: string[];
  permissions: string[];
}
