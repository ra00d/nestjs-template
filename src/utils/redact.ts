/**
 * Field names stripped from anything logged. Compared case-insensitively
 * against the key, as a substring: `'password'` catches `password`,
 * `passwordHash`, `currentPassword` and `newPassword`; `'token'` catches
 * `token`, `refreshToken` and `accessToken`.
 */
export const DEFAULT_SENSITIVE_FIELDS = [
  'password',
  'passcode',
  'pinCode',
  'secret',
  'token',
  'authorization',
  'apiKey',
  'otp',
  'totp',
  'ssn',
] as const;

export interface RedactOptions {
  /** Extra field names on top of (or instead of) the defaults. */
  fields?: readonly string[];
  /** Replace `DEFAULT_SENSITIVE_FIELDS` instead of extending it. */
  replaceDefaults?: boolean;
  /** Placeholder written over redacted values. */
  censor?: string;
  /** Objects nested deeper are replaced wholesale (DoS-safe logging). */
  maxDepth?: number;
}

const CIRCULAR = '[Circular]';
const MAX_DEPTH = '[MaxDepth]';

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

/**
 * Deep-clones `value` with sensitive fields replaced by `'[Redacted]'`,
 * for safe `logger.log()` / pino arguments. Never mutates the input,
 * never throws: circular refs become `'[Circular]'`, class instances
 * (Date, Buffer, entities) pass through by reference — pino serializes
 * those itself.
 *
 * ```ts
 * logger.log({ user: redactSensitive(body) }, 'sign-up attempt');
 * ```
 */
export function redactSensitive<T>(value: T, options: RedactOptions = {}): T {
  const {
    fields,
    replaceDefaults = false,
    censor = '[Redacted]',
    maxDepth = 10,
  } = options;
  const base: readonly string[] = replaceDefaults
    ? []
    : DEFAULT_SENSITIVE_FIELDS;
  const needles = [...base, ...(fields ?? [])].map((field) =>
    field.toLowerCase(),
  );
  return redactValue(value, needles, censor, maxDepth, new WeakSet()) as T;
}

function isSensitive(key: string, needles: string[]): boolean {
  const lower = key.toLowerCase();
  return needles.some((needle) => needle !== '' && lower.includes(needle));
}

function redactValue(
  value: unknown,
  needles: string[],
  censor: string,
  depth: number,
  seen: WeakSet<object>,
): unknown {
  if (Array.isArray(value)) {
    if (seen.has(value)) return CIRCULAR;
    if (depth <= 0) return MAX_DEPTH;
    seen.add(value);
    const out = value.map((entry) =>
      redactValue(entry, needles, censor, depth - 1, seen),
    );
    seen.delete(value);
    return out;
  }
  if (isPlainObject(value)) {
    if (seen.has(value)) return CIRCULAR;
    if (depth <= 0) return MAX_DEPTH;
    seen.add(value);
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      out[key] = isSensitive(key, needles)
        ? censor
        : redactValue(entry, needles, censor, depth - 1, seen);
    }
    seen.delete(value);
    return out;
  }
  return value;
}
