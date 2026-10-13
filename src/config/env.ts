import { z } from 'zod';

/**
 * Empty env values (`KEY=`) arrive as `''`. Treat them as unset so
 * optional numbers fall back to their defaults instead of coercing to `0`.
 */
const emptyToUndefined = (value: unknown): unknown =>
  value === '' ? undefined : value;

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
  PORT: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().positive().default(3000),
  ),
  /** URL prefix for all versioned API routes (Swagger stays at `/docs`). */
  API_PREFIX: z
    .string()
    .regex(/^[a-z0-9-]+$/i, 'API_PREFIX must be a single path segment')
    .default('api'),
  /** Run Drizzle SQL migrations on boot when `true`. Prefer `pnpm db:migrate` in production. */
  DB_MIGRATE_ON_BOOT: z.stringbool().default(false),
  /** Upload staging: multipart `dest` and the files the GC task sweeps. */
  UPLOAD_DIR: z.string().min(1).default('./upload'),
  /** Staged uploads older than this (days) are deleted by the nightly task. */
  UPLOAD_MAX_AGE_DAYS: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().positive().default(7),
  ),
  /** File storage: local disk by default, S3-compatible when `s3`. */
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  /** Local disk root (created at startup when missing). */
  STORAGE_DIR: z.string().min(1).default('./storage'),
  /** S3 bucket/endpoint/credentials. Required when `STORAGE_DRIVER=s3`. */
  S3_BUCKET: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  S3_REGION: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  S3_ENDPOINT: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  S3_ACCESS_KEY_ID: z.preprocess(
    emptyToUndefined,
    z.string().min(1).optional(),
  ),
  S3_SECRET_ACCESS_KEY: z.preprocess(
    emptyToUndefined,
    z.string().min(1).optional(),
  ),
  /** Bootstrap admin: when set, `pnpm db:seed` creates it idempotently. */
  ADMIN_EMAIL: z.preprocess(emptyToUndefined, z.email().optional()),
  ADMIN_PASSWORD: z.preprocess(
    emptyToUndefined,
    z.string().min(12).max(128).optional(),
  ),
  /** Structured log level (`debug` in development, `info` otherwise). */
  LOG_LEVEL: z.preprocess(
    emptyToUndefined,
    z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
  ),
  /** Global request timeout in milliseconds; handlers slower than this get a 408. */
  REQUEST_TIMEOUT_MS: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().positive().default(30_000),
  ),
  /** PostgreSQL connection string, for the Drizzle pool. */
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  /** HS256 secret for access tokens, at least 32 bytes: `openssl rand -base64 32`. */
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 bytes'),
  /** HS256 secret for secure-session cookies, at least 32 bytes: `openssl rand -base64 32`. */
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
  REDIS_NAMESPACE: z.preprocess(
    emptyToUndefined,
    z.string().min(1).optional(),
  ),
  /** Default cache TTL in milliseconds. Unset, and entries live until overwritten. */
  CACHE_DEFAULT_TTL: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().positive().optional(),
  ),
});

export type Env = z.infer<typeof envSchema>;

/** Splits `TRUSTED_ORIGINS`, a comma-separated list, into origins. */
export const trustedOrigins = (raw: string | undefined): string[] =>
  (raw ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
