// oxlint-disable typescript/unbound-method
import { randomUUID } from 'node:crypto';
import { InjectDrizzle } from '@nestjs/drizzle';
import { Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  toPermission,
  toRole,
  type Permission,
  type Role,
} from '../types/rbac.types.js';
import { User } from '../types/user.js';
import {
  permissions,
  rolePermissions,
  roles,
  userPermissions,
  userRoles,
  users,
} from '../db/auth.schema.js';

import { currentTx } from '../../database/transaction.js';

/** A full `users` row: what the database holds, password hash included. */
type UserRow = typeof users.$inferSelect;

/**
 * The application's users, kept in PostgreSQL through Drizzle. Password
 * hashes stay inside this class: everything it returns is a `User` without
 * one, so a user can leave a route or a log without leaking its hash. Every
 * returned user carries the role slugs assigned through `user_roles` and the
 * permission names it holds, directly and through those roles.
 */
@Injectable()
export class UsersRepository {
  constructor(@InjectDrizzle() private readonly baseDb: NodePgDatabase) {}

  /** Use the active transaction (if any) over the injected database. */
  private get db(): NodePgDatabase {
    return (
      (currentTx() as unknown as NodePgDatabase | undefined) ?? this.baseDb
    );
  }

  async create(
    email: string,
    {
      passwordHash = null,
      emailVerified = false,
      roles: roleSlugs = [toRole('customer')],
    }: {
      passwordHash?: string | null;
      emailVerified?: boolean;
      roles?: User['roles'];
    } = {},
  ): Promise<User> {
    const [created] = await this.db
      .insert(users)
      .values({
        id: randomUUID(),
        email: normalize(email),
        emailVerified,
        passwordHash,
      })
      .returning();
    const assigned = [...new Set(roleSlugs)];
    await this.assignRoleSlugs(created.id, assigned);
    const permissions =
      (await permissionNamesByUser(this.db, [created.id])).get(created.id) ??
      [];
    return toUser(created, assigned, permissions);
  }

  async findById(id: string): Promise<User | null> {
    const [row] = await this.db.select().from(users).where(eq(users.id, id));
    if (!row) {
      return null;
    }
    const [user] = await this.hydrate([row]);
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, normalize(email)));
    if (!row) {
      return null;
    }
    const [user] = await this.hydrate([row]);
    return user;
  }

  /** For password sign-in only. */
  async findCredentials(
    email: string,
  ): Promise<{ user: User; passwordHash: string | null } | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, normalize(email)));
    if (!row) {
      return null;
    }
    const [user] = await this.hydrate([row]);
    return { user, passwordHash: row.passwordHash };
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.db.update(users).set({ passwordHash }).where(eq(users.id, id));
  }

  /**
   * The account for an address, created without a password when there is none:
   * a magic link is the whole sign-in, and it proves the address, so the
   * account starts verified. The insert is conditional, so two links used for
   * the same new address at once still leave one account.
   */
  async findOrCreate(email: string): Promise<User | null> {
    const found = await this.findByEmail(email);
    if (found) {
      return found;
    }
    const [created] = await this.db
      .insert(users)
      .values({
        id: randomUUID(),
        email: normalize(email),
        passwordHash: null,
        emailVerified: true,
      })
      .onConflictDoNothing({ target: users.email })
      .returning();
    if (!created) {
      // Another request created it first: the row is there, under its own address.
      return this.findByEmail(email);
    }
    await this.assignRoleSlugs(created.id, [toRole('customer')]);
    const permissions =
      (await permissionNamesByUser(this.db, [created.id])).get(created.id) ??
      [];
    return toUser(created, [toRole('customer')], permissions);
  }

  /**
   * Attaches each row's role slugs and permission names, read through
   * `user_roles`, `user_permissions` and `role_permissions`.
   */
  private async hydrate(rows: UserRow[]): Promise<User[]> {
    const ids = rows.map((row) => row.id);
    const [rolesById, permissionsById] = await Promise.all([
      rolesByUser(this.db, ids),
      permissionNamesByUser(this.db, ids),
    ]);
    return rows.map((row) =>
      toUser(
        row,
        rolesById.get(row.id) ?? [],
        permissionsById.get(row.id) ?? [],
      ),
    );
  }

  /**
   * Assigns role slugs, inserting a `roles` row for any slug that does not
   * exist yet: the first user of a fresh install registers before the roles
   * they ask for exist.
   */
  private async assignRoleSlugs(userId: string, slugs: Role[]): Promise<void> {
    if (slugs.length === 0) {
      return;
    }
    await this.db
      .insert(roles)
      .values(slugs.map((slug) => ({ id: randomUUID(), name: slug, slug })))
      .onConflictDoNothing();
    const existing = await this.db
      .select({ id: roles.id, slug: roles.slug })
      .from(roles)
      .where(inArray(roles.slug, slugs));
    await this.db
      .insert(userRoles)
      .values(existing.map((role) => ({ userId, roleId: role.id })))
      .onConflictDoNothing();
  }

  /**
   * Marks the address verified, only if it is still the user's: a link sent
   * to an old address verifies nothing. One conditional update, as the
   * `EmailVerificationHandler` contract asks.
   */
  async markEmailVerified(id: string, email: string): Promise<boolean> {
    const updated = await this.db
      .update(users)
      .set({ emailVerified: true })
      .where(and(eq(users.id, id), eq(users.email, normalize(email))))
      .returning({ id: users.id });
    return updated.length > 0;
  }

  // Role assignments

  async assignRole(userId: string, roleId: string): Promise<void> {
    await this.db
      .insert(userRoles)
      .values({ userId, roleId })
      .onConflictDoNothing();
  }

  async addRole(userId: string, roleId: string): Promise<void> {
    return this.assignRole(userId, roleId);
  }

  async grantRole(userId: string, roleId: string): Promise<void> {
    return this.assignRole(userId, roleId);
  }

  async removeRole(userId: string, roleId: string): Promise<void> {
    await this.db
      .delete(userRoles)
      .where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId)));
  }

  async revokeRole(userId: string, roleId: string): Promise<void> {
    return this.removeRole(userId, roleId);
  }

  async unassignRole(userId: string, roleId: string): Promise<void> {
    return this.removeRole(userId, roleId);
  }

  async getUserRoles(userId: string): Promise<(typeof roles.$inferSelect)[]> {
    const rows = await this.db
      .select({ role: roles })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, userId));
    return rows.map((row) => row.role);
  }

  async listUserRoles(userId: string): Promise<(typeof roles.$inferSelect)[]> {
    return this.getUserRoles(userId);
  }

  async findUserRoles(userId: string): Promise<(typeof roles.$inferSelect)[]> {
    return this.getUserRoles(userId);
  }

  async rolesForUser(userId: string): Promise<(typeof roles.$inferSelect)[]> {
    return this.getUserRoles(userId);
  }

  async hasRole(userId: string, roleId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ roleId: userRoles.roleId })
      .from(userRoles)
      .where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId)))
      .limit(1);
    return !!row;
  }

  async hasRoleByName(userId: string, roleName: string): Promise<boolean> {
    const role = await this.db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, roleName))
      .limit(1);
    if (!role[0]) {
      return false;
    }
    return this.hasRole(userId, role[0].id);
  }

  // Permission assignments

  async assignPermission(userId: string, permissionId: string): Promise<void> {
    await this.db
      .insert(userPermissions)
      .values({ userId, permissionId })
      .onConflictDoNothing();
  }

  async addPermission(userId: string, permissionId: string): Promise<void> {
    return this.assignPermission(userId, permissionId);
  }

  async grantPermission(userId: string, permissionId: string): Promise<void> {
    return this.assignPermission(userId, permissionId);
  }

  async removePermission(userId: string, permissionId: string): Promise<void> {
    await this.db
      .delete(userPermissions)
      .where(
        and(
          eq(userPermissions.userId, userId),
          eq(userPermissions.permissionId, permissionId),
        ),
      );
  }

  async revokePermission(userId: string, permissionId: string): Promise<void> {
    return this.removePermission(userId, permissionId);
  }

  async unassignPermission(
    userId: string,
    permissionId: string,
  ): Promise<void> {
    return this.removePermission(userId, permissionId);
  }

  async getUserDirectPermissions(
    userId: string,
  ): Promise<(typeof permissions.$inferSelect)[]> {
    const rows = await this.db
      .select({ permission: permissions })
      .from(userPermissions)
      .innerJoin(permissions, eq(userPermissions.permissionId, permissions.id))
      .where(eq(userPermissions.userId, userId));
    return rows.map((row) => row.permission);
  }

  async getUserPermissions(
    userId: string,
  ): Promise<(typeof permissions.$inferSelect)[]> {
    const direct = await this.getUserDirectPermissions(userId);
    const roleRows = await this.db
      .select({ permission: permissions })
      .from(userRoles)
      .innerJoin(rolePermissions, eq(userRoles.roleId, rolePermissions.roleId))
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(userRoles.userId, userId));
    const fromRoles = roleRows.map((row) => row.permission);
    const seen = new Set<string>();
    const merged: (typeof permissions.$inferSelect)[] = [];
    for (const permission of [...direct, ...fromRoles]) {
      if (seen.has(permission.id)) {
        continue;
      }
      seen.add(permission.id);
      merged.push(permission);
    }
    return merged;
  }

  async listUserPermissions(
    userId: string,
  ): Promise<(typeof permissions.$inferSelect)[]> {
    return this.getUserPermissions(userId);
  }

  async findUserPermissions(
    userId: string,
  ): Promise<(typeof permissions.$inferSelect)[]> {
    return this.getUserPermissions(userId);
  }

  async permissionsForUser(
    userId: string,
  ): Promise<(typeof permissions.$inferSelect)[]> {
    return this.getUserPermissions(userId);
  }

  async effectivePermissions(
    userId: string,
  ): Promise<(typeof permissions.$inferSelect)[]> {
    return this.getUserPermissions(userId);
  }

  /** The names of the permissions the user holds, direct and through roles. */
  async getUserPermissionNames(userId: string): Promise<Permission[]> {
    return (await this.getUserPermissions(userId)).map((permission) =>
      toPermission(permission.name),
    );
  }

  async listUserPermissionNames(userId: string): Promise<Permission[]> {
    return this.getUserPermissionNames(userId);
  }

  async hasPermission(userId: string, permissionId: string): Promise<boolean> {
    const [direct] = await this.db
      .select({ permissionId: userPermissions.permissionId })
      .from(userPermissions)
      .where(
        and(
          eq(userPermissions.userId, userId),
          eq(userPermissions.permissionId, permissionId),
        ),
      )
      .limit(1);
    if (direct) {
      return true;
    }
    const [throughRole] = await this.db
      .select({ permissionId: rolePermissions.permissionId })
      .from(userRoles)
      .innerJoin(rolePermissions, eq(userRoles.roleId, rolePermissions.roleId))
      .where(
        and(
          eq(userRoles.userId, userId),
          eq(rolePermissions.permissionId, permissionId),
        ),
      )
      .limit(1);
    return !!throughRole;
  }

  async hasPermissionByName(
    userId: string,
    permissionName: Permission,
  ): Promise<boolean> {
    const permission = await this.db
      .select({ id: permissions.id })
      .from(permissions)
      .where(eq(permissions.name, permissionName))
      .limit(1);
    if (!permission[0]) {
      return false;
    }
    return this.hasPermission(userId, permission[0].id);
  }

  // Assignment aliases expected by different callers.

  assignRoleToUser = this.assignRole;
  addRoleToUser = this.assignRole;
  grantRoleToUser = this.assignRole;
  removeRoleFromUser = this.removeRole;
  revokeRoleFromUser = this.removeRole;
  unassignRoleFromUser = this.removeRole;
  assignPermissionToUser = this.assignPermission;
  addPermissionToUser = this.assignPermission;
  grantPermissionToUser = this.assignPermission;
  removePermissionFromUser = this.removePermission;
  revokePermissionFromUser = this.removePermission;
  unassignPermissionFromUser = this.removePermission;
}

const normalize = (email: string) =>
  email.trim().normalize('NFC').toLowerCase();

const toUser = (
  { passwordHash: _, ...account }: UserRow,
  roles: Role[],
  permissions: Permission[],
): User => ({ ...account, roles, permissions });

/**
 * Role slugs per user id, read through `user_roles`. Anything loading several
 * users at once reads their assignments in one query this way.
 */
async function rolesByUser(
  db: NodePgDatabase,
  userIds: string[],
): Promise<Map<string, Role[]>> {
  const byUser = new Map<string, Role[]>();
  if (userIds.length === 0) {
    return byUser;
  }
  const rows = await db
    .select({ userId: userRoles.userId, slug: roles.slug })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(inArray(userRoles.userId, userIds));
  for (const { userId, slug } of rows) {
    const slugs = byUser.get(userId) ?? [];
    slugs.push(toRole(slug));
    byUser.set(userId, slugs);
  }
  return byUser;
}

/**
 * Permission names per user id: the direct assignments through
 * `user_permissions` plus everything the users' roles carry through
 * `role_permissions`. Names dedupe on insert, so a permission held both ways
 * appears once.
 */
async function permissionNamesByUser(
  db: NodePgDatabase,
  userIds: string[],
): Promise<Map<string, Permission[]>> {
  const byUser = new Map<string, Permission[]>();
  if (userIds.length === 0) {
    return byUser;
  }
  const direct = await db
    .select({ userId: userPermissions.userId, name: permissions.name })
    .from(userPermissions)
    .innerJoin(permissions, eq(userPermissions.permissionId, permissions.id))
    .where(inArray(userPermissions.userId, userIds));
  const throughRoles = await db
    .select({ userId: userRoles.userId, name: permissions.name })
    .from(userRoles)
    .innerJoin(rolePermissions, eq(userRoles.roleId, rolePermissions.roleId))
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(inArray(userRoles.userId, userIds));
  for (const { userId, name } of [...direct, ...throughRoles]) {
    const names = byUser.get(userId) ?? [];
    const permission = toPermission(name);
    if (!names.includes(permission)) {
      names.push(permission);
    }
    byUser.set(userId, names);
  }
  return byUser;
}

/**
 * The users with `ids`, each carrying its role slugs and permission names.
 * Shared with the generated modules that include an author, so every user in
 * a response is shaped the same way and never carries a password hash.
 */
export async function findUsersByIds(
  db: NodePgDatabase,
  ids: string[],
): Promise<User[]> {
  if (ids.length === 0) {
    return [];
  }
  const rows = await db.select().from(users).where(inArray(users.id, ids));
  const [rolesById, permissionsById] = await Promise.all([
    rolesByUser(db, ids),
    permissionNamesByUser(db, ids),
  ]);
  return rows.map((row) =>
    toUser(row, rolesById.get(row.id) ?? [], permissionsById.get(row.id) ?? []),
  );
}
