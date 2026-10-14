import type { EntityContext } from './context.ts';

/** `repositories/posts.repository.spec.ts`: repository test with a mocked database. */
export const buildRepositorySpecFile = (context: EntityContext): { path: string; content: string } => {
  const { names, relations } = context;
  const path = `${context.moduleDir}/repositories/${names.name}.repository.spec.ts`;
  const { entity, plural, base } = names;
  const hasRelations = relations.length > 0;

  const content = `import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { ${entity} } from '../${base}.js';
import type { Create${entity}Dto } from '../dto/create-${base}.dto.js';
import type { Update${entity}Dto } from '../dto/update-${base}.dto.js';
import type { List${entity}QueryDto } from '../dto/list-${base}.query.js';
import { ${plural}Repository } from './${names.name}.repository.js';

/** select() mock resolving at .where(): single-row reads and relation loads. */
const whereRows = (result: unknown) => ({ from: () => ({ where: () => Promise.resolve(result) }) });

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
${hasRelations ? `
  it('loads requested relations for a single ${base}', async () => {
    const found = row({ authorId: 'author-1' });
    db.select
      .mockReturnValueOnce(whereRows([found]))
      .mockReturnValueOnce(whereRows([{ id: 'author-1' }]))
      .mockReturnValueOnce(whereRows([]));

    const result = await repository.findById(found.id, new Set(['author', 'comments']));
    expect(result?.author).toMatchObject({ id: 'author-1' });
    expect(result?.comments).toEqual([]);
    expect(db.select).toHaveBeenCalledTimes(3);
  });
` : ``}
  it('lists ${base}s with the total', async () => {
    const rows = [row(), row({ id: '${base}-2' })];
    db.select.mockReturnValue(selectRows(rows));
    db.$count.mockResolvedValue(2);

    await expect(repository.findAll({ page: 1, limit: 20 } as List${entity}QueryDto)).resolves.toEqual({
      data: rows,
      total: 2,
    });
  });
${hasRelations ? `
  it('loads requested relations for a page', async () => {
    const rows = [row({ authorId: 'author-1' })];
    db.select
      .mockReturnValueOnce(selectRows(rows))
      .mockReturnValueOnce(whereRows([{ id: 'author-1' }]))
      .mockReturnValueOnce(whereRows([]));
    db.$count.mockResolvedValue(1);

    const result = await repository.findAll({ page: 1, limit: 20, include: new Set(['author']) } as List${entity}QueryDto);
    expect(result.data[0]?.author).toMatchObject({ id: 'author-1' });
    expect(result.total).toBe(1);
  });
` : ``}
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
