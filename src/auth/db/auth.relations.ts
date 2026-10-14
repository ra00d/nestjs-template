import { defineRelationsPart } from 'drizzle-orm';
import {
  permissions,
  rolePermissions,
  roles,
  userPermissions,
  userRoles,
  users,
} from './auth.schema.js';

export const authRelations = defineRelationsPart(
  { users, roles, permissions, rolePermissions, userRoles, userPermissions },
  (r) => ({
    users: {
      assignedRoles: r.many.roles({
        from: r.users.id.through(r.userRoles.userId),
        to: r.roles.id.through(r.userRoles.roleId),
      }),
      assignedPermissions: r.many.permissions({
        from: r.users.id.through(r.userPermissions.userId),
        to: r.permissions.id.through(r.userPermissions.permissionId),
      }),
    },
    roles: {
      permissions: r.many.permissions({
        from: r.roles.id.through(r.rolePermissions.roleId),
        to: r.permissions.id.through(r.rolePermissions.permissionId),
      }),
      assignedUsers: r.many.users({
        from: r.roles.id.through(r.userRoles.roleId),
        to: r.users.id.through(r.userRoles.userId),
      }),
    },
    permissions: {
      roles: r.many.roles({
        from: r.permissions.id.through(r.rolePermissions.permissionId),
        to: r.roles.id.through(r.rolePermissions.roleId),
      }),
      assignedUsers: r.many.users({
        from: r.permissions.id.through(r.userPermissions.permissionId),
        to: r.users.id.through(r.userPermissions.userId),
      }),
    },
    rolePermissions: {
      role: r.one.roles({
        from: r.rolePermissions.roleId,
        to: r.roles.id,
      }),
      permission: r.one.permissions({
        from: r.rolePermissions.permissionId,
        to: r.permissions.id,
      }),
    },
    userRoles: {
      user: r.one.users({
        from: r.userRoles.userId,
        to: r.users.id,
      }),
      role: r.one.roles({
        from: r.userRoles.roleId,
        to: r.roles.id,
      }),
    },
    userPermissions: {
      user: r.one.users({
        from: r.userPermissions.userId,
        to: r.users.id,
      }),
      permission: r.one.permissions({
        from: r.userPermissions.permissionId,
        to: r.permissions.id,
      }),
    },
  }),
);

// Convenience exports matching single-entity relation file conventions.
export const usersRelations = defineRelationsPart(
  { users, roles, permissions, userRoles, userPermissions },
  (r) => ({
    users: {
      assignedRoles: r.many.roles({
        from: r.users.id.through(r.userRoles.userId),
        to: r.roles.id.through(r.userRoles.roleId),
      }),
      assignedPermissions: r.many.permissions({
        from: r.users.id.through(r.userPermissions.userId),
        to: r.permissions.id.through(r.userPermissions.permissionId),
      }),
    },
  }),
);

export const rolesRelations = defineRelationsPart(
  { roles, permissions, users, rolePermissions, userRoles },
  (r) => ({
    roles: {
      permissions: r.many.permissions({
        from: r.roles.id.through(r.rolePermissions.roleId),
        to: r.permissions.id.through(r.rolePermissions.permissionId),
      }),
      assignedUsers: r.many.users({
        from: r.roles.id.through(r.userRoles.roleId),
        to: r.users.id.through(r.userRoles.userId),
      }),
    },
  }),
);

export const permissionsRelations = defineRelationsPart(
  { permissions, roles, users, rolePermissions, userPermissions },
  (r) => ({
    permissions: {
      roles: r.many.roles({
        from: r.permissions.id.through(r.rolePermissions.permissionId),
        to: r.roles.id.through(r.rolePermissions.roleId),
      }),
      assignedUsers: r.many.users({
        from: r.permissions.id.through(r.userPermissions.permissionId),
        to: r.users.id.through(r.userPermissions.userId),
      }),
    },
  }),
);

export const rolePermissionsRelations = defineRelationsPart(
  { rolePermissions, roles, permissions },
  (r) => ({
    rolePermissions: {
      role: r.one.roles({
        from: r.rolePermissions.roleId,
        to: r.roles.id,
      }),
      permission: r.one.permissions({
        from: r.rolePermissions.permissionId,
        to: r.permissions.id,
      }),
    },
  }),
);

export const userRolesRelations = defineRelationsPart(
  { userRoles, users, roles },
  (r) => ({
    userRoles: {
      user: r.one.users({
        from: r.userRoles.userId,
        to: r.users.id,
      }),
      role: r.one.roles({
        from: r.userRoles.roleId,
        to: r.roles.id,
      }),
    },
  }),
);

export const userPermissionsRelations = defineRelationsPart(
  { userPermissions, users, permissions },
  (r) => ({
    userPermissions: {
      user: r.one.users({
        from: r.userPermissions.userId,
        to: r.users.id,
      }),
      permission: r.one.permissions({
        from: r.userPermissions.permissionId,
        to: r.permissions.id,
      }),
    },
  }),
);

export default authRelations;
