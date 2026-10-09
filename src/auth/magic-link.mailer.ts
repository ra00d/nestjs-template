import { Injectable } from '@nestjs/common';
import {
  AuthenticationRegistry,
  MagicLinkHandler,
  type MagicLink,
} from '@nestjs/authentication';
import { Mailer, type Mailable } from '@nestjs/mail';
import { UsersRepository } from '../users/users.repository.js';

@Injectable()
export class MagicLinkMail implements Mailable<MagicLink> {
  render({ url }: MagicLink) {
    return {
      subject: 'Your sign-in link',
      template: 'magic-link',
      context: { url },
    };
  }
}

@Injectable()
export class MagicLinkMailer extends MagicLinkHandler {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly mailer: Mailer,
    registry: AuthenticationRegistry,
  ) {
    super();
    registry.registerHandler('magicLink', this);
  }

  // An address with no account gets one, verified and without a password: the
  // link the customer is holding is proof of the address, and nothing else is
  // asked of them.
  async resolveUser(email: string) {
    const account = await this.usersRepository.findOrCreate(email);
    // And one that does have an account is verified by the link too, which is
    // what a password sign-up left unverified: reading the address's own mail
    // is the proof the other flows ask for.
    if (account && !account.emailVerified) {
      await this.usersRepository.markEmailVerified(account.id, account.email);
      return { ...account, emailVerified: true };
    }
    return account;
  }

  async send(link: MagicLink) {
    await this.mailer.send(MagicLinkMail, { to: link.email, data: link });
  }
}