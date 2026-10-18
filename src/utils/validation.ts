import { z } from 'zod';
import { normalizeEmail } from './string';

export const DEFAULT_LIST_LIMIT = 20;
export const MAX_LIST_LIMIT = 100;

/**
 * The password rule every setter enforces (sign-up, reset, change): a
 * minimum, on top of the hasher's own limits. Sign-in deliberately does
 * not use it — a password set under an older rule must still verify.
 */
export const passwordSchema = z.string().min(12).max(128);

/**
 * Email with normalization baked in: `A@B.c ` infers as `a@b.c`, so
 * lookups and uniqueness checks never miss on case or whitespace. The
 * address is normalized *before* validation (a plain `z.email()` would
 * reject the padding). Auth routes use their own i18n-localized variant;
 * this is for everything else (invites, admin, imports).
 */
export const normalizedEmailSchema = z.preprocess(
  (value) => (typeof value === 'string' ? normalizeEmail(value) : value),
  z.email(),
);

export const sortOrderSchema = z.enum(['asc', 'desc']);

/** `?page=&limit=&order=` shared by every list query. */
export const paginationBaseSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_LIST_LIMIT)
    .default(DEFAULT_LIST_LIMIT),
  order: sortOrderSchema.default('desc'),
});

/**
 * `?include=author,comments` -> `Set { 'author', 'comments' }`, matching
 * what the generated repositories' `include?.has(...)` expects. Unknown
 * names are kept — the repository ignores ones it doesn't load.
 */
export const includeSchema = z
  .string()
  .transform(
    (value) =>
      new Set(
        value
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean),
      ),
  )
  .optional();
