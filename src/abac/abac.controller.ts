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
import { AbacService } from './abac.service';
import type { AbacEffect } from './abac.types';
import {
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
@Controller('abac/policies')
export class AbacController {
  constructor(private readonly abac: AbacService) {}

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

  @Post()
  @HttpCode(201)
  async create(
    @Body({ schema: createAbacPolicySchema }) body: CreateAbacPolicyDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.abac.createPolicy(body, actorId);
  }

  /** Slug lookup for seeds and bootstraps; declared before `:id`. */
  @Get('slug/:slug')
  async getBySlug(@Param('slug') slug: string) {
    return this.abac.findPolicyBySlug(slug);
  }

  @Get(':id')
  async get(@Param('id', ParseIntPipe) id: number) {
    return this.abac.getPolicy(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body({ schema: updateAbacPolicySchema }) body: UpdateAbacPolicyDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.abac.updatePolicy(id, body, actorId);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') actorId: string,
  ) {
    await this.abac.deletePolicy(id, actorId);
  }
}
