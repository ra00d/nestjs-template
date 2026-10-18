import { Reflector } from '@nestjs/core';
import type { AuthorizeParams } from '../types/auth-types';
import type { Permission, Role } from '../types/rbac.types';

export const Authorize = Reflector.createDecorator<AuthorizeParams>();

export const RequirePermission = (permission: Permission) =>
  Authorize({ permissions: [permission] });

export const RequirePermissions = (...permissions: Permission[]) =>
  Authorize({ permissions });

export const RequireAnyPermission = (...permissions: Permission[]) =>
  Authorize({ anyPermission: permissions });

export const RequireRoles = (...roles: Role[]) => Authorize({ roles });
export const RequireRole = (role: Role) => Authorize({ roles: [role] });

export const RequireAnyRole = (...roles: Role[]) =>
  Authorize({ anyRole: roles });
