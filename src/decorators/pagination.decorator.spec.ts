import { Controller, Get, INestApplication } from '@nestjs/common';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { Pagination, type PaginationParams } from './pagination.decorator';

@Controller('items')
class TestItemsController {
  @Get()
  list(@Pagination() pagination: PaginationParams): PaginationParams {
    return pagination;
  }

  @Get('custom')
  listCustom(
    @Pagination({ defaultPage: 2, defaultLimit: 5, maxLimit: 10 })
    pagination: PaginationParams,
  ): PaginationParams {
    return pagination;
  }
}

describe('Pagination decorator', () => {
  let app: INestApplication;
  let base: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [TestItemsController],
    }).compile();

    app = module.createNestApplication(new FastifyAdapter());
    await app.listen(0);
    const { port } = app.getHttpServer().address() as { port: number };
    base = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  const get = async (url: string): Promise<PaginationParams> =>
    (await (await fetch(`${base}${url}`)).json()) as PaginationParams;

  it('falls back to the defaults without query params', async () => {
    await expect(get('/items')).resolves.toEqual({
      page: 1,
      limit: 20,
      offset: 0,
    });
  });

  it('reads page and limit from the query and derives the offset', async () => {
    await expect(get('/items?page=3&limit=50')).resolves.toEqual({
      page: 3,
      limit: 50,
      offset: 100,
    });
  });

  it('ignores a limit above the maximum', async () => {
    await expect(get('/items?page=2&limit=101')).resolves.toEqual({
      page: 2,
      limit: 20,
      offset: 20,
    });
  });

  it('ignores a non-numeric page', async () => {
    await expect(get('/items?page=first&limit=10')).resolves.toEqual({
      page: 1,
      limit: 10,
      offset: 0,
    });
  });

  it('accepts per-route options', async () => {
    await expect(get('/items/custom')).resolves.toEqual({
      page: 2,
      limit: 5,
      offset: 5,
    });
    await expect(get('/items/custom?limit=25')).resolves.toEqual({
      page: 2,
      limit: 5,
      offset: 5,
    });
  });
});
