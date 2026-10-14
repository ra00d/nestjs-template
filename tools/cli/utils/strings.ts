/**
 * Shared string helpers used by the CLI.
 */

export const singular = (value: string): string =>
  value.endsWith('s') ? value.slice(0, -1) : value;