import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiMeta } from '../../decorators/openapi-meta.decorator';
import {
  assignPermissionToRoleSchema,
  assignPermissionToUserSchema,
  assignRoleToUserSchema,
  createPermissionSchema,
  createRoleSchema,
  okResponseSchema,
  permissionIdParams,
  permissionResponseSchema,
  permissionsResponseSchema,
  roleIdParams,
  rolePermissionParams,
  roleResponseSchema,
  rolesResponseSchema,
  type AssignPermissionToRoleDto,
  type AssignPermissionToUserDto,
  type AssignRoleToUserDto,
  type CreatePermissionDto,
  type CreateRoleDto,
  type UpdatePermissionDto,
  type UpdateRoleDto,
  updatePermissionSchema,
  updateRoleSchema,
  userIdParams,
  userIdPermissionParams,
  userIdRoleParams,
} from '../dto/rbac.schemas';
import { RBACService } from '../services/rbac.service';

@ApiMeta({ tags: 'RBAC' })
@Controller('rbac')
export class RBACController {
  constructor(private readonly rbacService: RBACService) {}

  // Roles

  @ApiMeta({ res: rolesResponseSchema })
  @Get('roles')
  async listRoles() {
    return this.rbacService.listRoles();
  }

  @ApiMeta({
    body: createRoleSchema,
    res: { 201: roleResponseSchema },
  })
  @Post('roles')
  @HttpCode(201)
  async createRole(@Body({ schema: createRoleSchema }) body: CreateRoleDto) {
    return this.rbacService.createRole(body);
  }

  @ApiMeta({
    param: roleIdParams,
    res: { 200: roleResponseSchema.nullable() },
  })
  @Get('roles/:id')
  async getRole(@Param('id') id: string) {
    return this.rbacService.findRoleById(id);
  }

  @ApiMeta({
    param: roleIdParams,
    body: updateRoleSchema,
    res: { 200: roleResponseSchema.nullable() },
  })
  @Patch('roles/:id')
  async updateRole(
    @Param('id') id: string,
    @Body({ schema: updateRoleSchema }) body: UpdateRoleDto,
  ) {
    return this.rbacService.updateRole(id, body);
  }

  @ApiMeta({
    param: roleIdParams,
    res: { 204: { description: 'The role was deleted.' } },
  })
  @Delete('roles/:id')
  @HttpCode(204)
  async deleteRole(@Param('id') id: string) {
    await this.rbacService.deleteRole(id);
  }

  @ApiMeta({
    param: roleIdParams,
    res: permissionsResponseSchema,
  })
  @Get('roles/:id/permissions')
  async listRolePermissions(@Param('id') id: string) {
    return this.rbacService.getRolePermissions(id);
  }

  @ApiMeta({
    param: roleIdParams,
    body: assignPermissionToRoleSchema,
    res: { 201: okResponseSchema },
  })
  @Post('roles/:id/permissions')
  @HttpCode(201)
  async assignRolePermission(
    @Param('id') id: string,
    @Body({ schema: assignPermissionToRoleSchema })
    body: AssignPermissionToRoleDto,
  ) {
    await this.rbacService.assignPermissionToRole(id, body.permissionId);
    return { ok: true };
  }

  @ApiMeta({
    param: rolePermissionParams,
    res: { 204: { description: 'The permission was removed from the role.' } },
  })
  @Delete('roles/:id/permissions/:permissionId')
  @HttpCode(204)
  async removeRolePermission(
    @Param('id') id: string,
    @Param('permissionId') permissionId: string,
  ) {
    await this.rbacService.removePermissionFromRole(id, permissionId);
  }

  // Permissions

  @ApiMeta({ res: permissionsResponseSchema })
  @Get('permissions')
  async listPermissions() {
    return this.rbacService.listPermissions();
  }

  @ApiMeta({
    body: createPermissionSchema,
    res: { 201: permissionResponseSchema },
  })
  @Post('permissions')
  @HttpCode(201)
  async createPermission(
    @Body({ schema: createPermissionSchema }) body: CreatePermissionDto,
  ) {
    return this.rbacService.createPermission(body);
  }

  @ApiMeta({
    param: permissionIdParams,
    res: { 200: permissionResponseSchema.nullable() },
  })
  @Get('permissions/:id')
  async getPermission(@Param('id') id: string) {
    return this.rbacService.findPermissionById(id);
  }

  @ApiMeta({
    param: permissionIdParams,
    body: updatePermissionSchema,
    res: { 200: permissionResponseSchema.nullable() },
  })
  @Patch('permissions/:id')
  async updatePermission(
    @Param('id') id: string,
    @Body({ schema: updatePermissionSchema }) body: UpdatePermissionDto,
  ) {
    return this.rbacService.updatePermission(id, body);
  }

  @ApiMeta({
    param: permissionIdParams,
    res: { 204: { description: 'The permission was deleted.' } },
  })
  @Delete('permissions/:id')
  @HttpCode(204)
  async deletePermission(@Param('id') id: string) {
    await this.rbacService.deletePermission(id);
  }

  // Users

  @ApiMeta({
    param: userIdParams,
    res: rolesResponseSchema,
  })
  @Get('users/:userId/roles')
  async getUserRoles(@Param('userId') userId: string) {
    return this.rbacService.getUserRoles(userId);
  }

  @ApiMeta({
    param: userIdParams,
    body: assignRoleToUserSchema,
    res: { 201: okResponseSchema },
  })
  @Post('users/:userId/roles')
  @HttpCode(201)
  async assignUserRole(
    @Param('userId') userId: string,
    @Body({ schema: assignRoleToUserSchema }) body: AssignRoleToUserDto,
  ) {
    await this.rbacService.assignRoleToUser(userId, body.roleId);
    return { ok: true };
  }

  @ApiMeta({
    param: userIdRoleParams,
    res: { 204: { description: 'The role was removed from the user.' } },
  })
  @Delete('users/:userId/roles/:roleId')
  @HttpCode(204)
  async removeUserRole(
    @Param('userId') userId: string,
    @Param('roleId') roleId: string,
  ) {
    await this.rbacService.removeRoleFromUser(userId, roleId);
  }

  @ApiMeta({
    param: userIdParams,
    res: permissionsResponseSchema,
  })
  @Get('users/:userId/permissions')
  async getUserPermissions(@Param('userId') userId: string) {
    return this.rbacService.getUserPermissions(userId);
  }

  @ApiMeta({
    param: userIdParams,
    body: assignPermissionToUserSchema,
    res: { 201: okResponseSchema },
  })
  @Post('users/:userId/permissions')
  @HttpCode(201)
  async assignUserPermission(
    @Param('userId') userId: string,
    @Body({ schema: assignPermissionToUserSchema })
    body: AssignPermissionToUserDto,
  ) {
    await this.rbacService.assignPermissionToUser(userId, body.permissionId);
    return { ok: true };
  }

  @ApiMeta({
    param: userIdPermissionParams,
    res: { 204: { description: 'The permission was removed from the user.' } },
  })
  @Delete('users/:userId/permissions/:permissionId')
  @HttpCode(204)
  async removeUserPermission(
    @Param('userId') userId: string,
    @Param('permissionId') permissionId: string,
  ) {
    await this.rbacService.removePermissionFromUser(userId, permissionId);
  }
}
