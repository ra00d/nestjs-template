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

// Response schemas, matching the role and permission rows the RBAC routes
// return.

const dateTimeSchema = z.date().meta({ format: 'date-time' });

export const roleResponseSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    description: z.string().nullable(),
    createdAt: dateTimeSchema,
    updatedAt: dateTimeSchema,
    deletedAt: dateTimeSchema.nullable(),
  })
  .meta({ id: 'Role' });

export const permissionResponseSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    description: z.string().nullable(),
    resource: z.string().nullable(),
    action: z.string().nullable(),
    createdAt: dateTimeSchema,
    updatedAt: dateTimeSchema,
    deletedAt: dateTimeSchema.nullable(),
  })
  .meta({ id: 'Permission' });

export const rolesResponseSchema = z.array(roleResponseSchema);
export const permissionsResponseSchema = z.array(permissionResponseSchema);

export const okResponseSchema = z
  .object({
    ok: z.literal(true),
  })
  .meta({ id: 'OkResponse' });

// Path parameter descriptors. Each one is named so it merges with the route's
// own `@Param(...)` metadata instead of being expanded a second time.

export const roleIdParams = [{ name: 'id', standardSchema: z.string().min(1) }];

export const permissionIdParams = [
  { name: 'id', standardSchema: z.string().min(1) },
];

export const rolePermissionParams = [
  { name: 'id', standardSchema: z.string().min(1) },
  { name: 'permissionId', standardSchema: z.string().min(1) },
];

export const userIdParams = [
  { name: 'userId', standardSchema: z.string().min(1) },
];

export const userIdRoleParams = [
  { name: 'userId', standardSchema: z.string().min(1) },
  { name: 'roleId', standardSchema: z.string().min(1) },
];

export const userIdPermissionParams = [
  { name: 'userId', standardSchema: z.string().min(1) },
  { name: 'permissionId', standardSchema: z.string().min(1) },
];
