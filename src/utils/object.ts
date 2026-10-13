/** Picks `keys` into a new object; skips keys the source lacks. */
export function pick<T extends Record<string, unknown>, K extends keyof T>(
  source: T,
  keys: readonly K[],
): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in source) out[key] = source[key];
  }
  return out;
}

/** Copies `source` minus `keys`; the Drizzle-`$type`-safe `_.omit`. */
export function omit<T extends Record<string, unknown>, K extends keyof T>(
  source: T,
  keys: readonly K[],
): Omit<T, K> {
  const dropped = new Set<PropertyKey>(keys);
  const out = {} as Omit<T, K>;
  for (const [key, value] of Object.entries(source)) {
    if (!dropped.has(key)) (out as Record<string, unknown>)[key] = value;
  }
  return out;
}

/**
 * Drops `undefined`-valued keys (shallow). Spread this over partial update
 * payloads before Drizzle `.set(...)`: explicit `undefined` would otherwise
 * overwrite a column with `NULL`/error depending on the driver.
 */
export function removeUndefined<T extends Record<string, unknown>>(source: T): T {
  const out = {} as T;
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined) (out as Record<string, unknown>)[key] = value;
  }
  return out;
}
