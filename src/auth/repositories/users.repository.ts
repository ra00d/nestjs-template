import { randomUUID } from 'node:crypto';
import { InjectDrizzle } from '@nestjs/drizzle';
import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { User } from '../types/user.js';
import { users } from '../db/auth.schema.js';

type UserRow = {
  id: string;
  email: string;
  emailVerified: boolean;
  roles: User['roles'];
  passwordHash: string | null;
};

/**
 * The application's users, kept in PostgreSQL through Drizzle. Password
 * hashes stay inside this class: everything it returns is a `User` without
 * one, so a user can leave a route or a log without leaking its hash.
 */
@Injectable()
export class UsersRepository {
  constructor(@InjectDrizzle() private readonly db: NodePgDatabase) {}

  async create(
    email: string,
    {
      passwordHash = null,
      emailVerified = false,
      roles = ['customer'],
    }: {
      passwordHash?: string | null;
      emailVerified?: boolean;
      roles?: User['roles'];
    } = {},
  ): Promise<User> {
    const row: UserRow = {
      id: randomUUID(),
      email: normalize(email),
      emailVerified,
      roles,
      passwordHash,
    };
    const [created] = await this.db.insert(users).values(row).returning();
    return toUser(created);
  }

  async findById(id: string): Promise<User | null> {
    const [row] = await this.db.select().from(users).where(eq(users.id, id));
    return row ? toUser(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, normalize(email)));
    return row ? toUser(row) : null;
  }

  /** For password sign-in only. */
  async findCredentials(
    email: string,
  ): Promise<{ user: User; passwordHash: string | null } | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, normalize(email)));
    return row ? { user: toUser(row), passwordHash: row.passwordHash } : null;
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.db.update(users).set({ passwordHash }).where(eq(users.id, id));
  }

  /**
   * The account for an address, created without a password when there is none:
   * a magic link is the whole sign-in, and it proves the address, so the
   * account starts verified. The insert is conditional, so two links used for
   * the same new address at once still leave one account.
   */
  async findOrCreate(email: string): Promise<User | null> {
    const found = await this.findByEmail(email);
    if (found) {
      return found;
    }
    const [created] = await this.db
      .insert(users)
      .values({
        id: randomUUID(),
        email: normalize(email),
        passwordHash: null,
        emailVerified: true,
        roles: ['customer'],
      })
      .onConflictDoNothing({ target: users.email })
      .returning();
    // Another request created it first: the row is there, under its own address.
    return created ? toUser(created) : this.findByEmail(email);
  }

  /**
   * Marks the address verified, only if it is still the user's: a link sent
   * to an old address verifies nothing. One conditional update, as the
   * `EmailVerificationHandler` contract asks.
   */
  async markEmailVerified(id: string, email: string): Promise<boolean> {
    const updated = await this.db
      .update(users)
      .set({ emailVerified: true })
      .where(and(eq(users.id, id), eq(users.email, normalize(email))))
      .returning({ id: users.id });
    return updated.length > 0;
  }
}

const normalize = (email: string) =>
  email.trim().normalize('NFC').toLowerCase();

const toUser = ({ id, email, emailVerified, roles }: UserRow): User => ({
  id,
  email,
  emailVerified,
  roles: [...roles],
});
