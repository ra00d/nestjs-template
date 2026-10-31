/**
 * Roles and permissions are rows in the database, created and renamed at
 * runtime through the RBAC API, so they cannot be a closed union of literals.
 * Branded strings make them nominal instead: `Role` and `Permission` are not
 * interchangeable with each other or with any other string, and a value
 * becomes one only through `toRole` / `toPermission`.
 *
 * - `Role` is a role slug: what `user_roles` resolves to and `User.roles`
 *   carries.
 * - `Permission` is a permission name: what `user_permissions` and
 *   `role_permissions` resolve to and `User.permissions` carries.
 */

import { Brand } from '@/types';

/** A role slug, as carried by `User.roles`. */
export type RoleName = Brand<string, 'Role'>;

/** A permission name, as carried by `User.permissions`. */
export type PermissionName = Brand<string, 'Permission'>;

/** Brands a value as a `Role`, trimming it and rejecting blank ones.
 *
 * @description this is used to override the default behaveor please create a permission constant to avoid spelling mistakes
 * */
export function toRole(value: string): RoleName {
  return assertName(value, 'role') as RoleName;
}

/** Brands a value as a `Permission`, trimming it and rejecting blank ones.
 * @description this is used to override the default behaveor please create a permission constant to avoid spelling mistakes
 * */
export function toPermission(value: string): PermissionName {
  return assertName(value, 'permission') as PermissionName;
}

function assertName(value: string, kind: 'role' | 'permission'): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new TypeError(`A ${kind} needs a non-empty name.`);
  }
  return trimmed;
}
