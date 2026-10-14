import { Injectable } from '@nestjs/common';
import { UsersRepository } from '../repositories/users.repository.js';
import { RBACRepository } from '../repositories/rbac.repository.js';

@Injectable()
export class RBACService {
  constructor(
    private readonly rbacRepo: RBACRepository,
    private readonly usersRepo: UsersRepository,
  ) {}

  // Roles

  async createRole(...args: Parameters<RBACRepository['createRole']>) {
    return this.rbacRepo.createRole(...args);
  }

  async findRoleById(id: string) {
    return this.rbacRepo.findRoleById(id);
  }

  async findRoleByName(name: string) {
    return this.rbacRepo.findRoleByName(name);
  }

  async listRoles() {
    return this.rbacRepo.listRoles();
  }

  async findAllRoles() {
    return this.rbacRepo.findAllRoles();
  }

  async updateRole(
    id: string,
    input: Parameters<RBACRepository['updateRole']>[1],
  ) {
    return this.rbacRepo.updateRole(id, input);
  }

  async deleteRole(id: string) {
    return this.rbacRepo.deleteRole(id);
  }

  async removeRole(id: string) {
    return this.deleteRole(id);
  }

  // Permissions

  async createPermission(
    ...args: Parameters<RBACRepository['createPermission']>
  ) {
    return this.rbacRepo.createPermission(...args);
  }

  async findPermissionById(id: string) {
    return this.rbacRepo.findPermissionById(id);
  }

  async findPermissionByName(name: string) {
    return this.rbacRepo.findPermissionByName(name);
  }

  async listPermissions() {
    return this.rbacRepo.listPermissions();
  }

  async findAllPermissions() {
    return this.rbacRepo.findAllPermissions();
  }

  async updatePermission(
    id: string,
    input: Parameters<RBACRepository['updatePermission']>[1],
  ) {
    return this.rbacRepo.updatePermission(id, input);
  }

  async deletePermission(id: string) {
    return this.rbacRepo.deletePermission(id);
  }

  async removePermission(id: string) {
    return this.deletePermission(id);
  }

  // Role <-> permission

  async assignPermissionToRole(roleId: string, permissionId: string) {
    return this.rbacRepo.assignPermissionToRole(roleId, permissionId);
  }

  async removePermissionFromRole(roleId: string, permissionId: string) {
    return this.rbacRepo.removePermissionFromRole(roleId, permissionId);
  }

  async getRolePermissions(roleId: string) {
    return this.rbacRepo.getRolePermissions(roleId);
  }

  async listRolePermissions(roleId: string) {
    return this.rbacRepo.listRolePermissions(roleId);
  }

  // User <-> role

  async assignRoleToUser(userId: string, roleId: string) {
    return this.usersRepo.assignRole(userId, roleId);
  }

  async addRoleToUser(userId: string, roleId: string) {
    return this.assignRoleToUser(userId, roleId);
  }

  async grantRoleToUser(userId: string, roleId: string) {
    return this.assignRoleToUser(userId, roleId);
  }

  async removeRoleFromUser(userId: string, roleId: string) {
    return this.usersRepo.removeRole(userId, roleId);
  }

  async revokeRoleFromUser(userId: string, roleId: string) {
    return this.removeRoleFromUser(userId, roleId);
  }

  async getUserRoles(userId: string) {
    return this.usersRepo.getUserRoles(userId);
  }

  async listUserRoles(userId: string) {
    return this.usersRepo.listUserRoles(userId);
  }

  // User <-> permission

  async assignPermissionToUser(userId: string, permissionId: string) {
    return this.usersRepo.assignPermission(userId, permissionId);
  }

  async addPermissionToUser(userId: string, permissionId: string) {
    return this.assignPermissionToUser(userId, permissionId);
  }

  async grantPermissionToUser(userId: string, permissionId: string) {
    return this.assignPermissionToUser(userId, permissionId);
  }

  async removePermissionFromUser(userId: string, permissionId: string) {
    return this.usersRepo.removePermission(userId, permissionId);
  }

  async revokePermissionFromUser(userId: string, permissionId: string) {
    return this.removePermissionFromUser(userId, permissionId);
  }

  async getUserPermissions(userId: string) {
    return this.usersRepo.getUserPermissions(userId);
  }

  async listUserPermissions(userId: string) {
    return this.usersRepo.listUserPermissions(userId);
  }

  async hasRole(userId: string, roleId: string) {
    return this.usersRepo.hasRole(userId, roleId);
  }

  async hasPermission(userId: string, permissionId: string) {
    return this.usersRepo.hasPermission(userId, permissionId);
  }

  // Aliases matching repository methods

  getRole = this.findRoleById;
  getPermission = this.findPermissionById;
  roles = this.listRoles;
  permissions = this.listPermissions;
  rolePermissions = this.getRolePermissions;
  userRoles = this.getUserRoles;
  userPermissions = this.getUserPermissions;
  assignRole = this.assignRoleToUser;
  assignPermission = this.assignPermissionToUser;
}
