import type { User } from '@/auth/types';
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
 * @Can(RBACPolicy, 'is', () => ['admin'] as const)
 * archive() {}
 *
 * @Can(RBACPolicy, 'oneOf', () => [['staff', 'editor']] as const)
 * moderate() {}
 */
@Policy()
export class RBACPolicy {
  /** Whether the user has `role`. */
  is(user: User | null, role: string): boolean {
    return hasRole(user, role);
  }

  /** Whether the user does not have `role`; guests pass. */
  not(user: User | null, role: string): boolean {
    return !hasRole(user, role);
  }

  /** Whether the user has at least one of `roles` or `permissions`; an empty list checks nothing and fails. */
  oneOf(user: User | null, rolesAndPermissions: readonly string[]): boolean {
    return rolesAndPermissions.some(
      (role) => hasRole(user, role) || hasPermission(user, role),
    );
  }

  /** Whether the user has every one of `roles` or `permissions`; an empty list checks nothing and fails. */
  allOf(user: User | null, rolesAndPermissions: readonly string[]): boolean {
    return (
      rolesAndPermissions.length > 0 &&
      rolesAndPermissions.every(
        (role) => hasRole(user, role) && hasPermission(user, role),
      )
    );
  }

  /** Whether the user has none of `roles` or `permissions`; guests pass. */
  noneOf(user: User | null, rolesAndPermissions: readonly string[]): boolean {
    return !rolesAndPermissions.some(
      (role) => hasRole(user, role) || hasPermission(user, role),
    );
  }
  can(user: User | null, permissions: readonly string[]): boolean {
    return (
      permissions.length > 0 &&
      permissions.every((permission) => hasPermission(user, permission))
    );
  }
}

const hasRole = (user: User | null, role: string): boolean =>
  user?.roles.includes(role) ?? false;

const hasPermission = (user: User | null, permission: string): boolean =>
  user?.permissions?.includes(permission) ?? false;
