import { PasswordHasher } from '@nestjs/authentication';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { normalizeEmail } from './utils/string';
import { UsersRepository } from './auth/repositories/users.repository';
import { toRole } from './auth/types/rbac.types';

/**
 * Bootstrap seed: `pnpm db:seed`.
 *
 * - Without `ADMIN_EMAIL`/`ADMIN_PASSWORD` it prints why and exits `0`
 *   (safe in CI before secrets exist) — before booting Nest, so no
 *   database is needed for the no-op path.
 * - With them it creates a verified admin idempotently (existing address
 *   is left untouched) and exits.
 */
async function seed() {
  const email = normalizeEmail(process.env['ADMIN_EMAIL'] ?? '');
  const password = process.env['ADMIN_PASSWORD'] ?? '';
  if (!email || !password) {
    console.log('db:seed: ADMIN_EMAIL/ADMIN_PASSWORD not set, nothing to do.');
    return;
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const users = app.get(UsersRepository);
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

await seed();
