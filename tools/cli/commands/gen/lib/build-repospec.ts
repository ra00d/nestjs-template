import { isUsersRelation } from './build-repository.ts';
import type { EntityContext } from './context.ts';

/** One relation's fixtures: the `select()` mocks it consumes, and the assertions on the loaded result. */
interface RelationFixture {
  mocks: string[];
  /** Row overrides carrying the foreign key the relation loads by. */
  overrides: string[];
  /** Assertion lines for a subject like `result?` or `result.data[0]?`. */
  assertions: (subject: string) => string[];
}

const relationFixture = (
  relation: EntityContext['relations'][number],
): RelationFixture => {
  const relatedId = `${relation.name}-related`;
  if (relation.type === 'one') {
    const [, targetColumn] = relation.references.split('.');
    // A users relation loads through findUsersByIds: one select for the
    // users, one for the role slugs, resolved after .innerJoin().where().
    const mocks = isUsersRelation(relation)
      ? [
          `whereRows([{ ${targetColumn}: '${relatedId}' }])`,
          `joinRows([{ userId: '${relatedId}', slug: 'writer' }])`,
        ]
      : [`whereRows([{ ${targetColumn}: '${relatedId}' }])`];
    const expected = isUsersRelation(relation)
      ? `{ ${targetColumn}: '${relatedId}', roles: ['writer'] }`
      : `{ ${targetColumn}: '${relatedId}' }`;
    return {
      mocks,
      overrides: [`${relation.field}: '${relatedId}'`],
      assertions: (subject) => [
        `expect(${subject}.${relation.name}).toMatchObject(${expected});`,
      ],
    };
  }
  return {
    mocks: ['whereRows([])'],
    overrides: [],
    assertions: (subject) => [`expect(${subject}.${relation.name}).toEqual([]);`],
  };
};

/** `repositories/posts.repository.spec.ts`: repository test with a mocked database. */
export const buildRepositorySpecFile = (context: EntityContext): { path: string; content: string } => {
  const { names, relations } = context;
  const path = `${context.moduleDir}/repositories/${names.name}.repository.spec.ts`;
  const { entity, plural, base } = names;
  const hasRelations = relations.length > 0;

  const fixtures = relations.map(relationFixture);
  const overrides = fixtures.flatMap((fixture) => fixture.overrides).join(', ');
  const mockChain = fixtures
    .flatMap((fixture) => fixture.mocks)
    .map((mock) => `.mockReturnValueOnce(${mock})`)
    .join('\n      ');
  const includes = relations.map((relation) => `'${relation.name}'`).join(', ');
  const relationTests = hasRelations
    ? `
  it('loads requested relations for a single ${base}', async () => {
    const found = row(${overrides.length > 0 ? `{ ${overrides} }` : ''});
    db.select
      .mockReturnValueOnce(whereRows([found]))
      ${mockChain};

    const result = await repository.findById(found.id, new Set([${includes}]));
    ${fixtures.flatMap((fixture) => fixture.assertions('result?')).join('\n    ')}
    expect(db.select).toHaveBeenCalledTimes(${1 + fixtures.flatMap((fixture) => fixture.mocks).length});
  });

  it('loads requested relations for a page', async () => {
    const rows = [row(${overrides.length > 0 ? `{ ${overrides} }` : ''})];
    db.select
      .mockReturnValueOnce(selectRows(rows))
      ${mockChain};
    db.$count.mockResolvedValue(1);

    const result = await repository.findAll({ page: 1, limit: 20, include: new Set([${includes}]) } as List${entity}QueryDto);
    ${fixtures.flatMap((fixture) => fixture.assertions('result.data[0]?')).join('\n    ')}
    expect(result.total).toBe(1);
  });
`
    : '';

  const content = `import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { ${entity} } from '../${base}.js';
import type { Create${entity}Dto } from '../dto/create-${base}.dto.js';
import type { Update${entity}Dto } from '../dto/update-${base}.dto.js';
import type { List${entity}QueryDto } from '../dto/list-${base}.query.js';
import { ${plural}Repository } from './${names.name}.repository.js';

/** select() mock resolving at .where(): single-row reads and relation loads. */
const whereRows = (result: unknown) => ({ from: () => ({ where: () => Promise.resolve(result) }) });

/** select() mock resolving after .innerJoin().where(): the role-slug read inside findUsersByIds(). */
const joinRows = (result: unknown) => ({ from: () => ({ innerJoin: () => ({ where: () => Promise.resolve(result) }) }) });

/** select() mock resolving at .offset(): paginated reads. */
const selectRows = (result: unknown) => ({
  from: () => ({ where: () => ({ orderBy: () => ({ limit: () => ({ offset: () => Promise.resolve(result) }) }) }) }),
});

const row = (overrides: Partial<${entity}> = {}): ${entity} =>
  ({
    id: '${base}-1',
    createdAt: null,
    updatedAt: null,
    deletedAt: null,
    ...overrides,
  }) as ${entity};

describe('${plural}Repository', () => {
  let repository: ${plural}Repository;
  let db: {
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    $count: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    db = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      $count: vi.fn(),
    };
    repository = new ${plural}Repository(db as unknown as NodePgDatabase);
  });

  it('creates a ${base} and returns the created row', async () => {
    const created = row();
    db.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([created]) }),
    });

    await expect(repository.create({} as Create${entity}Dto)).resolves.toBe(created);
    expect(db.insert).toHaveBeenCalledTimes(1);
  });

  it('returns null for a missing ${base}', async () => {
    db.select.mockReturnValue(whereRows([]));

    await expect(repository.findById('missing')).resolves.toBeNull();
  });

  it('finds a ${base} by id', async () => {
    const found = row();
    db.select.mockReturnValue(whereRows([found]));

    await expect(repository.findById(found.id)).resolves.toBe(found);
  });
${relationTests}
  it('lists ${base}s with the total', async () => {
    const rows = [row(), row({ id: '${base}-2' })];
    db.select.mockReturnValue(selectRows(rows));
    db.$count.mockResolvedValue(2);

    await expect(repository.findAll({ page: 1, limit: 20 } as List${entity}QueryDto)).resolves.toEqual({
      data: rows,
      total: 2,
    });
  });

  it('returns null when updating a missing ${base}', async () => {
    db.update.mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }) }),
    });

    await expect(repository.update('missing', {} as Update${entity}Dto)).resolves.toBeNull();
  });

  it('delegates removal to the database', async () => {
    db.delete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });

    await expect(repository.remove('${base}-1')).resolves.toBeUndefined();
    expect(db.delete).toHaveBeenCalledTimes(1);
  });
});
`;

  return { path, content };
};
