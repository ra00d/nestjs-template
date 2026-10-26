import { i18nIssueMessage } from '@nestjs/i18n';
import z from 'zod';
import { passwordSchema } from '../../utils/validation';

/** Follows the password rules every setter checks: a minimum, on top of the hasher's own limits. */
export { passwordSchema };

// The message names a translation key (`src/i18n/<locale>/validation.json`):
// the `I18nStandardSchemaValidationPipe` renders it in the request's locale.
const emailSchemaField = z
  .email(i18nIssueMessage('validation.invalidEmail'))
  .meta({
    examples: ['user@email.com'],
  });

export const signUpSchema = z
  .object({
    email: emailSchemaField,
    password: passwordSchema,
  })
  .meta({
    id: 'signUpSchema',
    description: 'The sign-up payload',
  });
export type SignUpDto = z.infer<typeof signUpSchema>;

// Sign-in does not enforce a minimum: a password set under an older rule still works.
export const signInSchema = z
  .object({
    email: emailSchemaField,
    password: z.string(),
  })
  .meta({
    id: 'signInSchema',
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

// Response schemas. These describe what the controllers return, so they are
// also the OpenAPI models for the auth routes.

const dateTimeSchema = z.date().meta({ format: 'date-time' });

export const userResponseSchema = z
  .object({
    id: z.string(),
    email: z.email().meta({
      examples: ['user@info.com'],
    }),
    emailVerified: z.boolean(),
    createdAt: dateTimeSchema,
    updatedAt: dateTimeSchema,
    deletedAt: dateTimeSchema.nullable(),
    roles: z.array(z.string()),
    permissions: z.array(z.string()),
  })
  .meta({ id: 'User' });

export const mfaRequiredResponseSchema = z
  .object({
    mfaRequired: z.boolean(),
  })
  .meta({ id: 'MfaRequiredResponse' });

export const emailVerifiedResponseSchema = z
  .object({
    email: z.email(),
    emailVerified: z.literal(true),
  })
  .meta({ id: 'EmailVerifiedResponse' });

export const passwordChangedResponseSchema = z
  .object({
    passwordChanged: z.literal(true),
  })
  .meta({ id: 'PasswordChangedResponse' });

export const sessionResponseSchema = z
  .object({
    id: z.string(),
    createdAt: dateTimeSchema,
    lastActiveAt: dateTimeSchema,
    userAgent: z.string().nullable(),
    current: z.boolean(),
  })
  .meta({ id: 'Session' });

export const sessionsResponseSchema = z.array(sessionResponseSchema);

export const tokenPairResponseSchema = z
  .object({
    accessToken: z.string(),
    expiresIn: z.number().int().nonnegative().meta({
      description: 'Seconds until the access token expires.',
    }),
    refreshToken: z.string(),
  })
  .meta({ id: 'TokenPair' });

/** Path parameter for the routes that address one session. */
export const sessionIdParams = [
  { name: 'id', standardSchema: z.string().min(1) },
];
