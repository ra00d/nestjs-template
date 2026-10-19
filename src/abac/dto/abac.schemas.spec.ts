import { createAbacPolicySchema } from './abac.schemas';

const basePolicy = {
  name: 'Owners can update comments',
  resource: 'comment',
  action: 'update',
};

describe('abacRulesSchema', () => {
  it('accepts references, operators, ranges and lists', () => {
    const result = createAbacPolicySchema.safeParse({
      ...basePolicy,
      rules: {
        subject: { roles: 'editor', department: ['engineering', 'sales'] },
        resource: {
          ownerId: '{{subject.id}}',
          status: { in: ['draft', 'published'] },
          views: { gte: 10 },
          expiresAt: { start: '2026-01-01', end: '2026-12-31' },
        },
        environment: { time: { start: '09:00', end: '18:00' } },
      },
    });
    expect(result.success).toBe(true);
  });

  it('applies effect, priority and isActive defaults', () => {
    const result = createAbacPolicySchema.parse({
      ...basePolicy,
      rules: {},
    });
    expect(result).toMatchObject({
      effect: 'allow',
      priority: 100,
      isActive: true,
    });
  });

  it('coerces expiresAt into a Date', () => {
    const result = createAbacPolicySchema.parse({
      ...basePolicy,
      rules: {},
      expiresAt: '2027-01-01T00:00:00.000Z',
    });
    expect(result.expiresAt).toBeInstanceOf(Date);
  });

  it('rejects references outside the three bags', () => {
    const result = createAbacPolicySchema.safeParse({
      ...basePolicy,
      rules: { subject: { ownerId: '{{user.id}}' } },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]).toMatchObject({
        path: ['rules', 'subject', 'ownerId'],
      });
    }
  });

  it('rejects malformed and unbalanced references', () => {
    expect(
      createAbacPolicySchema.safeParse({
        ...basePolicy,
        rules: { resource: { ownerId: '{{subject.}}' } },
      }).success,
    ).toBe(false);
    expect(
      createAbacPolicySchema.safeParse({
        ...basePolicy,
        rules: { resource: { ownerId: '{{subject.id' } },
      }).success,
    ).toBe(false);
  });

  it('rejects unknown bags, empty operator objects and bare objects', () => {
    expect(
      createAbacPolicySchema.safeParse({
        ...basePolicy,
        rules: { admin: { roles: 'admin' } },
      }).success,
    ).toBe(false);
    expect(
      createAbacPolicySchema.safeParse({
        ...basePolicy,
        rules: { subject: { roles: {} } },
      }).success,
    ).toBe(false);
    expect(
      createAbacPolicySchema.safeParse({
        ...basePolicy,
        rules: { subject: { roles: { unknown: 'editor' } } },
      }).success,
    ).toBe(false);
  });

  it('rejects empty membership lists and unknown operators', () => {
    expect(
      createAbacPolicySchema.safeParse({
        ...basePolicy,
        rules: { subject: { roles: { in: [] } } },
      }).success,
    ).toBe(false);
    expect(
      createAbacPolicySchema.safeParse({
        ...basePolicy,
        rules: { subject: { roles: { isAdmin: true } } },
      }).success,
    ).toBe(false);
  });
});
