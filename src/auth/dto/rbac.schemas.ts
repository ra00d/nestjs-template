import { z } from 'zod';

export const createRoleSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
});

export type CreateRoleDto = z.infer<typeof createRoleSchema>;

export const updateRoleSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
});

export type UpdateRoleDto = z.infer<typeof updateRoleSchema>;

export const createPermissionSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  resource: z.string().nullable().optional(),
  action: z.string().nullable().optional(),
});

export type CreatePermissionDto = z.infer<typeof createPermissionSchema>;

export const updatePermissionSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  resource: z.string().nullable().optional(),
  action: z.string().nullable().optional(),
});

export type UpdatePermissionDto = z.infer<typeof updatePermissionSchema>;

export const assignPermissionToRoleSchema = z.object({
  permissionId: z.string().min(1),
});

export type AssignPermissionToRoleDto = z.infer<
  typeof assignPermissionToRoleSchema
>;

export const assignRoleToUserSchema = z.object({
  roleId: z.string().min(1),
});

export type AssignRoleToUserDto = z.infer<typeof assignRoleToUserSchema>;

export const assignPermissionToUserSchema = z.object({
  permissionId: z.string().min(1),
});

export type AssignPermissionToUserDto = z.infer<
  typeof assignPermissionToUserSchema
>;
