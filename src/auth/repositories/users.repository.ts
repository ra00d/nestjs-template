import { randomUUID } from 'node:crypto';
import { InjectDrizzle } from '@nestjs/drizzle';
import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { User } from '../types/user.js';
import {
  permissions,
  rolePermissions,
  roles,
  userPermissions,
  userRoles,
  users,
} from '../db/auth.schema.js';

type UserRow = {
  id: string;
  email: string;
  emailVerified: boolean;
  roles: User['roles'];
  passwordHash: string | null;
};

/**
 * The application's users, kept in PostgreSQL through Drizzle. Password
 * hashes stay inside this class: everything it returns is a `User` without
 * one, so a user can leave a route or a log without leaking its hash.
 */
@Injectable()
export class UsersRepository {
  constructor(@InjectDrizzle() private readonly db: NodePgDatabase) {}

  async create(
    email: string,
    {
      passwordHash = null,
      emailVerified = false,
      roles = ['customer'],
    }: {
      passwordHash?: string | null;
      emailVerified?: boolean;
      roles?: User['roles'];
    } = {},
  ): Promise<User> {
    const row: UserRow = {
      id: randomUUID(),
      email: normalize(email),
      emailVerified,
      roles,
      passwordHash,
    };
    const [created] = await this.db.insert(users).values(row).returning();
    return toUser(created);
  }

  async findById(id: string): Promise<User | null> {
    const [row] = await this.db.select().from(users).where(eq(users.id, id));
    return row ? toUser(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, normalize(email)));
    return row ? toUser(row) : null;
  }

  /** For password sign-in only. */
  async findCredentials(
    email: string,
  ): Promise<{ user: User; passwordHash: string | null } | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, normalize(email)));
    return row ? { user: toUser(row), passwordHash: row.passwordHash } : null;
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
        roles: ['customer'],
      })
      .onConflictDoNothing({ target: users.email })
      .returning();
    // Another request created it first: the row is there, under its own address.
    return created ? toUser(created) : this.findByEmail(email);
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
    permissionName: string,
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

const toUser = ({ id, email, emailVerified, roles }: UserRow): User => ({
  id,
  email,
  emailVerified,
  roles: [...roles],
});
