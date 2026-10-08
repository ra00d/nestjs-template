import { z } from 'zod';

/**
 * The environment the application refuses to start without. `ConfigModule`
 * validates it at bootstrap, so a missing or malformed variable stops the
 * application before the first request instead of at the first one that
 * needs it.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  /** PostgreSQL connection string, for the Drizzle pool. */
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  /** HS256 secret for access tokens, at least 32 bytes: `openssl rand -base64 32`. */
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 bytes'),
  /** Public origin of the application: the links in emails and the `iss` of access tokens. */
  APP_URL: z.url().default('http://localhost:3000'),
  /** Other origins whose pages may sign in and send unsafe requests with the session cookie. */
  TRUSTED_ORIGINS: z.string().default(''),
  /** SMTP URL. Unset (or empty), and every email, links included, is printed to the log instead. */
  SMTP_URL: z.union([z.url(), z.literal('')]).optional(),
  /** The `From` of every email the application sends. */
  MAIL_FROM: z.string().default('Accounts <accounts@example.com>'),
});

export type Env = z.infer<typeof envSchema>;

/** Splits `TRUSTED_ORIGINS`, a comma-separated list, into origins. */
export const trustedOrigins = (raw: string | undefined): string[] =>
  (raw ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);