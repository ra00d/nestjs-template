import z from 'zod';

export const baseQuerySchema = z.object({
  page: z.coerce
    .number()
    .int()
    .min(1)
    .default(1)
    .meta({
      examples: [1],
    }),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .meta({
      examples: [20],
    }),
  order: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().optional(),
});
