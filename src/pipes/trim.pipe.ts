import { Injectable, type PipeTransform } from '@nestjs/common';

function trimDeep(value: unknown): unknown {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) return value.map(trimDeep);
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      out[key] = trimDeep(entry);
    }
    return out;
  }
  return value;
}

/**
 * Trims leading/trailing whitespace from every string in the request
 * payload (`body`, `query`, `param`). Runs before validation so
 * `@IsEmail()`-style and Zod `min(1)` checks see the trimmed value —
 * `"  a@b.c "` validates, `"   "` fails as empty.
 */
@Injectable()
export class TrimPipe implements PipeTransform {
  transform(value: unknown): unknown {
    if (value === undefined || value === null) return value;
    return trimDeep(value);
  }
}
