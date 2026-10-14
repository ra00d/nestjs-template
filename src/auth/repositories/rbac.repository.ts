import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { and, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { randomUUID } from 'node:crypto';
import { currentTx } from '../../database/transaction.js';
import { permissions, rolePermissions, roles } from '../db/auth.schema.js';

const slugify = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || value;

export type RoleRecord = typeof roles.$inferSelect;
export type NewRoleRecord = typeof roles.$inferInsert;
export type PermissionRecord = typeof permissions.$inferSelect;
export type NewPermissionRecord = typeof permissions.$inferInsert;

@Injectable()
export class RBACRepository {
  constructor(@InjectDrizzle() private readonly baseDb: NodePgDatabase) {}

  /** Use the active transaction (if any) over the injected database. */
  private get db(): NodePgDatabase {
    return (currentTx() as unknown as NodePgDatabase | undefined) ?? this.baseDb;
  }

  // Roles

  async createRole(
    inputOrName:
      | string
      | {
          id?: string;
          name: string;
          slug?: string | null;
          description?: string | null;
        },
    description?: string | null,
  ): Promise<RoleRecord> {
    const input =
      typeof inputOrName === 'string'
        ? { name: inputOrName, description: description ?? null }
        : inputOrName;
    const [created] = await this.db
      .insert(roles)
      .values({
        id: input.id ?? randomUUID(),
        name: input.name,
        slug: input.slug ?? slugify(input.name),
        description: input.description ?? null,
      })
      .returning();
    return created;
  }

  async findRoleById(id: string): Promise<RoleRecord | null> {
    const [row] = await this.db.select().from(roles).where(eq(roles.id, id));
    return row ?? null;
  }

  async findRoleByName(name: string): Promise<RoleRecord | null> {
    const [row] = await this.db
      .select()
      .from(roles)
      .where(eq(roles.name, name));
    return row ?? null;
  }

  async listRoles(): Promise<RoleRecord[]> {
    return this.db.select().from(roles);
  }

  async findAllRoles(): Promise<RoleRecord[]> {
    return this.listRoles();
  }

  async updateRole(
    id: string,
    input: Partial<{ name: string; slug: string; description: string | null }>,
  ): Promise<RoleRecord | null> {
    const [updated] = await this.db
      .update(roles)
      .set(input)
      .where(eq(roles.id, id))
      .returning();
    return updated ?? null;
  }

  async deleteRole(id: string): Promise<void> {
    await this.db.delete(roles).where(eq(roles.id, id));
  }

  // Permissions

  async createPermission(
    inputOrName:
      | string
      | {
          id?: string;
          name: string;
          slug?: string | null;
          description?: string | null;
          resource?: string | null;
          action?: string | null;
        },
    description?: string | null,
  ): Promise<PermissionRecord> {
    const input =
      typeof inputOrName === 'string'
        ? { name: inputOrName, description: description ?? null }
        : inputOrName;
    const [created] = await this.db
      .insert(permissions)
      .values({
        id: input.id ?? randomUUID(),
        name: input.name,
        slug: input.slug ?? slugify(input.name),
        description: input.description ?? null,
        resource: input.resource ?? null,
        action: input.action ?? null,
      })
      .returning();
    return created;
  }

  async findPermissionById(id: string): Promise<PermissionRecord | null> {
    const [row] = await this.db
      .select()
      .from(permissions)
      .where(eq(permissions.id, id));
    return row ?? null;
  }

  async findPermissionByName(name: string): Promise<PermissionRecord | null> {
    const [row] = await this.db
      .select()
      .from(permissions)
      .where(eq(permissions.name, name));
    return row ?? null;
  }

  async listPermissions(): Promise<PermissionRecord[]> {
    return this.db.select().from(permissions);
  }

  async findAllPermissions(): Promise<PermissionRecord[]> {
    return this.listPermissions();
  }

  async updatePermission(
    id: string,
    input: Partial<{
      name: string;
      slug: string;
      description: string | null;
      resource: string | null;
      action: string | null;
    }>,
  ): Promise<PermissionRecord | null> {
    const [updated] = await this.db
      .update(permissions)
      .set(input)
      .where(eq(permissions.id, id))
      .returning();
    return updated ?? null;
  }

  async deletePermission(id: string): Promise<void> {
    await this.db.delete(permissions).where(eq(permissions.id, id));
  }

  // Role <-> permission

  async assignPermissionToRole(
    roleId: string,
    permissionId: string,
  ): Promise<void> {
    await this.db
      .insert(rolePermissions)
      .values({ roleId, permissionId })
      .onConflictDoNothing();
  }

  async grantPermissionToRole(
    roleId: string,
    permissionId: string,
  ): Promise<void> {
    return this.assignPermissionToRole(roleId, permissionId);
  }

  async addPermissionToRole(
    roleId: string,
    permissionId: string,
  ): Promise<void> {
    return this.assignPermissionToRole(roleId, permissionId);
  }

  async removePermissionFromRole(
    roleId: string,
    permissionId: string,
  ): Promise<void> {
    await this.db
      .delete(rolePermissions)
      .where(
        and(
          eq(rolePermissions.roleId, roleId),
          eq(rolePermissions.permissionId, permissionId),
        ),
      );
  }

  async revokePermissionFromRole(
    roleId: string,
    permissionId: string,
  ): Promise<void> {
    return this.removePermissionFromRole(roleId, permissionId);
  }

  async getRolePermissions(roleId: string): Promise<PermissionRecord[]> {
    const rows = await this.db
      .select({ permission: permissions })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, roleId));
    return rows.map((row) => row.permission);
  }

  async listRolePermissions(roleId: string): Promise<PermissionRecord[]> {
    return this.getRolePermissions(roleId);
  }

  async permissionsForRole(roleId: string): Promise<PermissionRecord[]> {
    return this.getRolePermissions(roleId);
  }

  async hasPermissionInRole(
    roleId: string,
    permissionId: string,
  ): Promise<boolean> {
    const [row] = await this.db
      .select({ roleId: rolePermissions.roleId })
      .from(rolePermissions)
      .where(
        and(
          eq(rolePermissions.roleId, roleId),
          eq(rolePermissions.permissionId, permissionId),
        ),
      )
      .limit(1);
    return !!row;
  }
}
