import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { ApiMeta } from '../decorators/openapi-meta.decorator';
import { AbacService } from './abac.service';
import type { AbacEffect } from './abac.types';
import {
  abacPolicyIdParams,
  abacPolicyListQueryParams,
  abacPolicyListResponseSchema,
  abacPolicyResponseSchema,
  abacPolicySlugParams,
  createAbacPolicySchema,
  type CreateAbacPolicyDto,
  type UpdateAbacPolicyDto,
  updateAbacPolicySchema,
} from './dto/abac.schemas';

/**
 * CRUD for the dynamic policies, under `/abac/policies`. Every route runs
 * behind the application's default authentication; mount an authorization
 * guard of your own on top (or gate with `@RequirePermission(...)`) before
 * exposing it beyond trusted administrators.
 *
 * Listing supports the filters the evaluator and admin UIs need:
 * `?resource=comment&action=update&effect=deny&isActive=true&search=owner&includeDeleted=true`.
 */
@ApiMeta({ tags: 'ABAC' })
@Controller('abac/policies')
export class AbacController {
  constructor(private readonly abac: AbacService) {}

  @ApiMeta({
    q: abacPolicyListQueryParams,
    res: abacPolicyListResponseSchema,
  })
  @Get()
  async list(
    @Query('resource') resource?: string,
    @Query('action') action?: string,
    @Query('effect') effect?: string,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    return this.abac.listPolicies({
      resource: resource?.trim() || undefined,
      action: action?.trim() || undefined,
      effect:
        effect === 'allow' || effect === 'deny'
          ? (effect as AbacEffect)
          : undefined,
      isActive: isActive === undefined ? undefined : isActive === 'true',
      search: search?.trim() || undefined,
      includeDeleted: includeDeleted === 'true',
    });
  }

  @ApiMeta({
    body: createAbacPolicySchema,
    res: { 201: abacPolicyResponseSchema },
  })
  @Post()
  @HttpCode(201)
  async create(
    @Body({ schema: createAbacPolicySchema }) body: CreateAbacPolicyDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.abac.createPolicy(body, actorId);
  }

  /** Slug lookup for seeds and bootstraps; declared before `:id`. */
  @ApiMeta({
    param: abacPolicySlugParams,
    res: { 200: abacPolicyResponseSchema.nullable() },
  })
  @Get('slug/:slug')
  async getBySlug(@Param('slug') slug: string) {
    return this.abac.findPolicyBySlug(slug);
  }

  @ApiMeta({
    param: abacPolicyIdParams,
    res: {
      200: abacPolicyResponseSchema,
      404: { description: 'The policy was not found.' },
    },
  })
  @Get(':id')
  async get(@Param('id', ParseIntPipe) id: number) {
    return this.abac.getPolicy(id);
  }

  @ApiMeta({
    param: abacPolicyIdParams,
    body: updateAbacPolicySchema,
    res: {
      200: abacPolicyResponseSchema,
      404: { description: 'The policy was not found.' },
    },
  })
  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body({ schema: updateAbacPolicySchema }) body: UpdateAbacPolicyDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.abac.updatePolicy(id, body, actorId);
  }

  @ApiMeta({
    param: abacPolicyIdParams,
    res: {
      204: { description: 'The policy was soft-deleted.' },
      404: { description: 'The policy was not found.' },
    },
  })
  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') actorId: string,
  ) {
    await this.abac.deletePolicy(id, actorId);
  }
}
