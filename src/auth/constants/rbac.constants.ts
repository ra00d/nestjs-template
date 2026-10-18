import { toPermission, toRole, type Permission, type Role } from '../types';

/** The roles the template ships with. */
export const DEFAULT_ROLES = {
  admin: toRole('admin'),
  user: toRole('user'),
  guest: toRole('guest'),
};

/**
 * Permissions over the authentication domain, named `resource:action`.
 * `read` covers the list/detail endpoints, `manage` the create, update,
 * delete and assignment endpoints of the RBAC API.
 */
export const DEFAULT_PERMISSIONS = {
  usersRead: toPermission('users:read'),
  usersManage: toPermission('users:manage'),
  rolesRead: toPermission('roles:read'),
  rolesManage: toPermission('roles:manage'),
  permissionsRead: toPermission('permissions:read'),
  permissionsManage: toPermission('permissions:manage'),
};

/**
 * What each default role grants: `admin` everything, `user` the read-only
 * set, `guest` nothing until an install decides otherwise.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  [DEFAULT_ROLES.admin]: Object.values(DEFAULT_PERMISSIONS),
  [DEFAULT_ROLES.user]: [
    DEFAULT_PERMISSIONS.usersRead,
    DEFAULT_PERMISSIONS.rolesRead,
    DEFAULT_PERMISSIONS.permissionsRead,
  ],
  [DEFAULT_ROLES.guest]: [],
};
