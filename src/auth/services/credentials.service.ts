import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import { I18nService } from '@nestjs/i18n';
import { AuditService } from '../../audit/audit.module';
import type { User } from '../types/user';
import { UsersRepository } from '../repositories/users.repository';

@Injectable()
export class CredentialsService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly i18n: I18nService,
    private readonly audit: AuditService,
  ) {}

  async register(email: string, password: string): Promise<User> {
    if (await this.usersRepository.findByEmail(email)) {
      throw new ConflictException(this.i18n.t('auth.emailAlreadyRegistered'));
    }
    // The address is unverified: anyone can type any email into a sign-up form.
    const user = await this.usersRepository.createUser(email, {
      passwordHash: await this.passwordHasher.hash(password),
    });
    await this.audit.log({
      action: 'user.registered',
      entity: 'user',
      actorId: user.id,
      entityId: user.id,
      metadata: { email: user.email },
    });
    return user;
  }

  /** The user, or `null` when the email or the password is wrong. */
  async verify(email: string, password: string): Promise<User | null> {
    const found = await this.usersRepository.findCredentials(email);
    // With no account (or no password), verify() checks a dummy hash, so the
    // response time does not reveal which emails are registered.
    const valid = await this.passwordHasher.verify(
      password,
      found?.passwordHash,
    );
    if (!valid || !found?.passwordHash) {
      return null;
    }
    // The cost settings changed since this hash was stored: upgrade it now,
    // while we have the plaintext.
    if (this.passwordHasher.needsRehash(found.passwordHash)) {
      await this.usersRepository.updatePasswordHash(
        found.user.id,
        await this.passwordHasher.hash(password),
      );
    }
    return found.user;
  }

  /** Changes the signed-in user's password, after the current one checks out. */
  async changePassword(
    user: User,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const found = await this.usersRepository.findCredentials(user.email);
    const valid = await this.passwordHasher.verify(
      currentPassword,
      found?.passwordHash,
    );
    if (!valid || !found?.passwordHash) {
      throw new UnauthorizedException(this.i18n.t('auth.invalidPassword'));
    }
    await this.usersRepository.updatePasswordHash(
      user.id,
      await this.passwordHasher.hash(newPassword),
    );
    await this.audit.log({
      action: 'user.passwordChanged',
      entity: 'user',
      actorId: user.id,
      entityId: user.id,
    });
  }
}
