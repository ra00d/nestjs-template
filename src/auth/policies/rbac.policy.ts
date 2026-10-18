import type { Permission, Role, User } from '@/auth/types';
import { Policy } from '@/auth/decorators/policy.decorator';

/**
 * Role-based access control over the role slugs the signed-in user carries.
 * The slugs are read from `roles` (assigned through `user_roles` and loaded
 * onto `User` by `UsersRepository`), so an ability is a pure check: the guard
 * does no database work.
 *
 * The user parameter accepts `null`: the authorization guard runs for guests
 * too, and a guest has no roles. Positive checks fail and negative ones pass.
 *
 * @example
 * @Can(RBACPolicy, 'is', () => [toRole('admin')] as const)
 * archive() {}
 *
 * @Can(RBACPolicy, 'oneOf', () => [toRole('staff'), toPermission('moderate')] as const)
 * moderate() {}
 */
@Policy()
export class RBACPolicy {
  /** Whether the user has `role`. */
  is(user: User | null, role: Role): boolean {
    return hasRole(user, role);
  }

  /** Whether the user does not have `role`; guests pass. */
  not(user: User | null, role: Role): boolean {
    return !hasRole(user, role);
  }

  /** Whether the user has at least one of `roles` or `permissions`; an empty list checks nothing and fails. */
  oneOf(
    user: User | null,
    rolesAndPermissions: readonly (Role | Permission)[],
  ): boolean {
    return rolesAndPermissions.some(
      (role) => hasRole(user, role) || hasPermission(user, role),
    );
  }

  /** Whether the user has every one of `roles` or `permissions`; an empty list checks nothing and fails. */
  allOf(
    user: User | null,
    rolesAndPermissions: readonly (Role | Permission)[],
  ): boolean {
    return (
      rolesAndPermissions.length > 0 &&
      rolesAndPermissions.every(
        (role) => hasRole(user, role) || hasPermission(user, role),
      )
    );
  }

  /** Whether the user has none of `roles` or `permissions`; guests pass. */
  noneOf(
    user: User | null,
    rolesAndPermissions: readonly (Role | Permission)[],
  ): boolean {
    return !rolesAndPermissions.some(
      (role) => hasRole(user, role) || hasPermission(user, role),
    );
  }
  can(user: User | null, permissions: readonly Permission[]): boolean {
    return (
      permissions.length > 0 &&
      permissions.every((permission) => hasPermission(user, permission))
    );
  }
}

// Brands are erased at runtime, and `oneOf`/`allOf`/`noneOf` take mixed lists:
// each entry is looked up in both arrays. Only the public signatures (`is`,
// `can`, ...) keep roles and permissions apart.
const hasRole = (user: User | null, role: Role | Permission): boolean =>
  user?.roles.includes(role as Role) ?? false;

const hasPermission = (
  user: User | null,
  permission: Role | Permission,
): boolean => user?.permissions.includes(permission as Permission) ?? false;
