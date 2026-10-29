function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function cloneValue<T>(value: T): T {
  if (Array.isArray(value)) return [...value] as T;
  if (isPlainObject(value)) return { ...value } as T;
  return value;
}

/**
 * Deeply merges multiple `sources` into `target` without mutating any input.
 * Later sources win on conflict.
 *
 * The trailing argument may optionally be a number used as max merge depth.
 * When omitted, merging is unbounded. `0` behaves like a shallow merge
 * (`{ ...target, ...source }`), `1` deep-merges only top-level plain objects, etc.
 *
 * @param target Base object.
 * @param args Sources followed by an optional depth (`deepMerge(a, b, c, 2)`).
 * @returns A new merged object.
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  ...args: Array<Record<string, unknown> | number>
): T;
export function deepMerge(
  target: Record<string, unknown>,
  ...args: Array<Record<string, unknown> | number>
): Record<string, unknown> {
  let maxDepth = Number.POSITIVE_INFINITY;
  let sources = args as Array<Record<string, unknown>>;

  if (args.length > 0 && typeof args[args.length - 1] === 'number') {
    maxDepth = args[args.length - 1] as number;
    sources = args.slice(0, -1) as Array<Record<string, unknown>>;
  }

  let output: Record<string, unknown> = { ...target };

  for (const source of sources) {
    output = mergeTwo(output, source, maxDepth);
  }

  return output;
}

function mergeTwo(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
  maxDepth: number,
): Record<string, unknown> {
  const output: Record<string, unknown> = { ...target };

  if (!isPlainObject(source)) return output;

  for (const key of Object.keys(source)) {
    const targetValue = output[key];
    const sourceValue = (source as Record<string, unknown>)[key];

    if (sourceValue === undefined) continue;

    if (
      maxDepth > 0 &&
      isPlainObject(targetValue) &&
      isPlainObject(sourceValue)
    ) {
      output[key] = mergeTwo(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>,
        maxDepth - 1,
      );
    } else {
      output[key] = cloneValue(sourceValue);
    }
  }

  return output;
}
