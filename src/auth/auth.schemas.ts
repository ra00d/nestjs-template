import { i18nIssueMessage } from '@nestjs/i18n';
import { z } from 'zod';

/** Follows the password rules every setter checks: a minimum, on top of the hasher's own limits. */
export const passwordSchema = z.string().min(12).max(128);

// The message names a translation key (`src/i18n/<locale>/validation.json`):
// the `I18nStandardSchemaValidationPipe` renders it in the request's locale.
const emailSchemaField = z.email(i18nIssueMessage('validation.invalidEmail'));

export const signUpSchema = z.object({
  email: emailSchemaField,
  password: passwordSchema,
});
export type SignUpDto = z.infer<typeof signUpSchema>;

// Sign-in does not enforce a minimum: a password set under an older rule still works.
export const signInSchema = z.object({
  email: emailSchemaField,
  password: z.string(),
});
export type SignInDto = z.infer<typeof signInSchema>;

export const emailSchema = z.object({
  email: emailSchemaField,
});
export type EmailDto = z.infer<typeof emailSchema>;

/** The token from a reset or verification link, as the page that opened it POSTs it back. */
export const tokenSchema = z.object({
  token: z.string().min(1),
});
export type TokenDto = z.infer<typeof tokenSchema>;

/** The token from the reset link, and the new password, under the sign-up rules. */
export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;

/** Changes the signed-in user's password. */
export const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: passwordSchema,
});
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;

/** The opaque refresh token a mobile client renews or revokes its sign-in with. */
export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshTokenDto = z.infer<typeof refreshTokenSchema>;