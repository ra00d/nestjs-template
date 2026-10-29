import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import type { User } from '../auth/types/user';
import { AbacService } from './abac.service';
import { toAbacSubject } from './abac.types';
import { Abac } from './decorators/abac.decorator';

type RequestWithUser = FastifyRequest & { user?: User };

/**
 * Route guard for the ABAC engine. Add `@UseGuards(AbacGuard)` plus `@Abac({…})`
 * to a handler (or controller) and it asks `AbacService` before the handler
 * runs, using the signed-in user as the subject and the metadata's
 * `attributes`/`environment` resolvers for the rest; a denied request gets
 * the usual Nest 403 and never reaches the handler.
 *
 * Opt-in: without `@Abac` metadata the guard allows the request, so it can be
 * applied broadly (also as an `APP_GUARD`) and only annotated routes pay a
 * policy lookup. Guests are supported — `subject.authenticated`, `subject.id`
 * and the other subject attributes are populated either way.
 */
@Injectable()
export class AbacGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly abac: AbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride(Abac, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!options) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const attributes = options.attributes
      ? await options.attributes(request)
      : routeAttributes(request);
    const environment = options.environment
      ? await options.environment(request)
      : undefined;

    const decision = await this.abac.authorize({
      subject: toAbacSubject(request.user),
      resource: options.resource,
      action: options.action,
      attributes,
      environment,
    });
    return decision.allowed;
  }
}

/**
 * The default attribute source: the route parameters. The body and query are
 * intentionally ignored — a policy must not read values the caller chose at
 * request time unless the route says so explicitly.
 */
function routeAttributes(request: FastifyRequest): Record<string, unknown> {
  return { ...(request.params as Record<string, unknown> | undefined) };
}
