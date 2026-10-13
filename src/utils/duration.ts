const UNITS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
};

const DURATION_PATTERN = /^(-?\d+(?:\.\d+)?)(ms|s|m|h|d|w)$/;

/**
 * Parses TTL-style durations (`'500ms'`, `'15m'`, `'3d'`, `'2w'`) to
 * milliseconds. Use it for every human TTL in config and options instead
 * of scattering `* 1000` math. Throws a `RangeError` on unknown units or
 * non-positive results.
 */
export function parseDurationToMs(raw: string): number {
  const match = DURATION_PATTERN.exec(raw.trim());
  if (!match) {
    throw new RangeError(
      `invalid duration '${raw}': expected like '500ms', '15m', '3d'`,
    );
  }
  const ms = Number(match[1]) * UNITS[match[2]];
  if (!Number.isFinite(ms) || ms <= 0) {
    throw new RangeError(`invalid duration '${raw}': must be positive`);
  }
  return ms;
}

/** Largest whole-unit rendering (`90_000` -> `'15m'`); for logs and docs. */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) {
    throw new RangeError('ms must be a positive number');
  }
  const units: Array<[string, number]> = [
    ['w', UNITS['w']],
    ['d', UNITS['d']],
    ['h', UNITS['h']],
    ['m', UNITS['m']],
    ['s', UNITS['s']],
  ];
  for (const [suffix, size] of units) {
    if (ms >= size && ms % size === 0) return `${ms / size}${suffix}`;
  }
  return `${ms}ms`;
}
