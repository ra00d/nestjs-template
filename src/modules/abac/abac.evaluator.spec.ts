import {
  abacEnvironment,
  evaluateAbac,
  type AbacEvaluablePolicy,
} from './abac.evaluator';
import type { AbacRequest } from './abac.types';

const policy = (
  overrides: Pick<AbacEvaluablePolicy, 'id'> & Partial<AbacEvaluablePolicy>,
): AbacEvaluablePolicy => ({
  name: `policy ${overrides.id}`,
  slug: `policy-${overrides.id}`,
  effect: 'allow',
  priority: 100,
  rules: {},
  ...overrides,
});

const request = (overrides: Partial<AbacRequest> = {}): AbacRequest => ({
  subject: {
    id: 'user-1',
    email: 'user@example.com',
    roles: ['editor'],
    authenticated: true,
  },
  resource: 'comment',
  action: 'update',
  attributes: {},
  ...overrides,
});

describe('evaluateAbac', () => {
  it('allows when a policy matches every present bag', () => {
    const owner = policy({
      id: 1,
      slug: 'owners-update',
      rules: {
        subject: { roles: 'editor' },
        resource: { ownerId: '{{subject.id}}' },
      },
    });
    const decision = evaluateAbac(
      request({ attributes: { ownerId: 'user-1' } }),
      [owner],
    );

    expect(decision).toMatchObject({
      allowed: true,
      effect: 'allow',
      reason: 'matched',
      policy: { id: 1, slug: 'owners-update' },
    });
    expect(decision.matches).toHaveLength(1);
  });

  it('defaults to deny with no candidate policies', () => {
    expect(evaluateAbac(request(), [])).toMatchObject({
      allowed: false,
      effect: 'deny',
      policy: null,
      reason: 'no-policies',
    });
  });

  it('reports no-match when nothing applies', () => {
    const denied = policy({
      id: 1,
      effect: 'deny',
      rules: { resource: { status: 'archived' } },
    });
    expect(evaluateAbac(request(), [denied])).toMatchObject({
      allowed: false,
      reason: 'no-match',
      policy: null,
    });
  });

  it('a rule referencing a missing attribute never matches', () => {
    const owner = policy({
      id: 1,
      rules: { resource: { ownerId: '{{subject.id}}' } },
    });
    expect(evaluateAbac(request(), [owner])).toMatchObject({
      allowed: false,
      reason: 'no-match',
    });
  });

  it('lets the lowest priority decide', () => {
    const allow = policy({ id: 1, priority: 10, rules: {} });
    const deny = policy({ id: 2, priority: 20, effect: 'deny', rules: {} });

    const decision = evaluateAbac(request(), [deny, allow]);
    expect(decision).toMatchObject({
      allowed: true,
      effect: 'allow',
      policy: { id: 1 },
    });
    expect(decision.matches.map((match) => match.id)).toEqual([1, 2]);
  });

  it('deny overrides allow at equal priority', () => {
    const allow = policy({ id: 1, priority: 50, rules: {} });
    const deny = policy({ id: 2, priority: 50, effect: 'deny', rules: {} });

    const decision = evaluateAbac(request(), [allow, deny]);
    expect(decision).toMatchObject({
      allowed: false,
      effect: 'deny',
      policy: { id: 2 },
    });
  });

  it('ignores inactive, soft-deleted and expired policies', () => {
    const now = new Date('2026-06-01T12:00:00Z');
    const policies = [
      policy({ id: 1, isActive: false, rules: {} }),
      policy({ id: 2, deletedAt: now, rules: {} }),
      policy({ id: 3, expiresAt: now, rules: {} }),
    ];
    expect(evaluateAbac(request({ now }), policies)).toMatchObject({
      reason: 'no-policies',
    });
  });

  it('matches array attributes against a scalar or a list', () => {
    const scalar = policy({ id: 1, rules: { subject: { roles: 'editor' } } });
    const list = policy({
      id: 2,
      rules: { subject: { roles: ['admin', 'editor'] } },
    });
    const operator = policy({
      id: 3,
      rules: { subject: { permissions: { in: ['moderate'] } } },
    });
    const withPermission = request({
      subject: {
        id: 'user-1',
        roles: ['editor'],
        permissions: ['moderate'],
        authenticated: true,
      },
    });

    expect(evaluateAbac(withPermission, [scalar]).allowed).toBe(true);
    expect(evaluateAbac(withPermission, [list]).allowed).toBe(true);
    expect(evaluateAbac(withPermission, [operator]).allowed).toBe(true);
  });

  it('supports comparisons, ranges and existence checks', () => {
    const views = policy({
      id: 1,
      rules: { resource: { views: { gte: 10, lt: 100 } } },
    });
    const windowRange = policy({
      id: 2,
      rules: { resource: { views: { start: 5, end: 15 } } },
    });
    const between = policy({
      id: 3,
      rules: { resource: { views: { between: [5, 15] } } },
    });
    const absent = policy({
      id: 4,
      rules: { resource: { archivedAt: { exists: false } } },
    });

    const inRange = request({ attributes: { views: 10 } });
    expect(evaluateAbac(inRange, [views]).allowed).toBe(true);
    expect(evaluateAbac(inRange, [windowRange]).allowed).toBe(true);
    expect(evaluateAbac(inRange, [between]).allowed).toBe(true);
    expect(evaluateAbac(inRange, [absent]).allowed).toBe(true);
    expect(
      evaluateAbac(request({ attributes: { views: 5 } }), [views]).allowed,
    ).toBe(false);
    expect(
      evaluateAbac(
        request({
          attributes: { views: 10, archivedAt: '2026-01-01T00:00:00Z' },
        }),
        [absent],
      ).allowed,
    ).toBe(false);
  });

  it('never passes negated operators on missing attributes', () => {
    const notAdmin = policy({
      id: 1,
      rules: { subject: { department: { ne: 'sales' } } },
    });
    const notInList = policy({
      id: 2,
      rules: { resource: { status: { nin: ['archived'] } } },
    });
    expect(evaluateAbac(request(), [notAdmin]).allowed).toBe(false);
    expect(evaluateAbac(request(), [notInList]).allowed).toBe(false);
  });

  it('matches strings by prefix, suffix and substring', () => {
    const prefix = policy({
      id: 1,
      rules: { resource: { path: { startsWith: '/docs/' } } },
    });
    const suffix = policy({
      id: 2,
      rules: { resource: { path: { endsWith: '.md' } } },
    });
    const substring = policy({
      id: 3,
      rules: { resource: { path: { contains: 'guides' } } },
    });
    const match = request({ attributes: { path: '/docs/guides/abac.md' } });

    expect(evaluateAbac(match, [prefix]).allowed).toBe(true);
    expect(evaluateAbac(match, [suffix]).allowed).toBe(true);
    expect(evaluateAbac(match, [substring]).allowed).toBe(true);
    expect(
      evaluateAbac(request({ attributes: { path: '/src/abac.ts' } }), [prefix])
        .allowed,
    ).toBe(false);
  });

  it('resolves whole references without losing their type', () => {
    const sameLimit = policy({
      id: 1,
      rules: { resource: { limit: '{{resource.requestedLimit}}' } },
    });
    expect(
      evaluateAbac(request({ attributes: { limit: 25, requestedLimit: 25 } }), [
        sameLimit,
      ]).allowed,
    ).toBe(true);
    expect(
      evaluateAbac(request({ attributes: { limit: 25, requestedLimit: 50 } }), [
        sameLimit,
      ]).allowed,
    ).toBe(false);
  });

  it('interpolates embedded references into strings', () => {
    const slug = policy({
      id: 1,
      rules: { resource: { slug: 'post-{{resource.id}}' } },
    });
    expect(
      evaluateAbac(request({ attributes: { id: '7', slug: 'post-7' } }), [slug])
        .allowed,
    ).toBe(true);
  });

  it('fails a whole reference that does not resolve', () => {
    const typo = policy({
      id: 1,
      rules: { resource: { ownerId: '{{subject.idd}}' } },
    });
    expect(
      evaluateAbac(request({ attributes: { ownerId: 'user-1' } }), [typo])
        .allowed,
    ).toBe(false);
  });

  it('matches UTC time windows and wraps overnight ones', () => {
    const businessHours = policy({
      id: 1,
      rules: { environment: { time: { start: '09:00', end: '18:00' } } },
    });
    const nightShift = policy({
      id: 2,
      rules: { environment: { time: { start: '22:00', end: '06:00' } } },
    });

    expect(
      evaluateAbac(request({ environment: { time: '10:00:00' } }), [
        businessHours,
      ]).allowed,
    ).toBe(true);
    expect(
      evaluateAbac(request({ environment: { time: '20:00:00' } }), [
        businessHours,
      ]).allowed,
    ).toBe(false);
    expect(
      evaluateAbac(request({ environment: { time: '23:30:00' } }), [nightShift])
        .allowed,
    ).toBe(true);
    expect(
      evaluateAbac(request({ environment: { time: '12:00:00' } }), [nightShift])
        .allowed,
    ).toBe(false);
  });

  it('compares dates given as Date attributes or ISO bounds', () => {
    const notExpired = policy({
      id: 1,
      rules: {
        resource: { expiresAt: { gte: '{{environment.now}}' } },
      },
    });
    const now = new Date('2026-06-01T00:00:00Z');
    const environment = abacEnvironment(now);

    expect(
      evaluateAbac(
        request({
          now,
          environment,
          attributes: { expiresAt: new Date('2026-12-31T00:00:00Z') },
        }),
        [notExpired],
      ).allowed,
    ).toBe(true);
    expect(
      evaluateAbac(
        request({
          now,
          environment,
          attributes: { expiresAt: new Date('2026-01-01T00:00:00Z') },
        }),
        [notExpired],
      ).allowed,
    ).toBe(false);
  });

  it('lets guests match on subject.authenticated', () => {
    const guestsOnly = policy({
      id: 1,
      rules: { subject: { authenticated: false } },
    });
    const guests = request({
      subject: { id: null, authenticated: false, roles: [] },
    });
    expect(evaluateAbac(guests, [guestsOnly]).allowed).toBe(true);
    expect(evaluateAbac(request(), [guestsOnly]).allowed).toBe(false);
  });
});

describe('abacEnvironment', () => {
  it('exposes UTC defaults', () => {
    const now = new Date('2026-06-01T07:05:09Z');
    expect(abacEnvironment(now)).toEqual({
      now,
      time: '07:05:09',
      date: '2026-06-01',
      dayOfWeek: 1,
    });
  });
});
