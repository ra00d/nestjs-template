import { Reflector } from '@nestjs/core';

type AuthorizeParams = {
  permissions?: string[];
  roles?: string[];
  anyRole?: string[];
  anyPermission?: string[];
};
// | {
//     permissions?: string[];
//     anyRoles?: string[];
//   }
// | {
//     roles?: string[];
//     anyPermissions?: string[];
//   }
// | {
//     anyRole?: string[];
//     anyPermission?: string[];
//   };

export const Authorize = Reflector.createDecorator<AuthorizeParams>();

export const RequirePermission = (permission: string) =>
  Authorize({ permissions: [permission] });

export const RequirePermissions = (...permissions: string[]) =>
  Authorize({ permissions: permissions });

export const RequireAnyPermission = (...permissions: string[]) =>
  Authorize({ anyPermission: permissions });

export const RequireRoles = (...roles: string[]) => Authorize({ roles: roles });
export const RequireRole = (role: string) => Authorize({ roles: [role] });

export const RequireAnyRole = (...roles: string[]) =>
  Authorize({ anyRole: roles });
