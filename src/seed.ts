import { PasswordHasher } from '@nestjs/authentication';
import { NestFactory } from '@nestjs/core';
import { getDrizzleToken } from '@nestjs/drizzle';
import { AppModule } from './app.module';
import { normalizeEmail } from './common/utils/string';
import type { DB } from './database';
import { authSeeder } from './modules/auth/db/seed';
import { RBACRepository } from './modules/auth/repositories';
import { UsersRepository } from './modules/auth/repositories/users.repository';
import { toRole } from './modules/auth/types/rbac.types';

export const roles = [
  {
    name: 'admin',
    slug: 'admin',
    description: 'Full access to the application and RBAC administration.',
  },
  {
    name: 'user',
    slug: 'user',
    description: 'Standard authenticated user with read-only RBAC access.',
  },
  {
    name: 'guest',
    slug: 'guest',
    description:
      'Unauthenticated or restricted user with no default permissions.',
  },
] as const;

export const permissions = [
  {
    name: 'users:read',
    slug: 'users-read',
    description: 'View users and user details.',
    resource: 'users',
    action: 'read',
  },
  {
    name: 'users:manage',
    slug: 'users-manage',
    description: 'Create, update, delete, and assign users.',
    resource: 'users',
    action: 'manage',
  },
  {
    name: 'roles:read',
    slug: 'roles-read',
    description: 'View roles and role assignments.',
    resource: 'roles',
    action: 'read',
  },
  {
    name: 'roles:manage',
    slug: 'roles-manage',
    description: 'Create, update, delete, and assign roles.',
    resource: 'roles',
    action: 'manage',
  },
  {
    name: 'permissions:read',
    slug: 'permissions-read',
    description: 'View permissions and permission assignments.',
    resource: 'permissions',
    action: 'read',
  },
  {
    name: 'permissions:manage',
    slug: 'permissions-manage',
    description: 'Create, update, delete, and assign permissions.',
    resource: 'permissions',
    action: 'manage',
  },
] as const;

export const rolePermissions = {
  admin: [
    'users:read',
    'users:manage',
    'roles:read',
    'roles:manage',
    'permissions:read',
    'permissions:manage',
  ],

  user: ['users:read', 'roles:read', 'permissions:read'],

  guest: [],
} as const;

export const rolePermissionAssignments = [
  { role: 'admin', permission: 'users:read' },
  { role: 'admin', permission: 'users:manage' },
  { role: 'admin', permission: 'roles:read' },
  { role: 'admin', permission: 'roles:manage' },
  { role: 'admin', permission: 'permissions:read' },
  { role: 'admin', permission: 'permissions:manage' },

  { role: 'user', permission: 'users:read' },
  { role: 'user', permission: 'roles:read' },
  { role: 'user', permission: 'permissions:read' },
] as const;

/**
 * Seed: `pnpm db:seed`.
 *
 * - Runs every module's `db/seed.ts` through drizzle-seed.
 * - With `ADMIN_EMAIL`/`ADMIN_PASSWORD` it also creates a verified admin
 *   idempotently (an existing address is left untouched).
 */
async function main() {
  const email = normalizeEmail(process.env['ADMIN_EMAIL'] ?? '');
  const password = process.env['ADMIN_PASSWORD'] ?? '';

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const db = app.get<DB>(getDrizzleToken());
    await authSeeder(db);

    if (!email || !password) {
      console.log(
        'db:seed: ADMIN_EMAIL/ADMIN_PASSWORD not set, skipping admin.',
      );
      return;
    }

    const users = app.get(UsersRepository);
    const rbac = app.get(RBACRepository);
    for (const role of roles) {
      await rbac.createRole({
        ...role,
      });
    }
    for (const permission of permissions) {
      await rbac.createPermission({
        ...permission,
      });
    }
    for (const rolePermission of rolePermissionAssignments) {
      await rbac.assignPermissionToRole(
        rolePermission.role,
        rolePermission.permission,
      );
    }
    const hasher = app.get(PasswordHasher);
    const existing = await users.findByEmail(email);
    if (existing) {
      console.log(`db:seed: ${email} already exists, skipping.`);
      return;
    }
    const admin = await users.createUser(email, {
      passwordHash: await hasher.hash(password),
      emailVerified: true,
      roles: [toRole('admin')],
    });
    console.log(`db:seed: admin ${admin.email} created.`);
  } finally {
    await app.close();
  }
}

await main();
