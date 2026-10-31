import { Reflector } from '@nestjs/core';
import type { AuthorizeParams } from '../types/auth-types';
import type { PermissionName, RoleName } from '../types/rbac.types';

export const Authorize = Reflector.createDecorator<AuthorizeParams>();

export const RequirePermission = (permission: PermissionName) =>
  Authorize({ permissions: [permission] });

export const RequirePermissions = (...permissions: PermissionName[]) =>
  Authorize({ permissions });

export const RequireAnyPermission = (...permissions: PermissionName[]) =>
  Authorize({ anyPermission: permissions });

export const RequireRoles = (...roles: RoleName[]) => Authorize({ roles });
export const RequireRole = (role: RoleName) => Authorize({ roles: [role] });

export const RequireAnyRole = (...roles: RoleName[]) =>
  Authorize({ anyRole: roles });
