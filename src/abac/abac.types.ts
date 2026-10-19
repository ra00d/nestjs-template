import type { User } from '../auth/types';

/**
 * Attribute-based access control over the rows of `abac_policy`.
 *
 * A policy names an entity (`resource`) and an `action`, and carries a
 * `rules` object with three optional attribute bags — `subject`, `resource`
 * and `environment`. A request matches the policy when every rule in every
 * present bag matches; the repository only loads policies for the requested
 * resource/action that are active, unexpired and not soft-deleted, and
 * `evaluateAbac` picks the winning effect by `priority`.
 *
 * The types below describe the stored JSON, what a request carries, and the
 * decision the engine returns. None of them depend on Nest or Drizzle, so
 * the evaluator stays a pure function.
 */

/** What a matching policy decides. Lower `priority` wins; deny wins ties. */
export type AbacEffect = 'allow' | 'deny';

/**
 * A value a rule can compare against. `Date` is accepted in requests (an
 * attribute or `environment.now`), while `rules` in the database only ever
 * hold strings, numbers, booleans and nulls because the column is JSON.
 */
export type AbacScalar = string | number | boolean | Date | null;

/**
 * A rule operand: one scalar, or several alternatives that any of which may
 * match. `{{...}}` references are resolved before comparison and may resolve
 * to a single value or a list.
 */
export type AbacRuleOperand = AbacScalar | readonly AbacScalar[];

/**
 * An inclusive range. Bounds are numbers, ISO date strings or `"HH:mm[:ss]"`
 * times; a time range runs in UTC and wraps when `start > end` (say
 * `22:00`–`06:00`), and matches time-of-day attributes such as
 * `environment.time` or a `Date`'s UTC clock time.
 */
export interface AbacRange {
  start: string | number;
  end: string | number;
}

/**
 * A comparison object: every operator present must pass (AND). Prefer `eq`
 * for equality — a bare scalar or list is the same shorthand.
 *
 * An attribute that is absent (and a reference that does not resolve) makes
 * every operator except `exists` fail: rules never pass on missing input.
 */
export interface AbacRuleOperators {
  /** Equality. An array attribute matches when any element matches; list operands match one of their entries. */
  eq?: AbacRuleOperand;
  /** Inequality: passes only when both sides are present and not equal. */
  ne?: AbacRuleOperand;
  /** Membership: the attribute (or any element of an array attribute) is in the operand list. */
  in?: readonly AbacScalar[];
  /** `in` negated; fails when the attribute or any operand is missing. */
  nin?: readonly AbacScalar[];
  /** Greater than; numbers compare numerically, dates by instant, strings lexicographically. */
  gt?: AbacScalar;
  /** Greater than or equal to; see `gt`. */
  gte?: AbacScalar;
  /** Less than; see `gt`. */
  lt?: AbacScalar;
  /** Less than or equal to; see `gt`. */
  lte?: AbacScalar;
  /** Substring of a string attribute, or element of an array attribute. */
  contains?: AbacRuleOperand;
  /** Prefix of a string attribute. */
  startsWith?: string;
  /** Suffix of a string attribute. */
  endsWith?: string;
  /** Inclusive range, `[min, max]`, with `start`/`end` semantics. */
  between?: readonly [AbacScalar, AbacScalar];
  /** Whether the attribute is present (not missing and not null). */
  exists?: boolean;
}

/**
 * What a rule matches against: a scalar/list shorthand, a range object
 * (`{ start, end }`) or an operator object. A `{{...}}` reference may stand
 * for any operand.
 */
export type AbacRuleValue =
  AbacScalar | readonly AbacScalar[] | AbacRuleOperators | AbacRange;

/** Attribute paths per bag, e.g. `{ "owner_id": "{{subject.id}}" }`; dots descend into nested objects. */
export type AbacRuleSection = Readonly<Record<string, AbacRuleValue>>;

/** The `rules` JSON column: any subset of the three bags; an absent (or empty) bag constrains nothing. */
export interface AbacRules {
  subject?: AbacRuleSection;
  resource?: AbacRuleSection;
  environment?: AbacRuleSection;
}

/**
 * The acting user plus any extra attributes the caller knows (department,
 * tenant, clearance…). `roles` and `permissions` come off `User` through
 * {@link toAbacSubject}; everything else is open.
 */
export interface AbacSubject {
  id?: string | null;
  email?: string | null;
  emailVerified?: boolean;
  roles?: readonly string[];
  permissions?: readonly string[];
  /** `true` for a signed-in user; rules can gate on it like any attribute. */
  authenticated?: boolean;
  [attribute: string]: unknown;
}

/**
 * One authorization question. `resource` is the entity type — it must equal
 * `abac_policy.resource` — while `attributes` describes the entity instance
 * (`resource.owner_id`, `resource.status`… in rules).
 *
 * `environment` is merged over defaults (`now`, `time`, `date`, `dayOfWeek`,
 * all UTC) so callers override only what they know, e.g. a tenant-local
 * `time`. `now` fixes the evaluation instant for expiry checks and defaults
 * to `new Date()`.
 */
export interface AbacRequest {
  subject: AbacSubject;
  /** Entity type, matching `abac_policy.resource` (e.g. `comment`). */
  resource: string;
  /** Attributes of the entity instance being accessed. */
  attributes?: Readonly<Record<string, unknown>>;
  /** Action being performed, matching `abac_policy.action` (e.g. `update`). */
  action: string;
  /** Extra environment attributes merged over the UTC defaults. */
  environment?: Readonly<Record<string, unknown>>;
  /** Evaluation instant; defaults to `new Date()`. */
  now?: Date;
}

/** The identifying columns of a policy, carried by a decision. */
export interface AbacPolicySummary {
  id: number;
  name: string;
  slug: string;
  effect: AbacEffect;
  priority: number;
}

/** Why a decision came out the way it did. */
export type AbacDecisionReason = 'no-policies' | 'no-match' | 'matched';

/**
 * The engine's answer. Default is deny: with no stored policies or no
 * matching one, `allowed` is `false` and `policy` is `null`. `matches`
 * lists every matching policy, highest precedence first.
 */
export interface AbacDecision {
  allowed: boolean;
  effect: AbacEffect;
  /** The policy that decided, or `null` on a default deny. */
  policy: AbacPolicySummary | null;
  /** Every matching policy, sorted by priority (then id). */
  matches: AbacPolicySummary[];
  reason: AbacDecisionReason;
}

/**
 * Maps the signed-in user (or `null` for a guest) onto a subject: identity
 * columns plus `roles`, `permissions` and `authenticated`, which policies
 * can reference as `subject.id`, `subject.roles`, ….
 */
export function toAbacSubject(user: User | null | undefined): AbacSubject {
  return {
    id: user?.id ?? null,
    email: user?.email ?? null,
    emailVerified: user?.emailVerified ?? false,
    roles: user?.roles ?? [],
    permissions: user?.permissions ?? [],
    authenticated: user != null,
  };
}
