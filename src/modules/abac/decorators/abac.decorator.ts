import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';

/**
 * Declares that a route is guarded by the ABAC engine. `AbacGuard` reads
 * this metadata and asks `AbacService` whether the request may proceed;
 * routes without it are untouched (the guard is opt-in).
 *
 * `attributes` describes the entity being accessed (`resource.owner_id`,
 * `resource.status`…). When omitted, the guard uses the route parameters
 * only — never the body or query, because those are caller-controlled and a
 * policy check must not trust them. Load the entity (or the fields the
 * policy needs) in the resolver when the route exposes more.
 *
 * @example
 * @UseGuards(AbacGuard)
 * @Abac({
 *   resource: 'comment',
 *   action: 'update',
 *   attributes: async (request) => {
 *     const comment = await comments.findOne(request.params.id);
 *     return { ownerId: comment.authorId, status: comment.status };
 *   },
 * })
 * @Patch(':id')
 * update(@Param('id') id: string) {}
 */
export interface AbacRouteOptions {
  /** Entity type, matching `abac_policy.resource`. */
  resource: string;
  /** Action being performed, matching `abac_policy.action`. */
  action: string;
  /** Resolves the entity's attributes; defaults to the route parameters. */
  attributes?: (
    request: FastifyRequest,
  ) =>
    | Readonly<Record<string, unknown>>
    | Promise<Readonly<Record<string, unknown>>>;
  /** Extra environment attributes, merged over the UTC defaults. */
  environment?: (
    request: FastifyRequest,
  ) =>
    | Readonly<Record<string, unknown>>
    | Promise<Readonly<Record<string, unknown>>>;
}

export const Abac = Reflector.createDecorator<AbacRouteOptions>();
