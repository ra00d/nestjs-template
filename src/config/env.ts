import { z } from 'zod';

/**
 * The environment the application refuses to start without. `ConfigModule`
 * validates it at bootstrap, so a missing or malformed variable stops the
 * application before the first request instead of at the first one that
 * needs it.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  /** PostgreSQL connection string, for the Drizzle pool. */
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  /** HS256 secret for access tokens, at least 32 bytes: `openssl rand -base64 32`. */
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 bytes'),
  /** HS256 secret for access tokens, at least 32 bytes: `openssl rand -base64 32`. */
  SESSION_SECRET: z
    .string()
    .min(32, 'SESSION_SECRET must be at least 32 bytes'),
  SESSION_SALT: z.string().min(8, 'SESSION_SALT must be 8 bytes'),

  /** Public origin of the application: the links in emails and the `iss` of access tokens. */
  APP_URL: z.url().default('http://localhost:3000'),
  /** Other origins whose pages may sign in and send unsafe requests with the session cookie. */
  TRUSTED_ORIGINS: z.string().default(''),
  /** SMTP URL. Unset (or empty), and every email, links included, is printed to the log instead. */
  SMTP_URL: z.union([z.url(), z.literal('')]).optional(),
  /** The `From` of every email the application sends. */
  MAIL_FROM: z.string().default('Accounts <accounts@example.com>'),
  /**
   * The locale used when no resolver finds a supported one, and outside
   * requests (jobs, scripts). Must have a catalog in `src/i18n`.
   */
  DEFAULT_LOCALE: z.string().default('en'),
  /** Redis connection string, for the `KeyvRedis` store. */
  REDIS_URL: z.string().default('redis://localhost:6379'),
  /** Prefixes every Redis key as `<namespace>::<key>`. Unset shares one keyspace. */
  REDIS_NAMESPACE: z.string().optional(),
  /** Default cache TTL in milliseconds. Unset, and entries live until overwritten. */
  CACHE_DEFAULT_TTL: z.coerce.number().int().positive().optional(),
});

export type Env = z.infer<typeof envSchema>;

/** Splits `TRUSTED_ORIGINS`, a comma-separated list, into origins. */
export const trustedOrigins = (raw: string | undefined): string[] =>
  (raw ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
