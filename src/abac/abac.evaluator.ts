import { ABAC_MISSING, readPath, resolveAbacValue } from './abac.references';
import type {
  AbacDecision,
  AbacEffect,
  AbacPolicySummary,
  AbacRequest,
  AbacRules,
  AbacScalar,
} from './abac.types';

/**
 * The pure half of the ABAC engine: given a request and the candidate
 * policies (already loaded for the request's resource and action), it decides
 * whether access is allowed, which policy decided, and why.
 *
 * Precedence: the matching policy with the lowest `priority` decides. When
 * several match at that same priority, an explicit `deny` wins over an
 * `allow` — deny-overrides at equal precedence. Nothing matching means deny:
 * the engine is closed by default.
 *
 * Everything here is deterministic and side-effect free; the database half
 * lives in `AbacRepository` / `AbacService`.
 */

/** The columns the evaluator reads; a full `abac_policy` row satisfies this. */
export interface AbacEvaluablePolicy {
  id: number;
  name: string;
  slug: string;
  effect: AbacEffect;
  priority: number;
  rules: AbacRules;
  isActive?: boolean | null;
  expiresAt?: Date | null;
  deletedAt?: Date | null;
}

/**
 * The default environment attributes, all UTC: `now` (a `Date`), `time`
 * (`"HH:mm:ss"`), `date` (`"YYYY-MM-DD"`) and `dayOfWeek` (0 = Sunday).
 * `AbacService.authorize` merges the caller's `environment` over these, so a
 * rule like `{"time": {"start": "09:00", "end": "18:00"}}` works without any
 * caller setup.
 */
export function abacEnvironment(
  now: Date = new Date(),
): Record<string, unknown> {
  const pad = (value: number) => String(value).padStart(2, '0');
  return {
    now,
    time: `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`,
    date: now.toISOString().slice(0, 10),
    dayOfWeek: now.getUTCDay(),
  };
}

/** Whether a policy applies at `now`: active, not soft-deleted, not expired. */
export function isPolicyActive(
  policy: AbacEvaluablePolicy,
  now: Date,
): boolean {
  if (policy.isActive === false) return false;
  if (policy.deletedAt != null) return false;
  if (policy.expiresAt != null && policy.expiresAt.getTime() <= now.getTime()) {
    return false;
  }
  return true;
}

/**
 * Whether every rule in every present bag matches the request. An absent or
 * empty bag constrains nothing.
 */
export function matchesAbacPolicy(
  policy: AbacEvaluablePolicy,
  request: AbacRequest,
): boolean {
  return (
    matchesSection(policy.rules.subject, request.subject, request) &&
    matchesSection(policy.rules.resource, request.attributes ?? {}, request) &&
    matchesSection(policy.rules.environment, request.environment ?? {}, request)
  );
}

/**
 * Evaluates `request` against the candidate policies and returns the
 * decision. Inactive, soft-deleted and expired policies are ignored even if
 * the caller passes them; the repository already filters them out in SQL.
 */
export function evaluateAbac(
  request: AbacRequest,
  policies: readonly AbacEvaluablePolicy[],
): AbacDecision {
  const now = request.now ?? new Date();
  const applicable = policies.filter((policy) => isPolicyActive(policy, now));
  const matches = applicable
    .filter((policy) => matchesAbacPolicy(policy, request))
    .sort(comparePrecedence);

  if (applicable.length === 0) {
    return deny('no-policies');
  }
  if (matches.length === 0) {
    return deny('no-match');
  }

  const topPriority = matches[0].priority;
  const finalists = matches.filter((policy) => policy.priority === topPriority);
  const deciding =
    finalists.find((policy) => policy.effect === 'deny') ?? finalists[0];

  return {
    allowed: deciding.effect === 'allow',
    effect: deciding.effect,
    policy: summarize(deciding),
    matches: matches.map(summarize),
    reason: 'matched',
  };
}

const deny = (reason: 'no-policies' | 'no-match'): AbacDecision => ({
  allowed: false,
  effect: 'deny',
  policy: null,
  matches: [],
  reason,
});

const summarize = (policy: AbacEvaluablePolicy): AbacPolicySummary => ({
  id: policy.id,
  name: policy.name,
  slug: policy.slug,
  effect: policy.effect,
  priority: policy.priority,
});

const comparePrecedence = (
  left: AbacEvaluablePolicy,
  right: AbacEvaluablePolicy,
): number => left.priority - right.priority || left.id - right.id;

function matchesSection(
  rules: Readonly<Record<string, unknown>> | undefined,
  source: unknown,
  request: AbacRequest,
): boolean {
  if (rules == null) return true;
  return Object.entries(rules).every(([path, rule]) =>
    matchesRule(readPath(source, path), rule, request),
  );
}

function matchesRule(
  actual: unknown,
  rule: unknown,
  request: AbacRequest,
): boolean {
  const expected = resolveAbacValue(rule, request);
  if (expected === ABAC_MISSING) return false;
  if (isPlainObject(expected)) {
    const entries = Object.entries(expected);
    if (entries.length === 0) return false;
    if ('start' in expected || 'end' in expected) {
      return applyRange(expected, actual);
    }
    return entries.every(([operator, operand]) =>
      applyOperator(operator, operand, actual),
    );
  }
  return equality(expected, actual);
}

function applyOperator(
  operator: string,
  operand: unknown,
  actual: unknown,
): boolean {
  switch (operator) {
    case 'eq':
      return equality(operand, actual);
    case 'ne': {
      if (operand === ABAC_MISSING || actual === ABAC_MISSING) return false;
      if (Array.isArray(operand) && operand.includes(ABAC_MISSING)) {
        return false;
      }
      return !equality(operand, actual);
    }
    case 'in': {
      const list = operandList(operand);
      return list !== null && containsAny(list, actual);
    }
    case 'nin': {
      const list = operandList(operand);
      return (
        list !== null && actual !== ABAC_MISSING && !containsAny(list, actual)
      );
    }
    case 'gt': {
      const comparison = compareWhenPresent(actual, operand);
      return comparison !== null && comparison > 0;
    }
    case 'gte': {
      const comparison = compareWhenPresent(actual, operand);
      return comparison !== null && comparison >= 0;
    }
    case 'lt': {
      const comparison = compareWhenPresent(actual, operand);
      return comparison !== null && comparison < 0;
    }
    case 'lte': {
      const comparison = compareWhenPresent(actual, operand);
      return comparison !== null && comparison <= 0;
    }
    case 'contains':
      return containsValue(operand, actual);
    case 'startsWith':
      return (
        typeof operand === 'string' &&
        typeof actual === 'string' &&
        actual.startsWith(operand)
      );
    case 'endsWith':
      return (
        typeof operand === 'string' &&
        typeof actual === 'string' &&
        actual.endsWith(operand)
      );
    case 'between': {
      const bounds = operandList(operand);
      if (bounds === null || bounds.length !== 2) return false;
      const lower = compareWhenPresent(actual, bounds[0]);
      const upper = compareWhenPresent(actual, bounds[1]);
      return lower !== null && upper !== null && lower >= 0 && upper <= 0;
    }
    case 'exists':
      return typeof operand === 'boolean' && isPresent(actual) === operand;
    default:
      return false;
  }
}

function applyRange(range: Record<string, unknown>, actual: unknown): boolean {
  const start = range['start'];
  const end = range['end'];
  if (
    start === ABAC_MISSING ||
    end === ABAC_MISSING ||
    actual === ABAC_MISSING
  ) {
    return false;
  }
  if (typeof start === 'string' && typeof end === 'string') {
    const window = timeWindow(actual, start, end);
    if (window !== null) return window;
  }
  const lower = compareWhenPresent(actual, start);
  const upper = compareWhenPresent(actual, end);
  return lower !== null && upper !== null && lower >= 0 && upper <= 0;
}

/** Equality where an array on either side matches when any element does. */
function equality(expected: unknown, actual: unknown): boolean {
  if (expected === ABAC_MISSING) return false;
  if (Array.isArray(expected)) {
    const list = expected.filter((item) => item !== ABAC_MISSING);
    return list.length > 0 && containsAny(list, actual);
  }
  if (Array.isArray(actual)) {
    return actual.some(
      (item) => item !== ABAC_MISSING && looseEquals(expected, item),
    );
  }
  if (actual === ABAC_MISSING) return false;
  return looseEquals(expected, actual);
}

function containsValue(operand: unknown, actual: unknown): boolean {
  if (operand === ABAC_MISSING || actual === ABAC_MISSING) return false;
  const expected = Array.isArray(operand)
    ? operand.filter((item) => item !== ABAC_MISSING)
    : [operand];
  if (expected.length === 0) return false;
  if (Array.isArray(actual)) return containsAny(expected, actual);
  if (typeof actual === 'string') {
    return expected.some(
      (item) => typeof item === 'string' && actual.includes(item),
    );
  }
  return false;
}

/** Whether any entry of `list` equals `actual` (or any element of an array attribute). */
function containsAny(list: readonly unknown[], actual: unknown): boolean {
  if (actual === ABAC_MISSING) return false;
  if (Array.isArray(actual)) {
    return actual.some((item) =>
      list.some((expected) => looseEquals(expected, item)),
    );
  }
  return list.some((expected) => looseEquals(expected, actual));
}

/**
 * Normalizes a membership operand into a list, dropping unresolved
 * references. `null` means the list is unusable (empty or not a list), which
 * every caller treats as a failing rule.
 */
function operandList(operand: unknown): AbacScalar[] | null {
  if (operand === ABAC_MISSING) return null;
  if (Array.isArray(operand)) {
    const list = operand.filter(
      (item): item is AbacScalar => item !== ABAC_MISSING,
    );
    return list.length > 0 ? list : null;
  }
  return [operand as AbacScalar];
}

function compareWhenPresent(actual: unknown, bound: unknown): number | null {
  if (actual === ABAC_MISSING || bound === ABAC_MISSING) return null;
  return compareValues(actual, bound);
}

/**
 * Ordering across a `Date`, number or string pair. Returns `null` when the
 * values are not comparable, which fails the rule. Strings compare
 * lexicographically, so use zero-padded times/dates or `Date` attributes
 * when order matters.
 */
function compareValues(actual: unknown, bound: unknown): number | null {
  if (actual instanceof Date || bound instanceof Date) {
    const left = toEpoch(actual);
    const right = toEpoch(bound);
    return left === null || right === null ? null : left - right;
  }
  if (typeof actual === 'number' && typeof bound === 'number') {
    return actual - bound;
  }
  if (typeof actual === 'string' && typeof bound === 'string') {
    return actual < bound ? -1 : actual > bound ? 1 : 0;
  }
  return null;
}

function looseEquals(left: unknown, right: unknown): boolean {
  if (left instanceof Date || right instanceof Date) {
    const a = toEpoch(left);
    const b = toEpoch(right);
    return a !== null && b !== null && a === b;
  }
  return left === right;
}

function toEpoch(value: unknown): number | null {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function isPresent(value: unknown): boolean {
  return value !== ABAC_MISSING && value !== null;
}

/**
 * Whether `actual` falls inside the `start`–`end` time window (inclusive),
 * or `null` when the bounds are not times. Windows that do not wrap
 * (`09:00`–`18:00`) contain the clock time; windows that do (`22:00`–`06:00`)
 * contain both ends of the night. `Date` attributes contribute their UTC
 * clock time.
 */
function timeWindow(
  actual: unknown,
  start: string,
  end: string,
): boolean | null {
  const from = parseTimeOfDay(start);
  const to = parseTimeOfDay(end);
  if (from === null || to === null) return null;
  const at = secondsOfDay(actual);
  if (at === null) return false;
  return from <= to ? at >= from && at <= to : at >= from || at <= to;
}

function secondsOfDay(value: unknown): number | null {
  if (typeof value === 'string') return parseTimeOfDay(value);
  if (value instanceof Date) {
    return (
      value.getUTCHours() * 3600 +
      value.getUTCMinutes() * 60 +
      value.getUTCSeconds()
    );
  }
  return null;
}

function parseTimeOfDay(text: string): number | null {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(text.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] === undefined ? 0 : Number(match[3]);
  if (hours > 23 || minutes > 59 || seconds > 59) return null;
  return hours * 3600 + minutes * 60 + seconds;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    value != null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  );
}
