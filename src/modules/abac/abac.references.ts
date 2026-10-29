import type { AbacRequest } from './abac.types';

/**
 * `{{...}}` references inside policy rules, and how they resolve against a
 * request. A reference is a dotted path rooted at one of the three bags:
 *
 *   `{{subject.id}}`         the actor's id
 *   `{{subject.roles}}`      the actor's role slugs
 *   `{{resource.owner_id}}`  an attribute of the entity being accessed
 *   `{{environment.time}}`   a default or caller-supplied environment value
 *
 * A string that is exactly one reference keeps the referenced value's type
 * (numbers stay numbers, arrays stay arrays). A reference embedded in a
 * larger string is substituted with its string form; when it does not
 * resolve, the raw `{{...}}` text is left in place so an equality check
 * cannot accidentally pass. A reference as a whole operand that does not
 * resolve becomes {@link ABAC_MISSING} and fails every operator but the
 * `exists` check.
 */

/** The symbol a failed reference resolves to; never equal to stored JSON. */
export const ABAC_MISSING: unique symbol = Symbol('abac.missing');

/** Result of looking up a reference, path or attribute. */
export type AbacMissing = typeof ABAC_MISSING;

const TOKEN = /\{\{\s*([^{}]+?)\s*\}\}/g;
const SOLE_TOKEN = /^\{\{\s*([^{}]+?)\s*\}\}$/;
const REFERENCE_PATH = /^(subject|resource|environment)(\.[A-Za-z_$][\w$]*)+$/;

/** Whether `token` (the text inside `{{ }}`) is a well-formed attribute path. */
export function isReferencePath(token: string): boolean {
  return REFERENCE_PATH.test(token.trim());
}

/** Every `{{...}}` token in `text`, in order of appearance. */
export function findReferenceTokens(text: string): string[] {
  const tokens: string[] = [];
  for (const match of text.matchAll(TOKEN)) {
    tokens.push(match[1]);
  }
  return tokens;
}

/**
 * Reference tokens anywhere inside `value` that are not well-formed, plus a
 * marker for malformed `{{` openings. Used by the DTO schema so a policy
 * cannot be stored with references that could never resolve.
 */
export function findInvalidReferences(value: unknown): string[] {
  const invalid: string[] = [];
  visitStrings(value, (text) => {
    const openings = (text.match(/\{\{/g) ?? []).length;
    if (openings === 0) return;
    const tokens = findReferenceTokens(text);
    if (openings !== tokens.length) {
      invalid.push(text);
    }
    for (const token of tokens) {
      if (!isReferencePath(token)) invalid.push(token);
    }
  });
  return invalid;
}

/**
 * Resolves every string in a rule value against `request`: a sole reference
 * yields the referenced value (or {@link ABAC_MISSING}), an embedded one is
 * interpolated. Arrays and objects (operators, ranges) are resolved
 * element-wise; dates and other non-strings pass through.
 */
export function resolveAbacValue(
  value: unknown,
  request: AbacRequest,
): unknown {
  if (typeof value === 'string') return resolveTemplate(value, request);
  if (Array.isArray(value)) {
    return value.map((item) => resolveAbacValue(item, request));
  }
  if (value != null && typeof value === 'object' && !(value instanceof Date)) {
    const resolved: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      resolved[key] = resolveAbacValue(item, request);
    }
    return resolved;
  }
  return value;
}

/**
 * Reads a dotted path out of a request. The first segment picks the bag
 * (`subject`, `resource` — the request's `attributes` — or `environment`);
 * `readPath` walks the rest.
 */
export function readAbacPath(request: AbacRequest, token: string): unknown {
  const [root, ...rest] = token.trim().split('.');
  const source =
    root === 'subject'
      ? request.subject
      : root === 'resource'
        ? (request.attributes ?? {})
        : root === 'environment'
          ? (request.environment ?? {})
          : ABAC_MISSING;
  return readPath(source, rest.join('.'));
}

/** Dotted-path lookup over objects and arrays; `undefined` entries read as {@link ABAC_MISSING}. */
export function readPath(source: unknown, path: string): unknown {
  let current: unknown = source;
  for (const segment of path.split('.')) {
    if (current == null || typeof current !== 'object') return ABAC_MISSING;
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        return ABAC_MISSING;
      }
      current = current[index];
      continue;
    }
    const record = current as Record<string, unknown>;
    if (!(segment in record)) return ABAC_MISSING;
    current = record[segment];
  }
  return current === undefined ? ABAC_MISSING : current;
}

function resolveTemplate(text: string, request: AbacRequest): unknown {
  const sole = SOLE_TOKEN.exec(text);
  if (sole) {
    return readAbacPath(request, sole[1]);
  }
  if (!text.includes('{{')) return text;
  return text.replace(TOKEN, (raw, token: string) => {
    const found = readAbacPath(request, token);
    return found === ABAC_MISSING ? raw : stringify(found);
  });
}

function stringify(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && value !== null) return JSON.stringify(value);
  return String(value);
}

function visitStrings(value: unknown, visit: (text: string) => void): void {
  if (typeof value === 'string') {
    visit(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) visitStrings(item, visit);
    return;
  }
  if (value != null && typeof value === 'object' && !(value instanceof Date)) {
    for (const item of Object.values(value)) visitStrings(item, visit);
  }
}
