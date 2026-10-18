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
import {
  assignPermissionToRoleSchema,
  assignPermissionToUserSchema,
  assignRoleToUserSchema,
  createPermissionSchema,
  createRoleSchema,
  type AssignPermissionToRoleDto,
  type AssignPermissionToUserDto,
  type AssignRoleToUserDto,
  type CreatePermissionDto,
  type CreateRoleDto,
  type UpdatePermissionDto,
  type UpdateRoleDto,
  updatePermissionSchema,
  updateRoleSchema,
} from '../dto/rbac.schemas';
import { RBACService } from '../services/rbac.service';

@Controller('rbac')
export class RBACController {
  constructor(private readonly rbacService: RBACService) {}

  // Roles

  @Get('roles')
  async listRoles() {
    return this.rbacService.listRoles();
  }

  @Post('roles')
  @HttpCode(201)
  async createRole(@Body({ schema: createRoleSchema }) body: CreateRoleDto) {
    return this.rbacService.createRole(body);
  }

  @Get('roles/:id')
  async getRole(@Param('id') id: string) {
    return this.rbacService.findRoleById(id);
  }

  @Patch('roles/:id')
  async updateRole(
    @Param('id') id: string,
    @Body({ schema: updateRoleSchema }) body: UpdateRoleDto,
  ) {
    return this.rbacService.updateRole(id, body);
  }

  @Delete('roles/:id')
  @HttpCode(204)
  async deleteRole(@Param('id') id: string) {
    await this.rbacService.deleteRole(id);
  }

  @Get('roles/:id/permissions')
  async listRolePermissions(@Param('id') id: string) {
    return this.rbacService.getRolePermissions(id);
  }

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

  @Delete('roles/:id/permissions/:permissionId')
  @HttpCode(204)
  async removeRolePermission(
    @Param('id') id: string,
    @Param('permissionId') permissionId: string,
  ) {
    await this.rbacService.removePermissionFromRole(id, permissionId);
  }

  // Permissions

  @Get('permissions')
  async listPermissions() {
    return this.rbacService.listPermissions();
  }

  @Post('permissions')
  @HttpCode(201)
  async createPermission(
    @Body({ schema: createPermissionSchema }) body: CreatePermissionDto,
  ) {
    return this.rbacService.createPermission(body);
  }

  @Get('permissions/:id')
  async getPermission(@Param('id') id: string) {
    return this.rbacService.findPermissionById(id);
  }

  @Patch('permissions/:id')
  async updatePermission(
    @Param('id') id: string,
    @Body({ schema: updatePermissionSchema }) body: UpdatePermissionDto,
  ) {
    return this.rbacService.updatePermission(id, body);
  }

  @Delete('permissions/:id')
  @HttpCode(204)
  async deletePermission(@Param('id') id: string) {
    await this.rbacService.deletePermission(id);
  }

  // Users

  @Get('users/:userId/roles')
  async getUserRoles(@Param('userId') userId: string) {
    return this.rbacService.getUserRoles(userId);
  }

  @Post('users/:userId/roles')
  @HttpCode(201)
  async assignUserRole(
    @Param('userId') userId: string,
    @Body({ schema: assignRoleToUserSchema }) body: AssignRoleToUserDto,
  ) {
    await this.rbacService.assignRoleToUser(userId, body.roleId);
    return { ok: true };
  }

  @Delete('users/:userId/roles/:roleId')
  @HttpCode(204)
  async removeUserRole(
    @Param('userId') userId: string,
    @Param('roleId') roleId: string,
  ) {
    await this.rbacService.removeRoleFromUser(userId, roleId);
  }

  @Get('users/:userId/permissions')
  async getUserPermissions(@Param('userId') userId: string) {
    return this.rbacService.getUserPermissions(userId);
  }

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

  @Delete('users/:userId/permissions/:permissionId')
  @HttpCode(204)
  async removeUserPermission(
    @Param('userId') userId: string,
    @Param('permissionId') permissionId: string,
  ) {
    await this.rbacService.removePermissionFromUser(userId, permissionId);
  }
}
