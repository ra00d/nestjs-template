import { Injectable } from '@nestjs/common';
import {
  AuthenticationRegistry,
  EmailVerificationHandler,
  type EmailVerificationLink,
} from '@nestjs/authentication';
import { I18nService } from '@nestjs/i18n';
import { Mailer, type Mailable } from '@nestjs/mail';
import { UsersRepository } from '../repositories/users.repository';

@Injectable()
export class VerifyEmailMail implements Mailable<EmailVerificationLink> {
  constructor(private readonly i18n: I18nService) {}

  render({ url }: EmailVerificationLink) {
    return {
      subject: this.i18n.t('mail.verifyEmail.subject'),
      template: 'verify-email',
      context: { url },
    };
  }
}

@Injectable()
export class EmailVerificationMailer extends EmailVerificationHandler {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly mailer: Mailer,
    registry: AuthenticationRegistry,
  ) {
    super();
    registry.registerHandler('emailVerification', this);
  }

  async send(link: EmailVerificationLink) {
    await this.mailer.send(VerifyEmailMail, { to: link.email, data: link });
  }

  // Runs when the link is used. It verifies nothing if the address changed since.
  markVerified(userId: string, email: string) {
    return this.usersRepository.markEmailVerified(userId, email);
  }
}

