import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { RBACPolicy } from '../policies/rbac.policy';
import { Reflector } from '@nestjs/core';
import { Authorize } from '../decorators/rbac.decorator';
import { PUBLIC_API } from '../decorators/public.decorator';
import { FastifyRequest } from 'fastify';
import { AuthorizeParams } from '../types/auth-types';

@Injectable()
export class AuthzGuard implements CanActivate {
  constructor(
    private readonly rbacPolicy: RBACPolicy,
    private readonly reflector: Reflector,
  ) {}
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride(PUBLIC_API, [
      context.getClass(),
      context.getHandler(),
    ]);
    if (isPublic) return true;
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const user = req.user;
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
  private getRequiredAuthorizations(params: AuthorizeParams): string[] {
    return [
      ...new Set([
        ...(params.permissions ?? []),
        ...(params.roles ?? []),
        // ...(params.anyRole ?? []),
        // ...(params.anyPermission ?? []),
      ]),
    ];
  }
  private getOptionalAuthorizations(params: AuthorizeParams): string[] {
    return [
      ...new Set([
        // ...(params.permissions ?? []),
        // ...(params.roles ?? []),
        ...(params.anyRole ?? []),
        ...(params.anyPermission ?? []),
      ]),
    ];
  }
}
