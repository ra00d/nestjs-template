import type { EntityContext } from './context';

/** `posts.service.spec.ts`: service unit test with a mocked repository. */
export const buildSpecFile = (context: EntityContext): { path: string; content: string } => {
  const { names, moduleDir } = context;
  const path = `${moduleDir}/services/${names.name}.service.spec.ts`;
  const { entity, plural, base } = names;

  const content = `import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { ${entity} } from '../${base}';
import type { Create${entity}Dto } from '../dto/create-${base}.dto';
import type { Update${entity}Dto } from '../dto/update-${base}.dto';
import type { List${entity}QueryDto } from '../dto/list-${base}.query';
import { ${plural}Repository } from '../repositories/${names.name}.repository';
import { ${plural}Service } from './${names.name}.service';

describe('${plural}Service', () => {
  let moduleRef: TestingModule;
  let service: ${plural}Service;
  let repository: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findAll: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    repository = {
      create: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };
    moduleRef = await Test.createTestingModule({
      providers: [${plural}Service, { provide: ${plural}Repository, useValue: repository }],
    }).compile();
    service = moduleRef.get(${plural}Service);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('creates a ${base} through the repository', async () => {
    const ${base} = { id: '${base}-1' } as ${entity};
    repository.create.mockResolvedValue(${base});

    await expect(service.create({} as Create${entity}Dto)).resolves.toBe(${base});
    expect(repository.create).toHaveBeenCalledTimes(1);
  });

  it('passes the list query through and returns the page', async () => {
    const ${base} = { id: '${base}-1' } as ${entity};
    repository.findAll.mockResolvedValue({ data: [${base}], total: 21 });

    await expect(service.findAll({ page: 2, limit: 20 } as List${entity}QueryDto)).resolves.toEqual({
      data: [${base}],
      meta: { page: 2, limit: 20, total: 21, totalPages: 2 },
    });
    expect(repository.findAll).toHaveBeenCalledTimes(1);
  });

  it('throws for a missing ${base}', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('throws when updating a missing ${base}', async () => {
    repository.update.mockResolvedValue(null);

    await expect(service.update('missing', {} as Update${entity}Dto)).rejects.toThrow(NotFoundException);
  });

  it('delegates removal to the repository', async () => {
    repository.remove.mockResolvedValue(undefined);

    await expect(service.remove('${base}-1')).resolves.toBeUndefined();
  });
});
`;

  return { path, content };
};
