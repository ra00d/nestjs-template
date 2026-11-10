import { AppLogger } from '@/common/logger';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { NodeRequest } from '@nestjs/platform-node';
import { Observable } from 'rxjs';
import { PUBLIC_API } from '../decorators/public.decorator';
import { Authorize } from '../decorators/rbac.decorator';
import { RBACPolicy } from '../policies/rbac.policy';
import type { AuthorizeParams } from '../types/auth-types';
import type { PermissionName, RoleName } from '../types/rbac.types';

@Injectable()
export class AuthzGuard implements CanActivate {
  constructor(
    private readonly rbacPolicy: RBACPolicy,
    private readonly reflector: Reflector,
    private readonly logger: AppLogger,
  ) {}
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride(PUBLIC_API, [
      context.getClass(),
      context.getHandler(),
    ]);
    if (isPublic) return true;
    const req = context.switchToHttp().getRequest<NodeRequest>();
    const user = req.user;
    this.logger.log(user);

    if (!user) return false;
    const authzParams = this.reflector.getAllAndOverride(Authorize, [
      context.getClass(),
      context.getHandler(),
    ]);

    const allOf = this.getRequiredAuthorizations(authzParams);
    const anyOf = this.getOptionalAuthorizations(authzParams);

    if (allOf.length == 0 && anyOf.length == 0) {
      return true;
    }

    if (allOf.length > 0 && this.rbacPolicy.allOf(user, allOf)) return true;
    if (anyOf.length > 0 && this.rbacPolicy.oneOf(user, anyOf)) return true;

    return false;
  }
  private getRequiredAuthorizations(
    params: AuthorizeParams,
  ): (RoleName | PermissionName)[] {
    return [
      ...new Set([
        ...(params?.permissions ?? []),
        ...(params?.roles ?? []),
        // ...(params.anyRole ?? []),
        // ...(params.anyPermission ?? []),
      ]),
    ];
  }
  private getOptionalAuthorizations(
    params: AuthorizeParams,
  ): (RoleName | PermissionName)[] {
    return [
      ...new Set([
        // ...(params.permissions ?? []),
        // ...(params.roles ?? []),
        ...(params?.anyRole ?? []),
        ...(params?.anyPermission ?? []),
      ]),
    ];
  }
}
