import { INestApplication } from '@nestjs/common';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { Test, TestingModule } from '@nestjs/testing';
import request, { type Response } from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module';

// Exercises the generated posts/comments slice end to end: auth default,
// validation, filtering, search, pagination envelope, includes, update and
// delete. Runs against the local database (see vitest.config.e2e.ts).
describe('Generated modules (e2e)', () => {
  let app: INestApplication<App>;
  let base: string;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication(new FastifyAdapter());
    await app.listen(0);
    const server = app.getHttpServer();
    const address = server.address() as { port: number };
    base = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await app.close();
  });

  // A browser's cookie jar, carried by hand because supertest's own drops the
  // `Secure` cookies the application sets over plain HTTP (see the magic-link
  // e2e spec for the same helper).
  const browser = () => {
    const jar = new Map<string, string>();
    const call = async (method: 'get' | 'post' | 'patch' | 'delete', path: string, body?: object): Promise<Response> => {
      const pending = request(base)[method](path);
      const cookies = [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
      if (cookies) {
        pending.set('Cookie', cookies);
      }
      const res = await (body === undefined ? pending : pending.send(body));
      for (const header of res.headers['set-cookie'] ?? []) {
        const [pair] = header.split(';');
        const separator = pair.indexOf('=');
        jar.set(pair.slice(0, separator), pair.slice(separator + 1));
      }
      return res;
    };
    return {
      get: (path: string) => ({
        expect: (status: number) => call('get', path).then((res) => (expect(res.status).toBe(status), res)),
      }),
      post: (path: string) => ({
        send: (body: object) => ({
          expect: (status: number) => call('post', path, body).then((res) => (expect(res.status).toBe(status), res)),
        }),
      }),
      patch: (path: string) => ({
        send: (body: object) => ({
          expect: (status: number) => call('patch', path, body).then((res) => (expect(res.status).toBe(status), res)),
        }),
      }),
      delete: (path: string) => ({
        expect: (status: number) => call('delete', path).then((res) => (expect(res.status).toBe(status), res)),
      }),
    };
  };

  it('serves the full generated query contract', async () => {
    const client = browser();
    const email = `smoke-${crypto.randomUUID()}@example.com`;
    const password = 'smoke-test-password-1';

    // The `filters` query value is a JSON-encoded array of filter items.
    const filters = (items: object[]): string =>
      encodeURIComponent(JSON.stringify(items));

    // Routes are private by default.
    await client.get('/posts').expect(401);

    await client.post('/auth/sign-up').send({ email, password }).expect(201);
    await client.post('/auth/sign-in').send({ email, password }).expect(200);
    const me = (await client.get('/me').expect(200)).body;

    const first = (
      await client.post('/posts').send({ title: 'Hello world', body: 'First post', authorId: me.id }).expect(201)
    ).body;
    await client.post('/posts').send({ title: 'Second post', status: 'published', views: 42, authorId: me.id }).expect(201);

    // An unknown sort key is a 400 from the list query schema.
    await client.get('/posts?sort=nope').expect(400);

    // An unknown filter field is a 400 from the filter item schema.
    await client
      .get(
        `/posts?filters=${filters([{ field: 'nope', operator: 'eq', value: 'x' }])}`,
      )
      .expect(400);

    const filtered = (
      await client
        .get(
          `/posts?filters=${filters([
            { field: 'status', operator: 'eq', value: 'draft' },
            { field: 'views', operator: 'gte', value: 0 },
          ])}`,
        )
        .expect(200)
    ).body;
    expect(filtered.meta).toMatchObject({ page: 1, limit: 20 });
    expect(filtered.meta.total).toBeGreaterThanOrEqual(1);

    const searched = (await client.get('/posts?search=hello').expect(200)).body;
    expect(searched.meta.total).toBeGreaterThanOrEqual(1);

    const sorted = (await client.get('/posts?sort=views&order=desc&limit=1').expect(200)).body;
    expect(sorted.data).toHaveLength(1);
    expect(sorted.meta.totalPages).toBeGreaterThanOrEqual(1);

    const one = (await client.get(`/posts/${first.id}?include=author,comments`).expect(200)).body;
    expect(one.title).toBe('Hello world');

    await client.patch(`/posts/${first.id}`).send({ views: 7 }).expect(200);
    await client.delete(`/posts/${first.id}`).expect(204);
    await client.get(`/posts/${first.id}`).expect(404);
  });
});
