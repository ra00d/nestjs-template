import { z } from 'zod';
import { findInvalidReferences } from '../abac.references';

/**
 * Request schemas for the policy API. `abacRulesSchema` is also the
 * compatibility promise for the `rules` JSON column: anything it rejects
 * cannot be stored, and `AbacService` only evaluates what it accepts.
 *
 * Rule references (`{{subject.id}}`, `{{environment.time}}`, …) are checked
 * at the schema level, so a policy full of typos fails at the edge instead
 * of silently never matching.
 */

const scalarSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

/** Range bounds: numbers, ISO dates or `"HH:mm[:ss]"` times. */
const boundSchema = z.union([z.string(), z.number()]);

/** A list of alternatives; `{{...}}` references may stand for any entry. */
const alternativesSchema = z.array(scalarSchema);

const rangeSchema = z.strictObject({
  start: boundSchema,
  end: boundSchema,
});

const operatorsSchema = z
  .strictObject({
    eq: z.union([scalarSchema, alternativesSchema]).optional(),
    ne: z.union([scalarSchema, alternativesSchema]).optional(),
    in: alternativesSchema.min(1).optional(),
    nin: alternativesSchema.min(1).optional(),
    gt: scalarSchema.optional(),
    gte: scalarSchema.optional(),
    lt: scalarSchema.optional(),
    lte: scalarSchema.optional(),
    contains: z.union([scalarSchema, alternativesSchema]).optional(),
    startsWith: z.string().optional(),
    endsWith: z.string().optional(),
    between: z.tuple([scalarSchema, scalarSchema]).optional(),
    exists: z.boolean().optional(),
  })
  .refine((operators) => Object.keys(operators).length > 0, {
    message: 'An operator object needs at least one operator.',
  });

const ruleValueSchema = z.union([
  scalarSchema,
  alternativesSchema,
  rangeSchema,
  operatorsSchema,
]);

const ruleSectionSchema = z.record(z.string().min(1), ruleValueSchema);

export const abacRulesSchema = z
  .strictObject({
    subject: ruleSectionSchema.optional(),
    resource: ruleSectionSchema.optional(),
    environment: ruleSectionSchema.optional(),
  })
  .superRefine((rules, ctx) => {
    for (const [section, sectionRules] of Object.entries(rules)) {
      if (sectionRules === undefined) continue;
      for (const [attribute, value] of Object.entries(sectionRules)) {
        for (const reference of findInvalidReferences(value)) {
          ctx.addIssue({
            code: 'custom',
            message: `Invalid policy reference "${reference}".`,
            path: [section, attribute],
          });
        }
      }
    }
  });

export const createAbacPolicySchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  resource: z.string().min(1),
  action: z.string().min(1),
  rules: abacRulesSchema,
  effect: z.enum(['allow', 'deny']).default('allow'),
  priority: z.number().int().default(100),
  isActive: z.boolean().default(true),
  expiresAt: z.coerce.date().nullable().optional(),
});

export type CreateAbacPolicyDto = z.infer<typeof createAbacPolicySchema>;

export const updateAbacPolicySchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  resource: z.string().min(1).optional(),
  action: z.string().min(1).optional(),
  rules: abacRulesSchema.optional(),
  effect: z.enum(['allow', 'deny']).optional(),
  priority: z.number().int().optional(),
  isActive: z.boolean().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
});

export type UpdateAbacPolicyDto = z.infer<typeof updateAbacPolicySchema>;

// Response and parameter schemas for the policy API.

const dateTimeSchema = z.date().meta({ format: 'date-time' });

export const abacPolicyResponseSchema = z
  .object({
    id: z.number().int(),
    createdAt: dateTimeSchema,
    updatedAt: dateTimeSchema,
    deletedAt: dateTimeSchema.nullable(),
    name: z.string(),
    slug: z.string(),
    description: z.string().nullable(),
    resource: z.string(),
    action: z.string(),
    rules: abacRulesSchema,
    effect: z.enum(['allow', 'deny']),
    priority: z.number().int(),
    isActive: z.boolean(),
    expiresAt: dateTimeSchema.nullable(),
    createdBy: z.string().nullable(),
  })
  .meta({ id: 'AbacPolicy' });

export const abacPolicyListResponseSchema = z.array(abacPolicyResponseSchema);

/**
 * The filters `GET /abac/policies` accepts, as the query strings the route
 * reads. Named descriptors merge with the route's `@Query(...)` metadata.
 */
export const abacPolicyListQueryParams = [
  { name: 'resource', required: false, standardSchema: z.string() },
  { name: 'action', required: false, standardSchema: z.string() },
  {
    name: 'effect',
    required: false,
    standardSchema: z.enum(['allow', 'deny']),
  },
  {
    name: 'isActive',
    required: false,
    standardSchema: z.enum(['true', 'false']),
  },
  { name: 'search', required: false, standardSchema: z.string() },
  {
    name: 'includeDeleted',
    required: false,
    standardSchema: z.enum(['true', 'false']),
  },
];

export const abacPolicyIdParams = [
  { name: 'id', standardSchema: z.coerce.number().int().positive() },
];

export const abacPolicySlugParams = [
  { name: 'slug', standardSchema: z.string().min(1) },
];
