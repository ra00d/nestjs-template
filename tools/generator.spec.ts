import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyPlan } from './lib/apply.ts';
import { entityDefinitionText } from './lib/append-entity.ts';
import { buildPlan } from './lib/plan.ts';
import { resolveConfig } from './lib/config.ts';
import { toCamelCase, toSnakeCase } from './lib/names.ts';
import { defineEntity, type EntityDefinition } from './lib/types.ts';
import { config as userConfig } from './gen.config.ts';

const settings = resolveConfig(userConfig);

// Local fixtures (independent of tools/entities.ts, which users edit freely).
const posts = defineEntity({
  name: 'posts',
  fields: [
    { name: 'title', type: 'text', searchable: true },
    { name: 'body', type: 'text', required: false, searchable: true },
    { name: 'status', type: 'enum', values: ['draft', 'published'], default: 'draft', searchable: true },
    { name: 'authorId', type: 'text', references: 'users.id' },
    { name: 'views', type: 'integer', default: 0 },
  ],
  relations: [
    { name: 'author', type: 'one', field: 'authorId', references: 'users.id' },
    { name: 'comments', type: 'many', target: 'comments', foreignKey: 'postId' },
  ],
  timestamps: true,
});
const comments = defineEntity({
  name: 'comments',
  fields: [
    { name: 'postId', type: 'text', references: 'posts.id' },
    { name: 'body', type: 'text', searchable: true },
    { name: 'authorId', type: 'text', references: 'users.id' },
  ],
  relations: [
    { name: 'post', type: 'one', field: 'postId', references: 'posts.id' },
    { name: 'author', type: 'one', field: 'authorId', references: 'users.id' },
  ],
  timestamps: true,
});

const file = (plans: ReturnType<typeof buildPlan>, name: string): string =>
  plans[0].files.find((planned) => planned.path.endsWith(name) || planned.path === name)?.content ?? '';

const EXTERNAL_SCHEMA_FIXTURE = `import { pgTable, text } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
});
`;

const BARREL_FIXTURE = `import { schema as AuthSchema } from './auth/db.js';

// All drizzle schemas
export { AuthSchema };
`;

const APP_MODULE_FIXTURE = `import { Module } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';

@Module({
  imports: [
    DrizzleModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const connection: string = config.get('DATABASE_URL');
        return { drizzle, connection };
      },
    }),
  ],
})
export class AppModule {}
`;

const withTempRepo = async (run: (root: string) => Promise<void> | void): Promise<void> => {
  const root = mkdtempSync(join(tmpdir(), 'gen-'));
  mkdirSync(join(root, 'src', 'auth', 'db'), { recursive: true });
  writeFileSync(join(root, 'src/auth/db/auth.schema.ts'), EXTERNAL_SCHEMA_FIXTURE);
  writeFileSync(join(root, 'src/db-schema.ts'), BARREL_FIXTURE);
  writeFileSync(join(root, 'src/app.module.ts'), APP_MODULE_FIXTURE);
  try {
    await run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

describe('names', () => {
  it('maps camelCase fields to snake_case columns', () => {
    expect(toSnakeCase('authorId')).toBe('author_id');
    expect(toSnakeCase('email')).toBe('email');
  });

  it('maps kebab names to camelCase identifiers', () => {
    expect(toCamelCase('email-tokens')).toBe('emailTokens');
  });
});

describe('plan', () => {
  const plans = buildPlan([posts], [posts, comments], settings);

  it('plans the fourteen files of the slice', () => {
    expect(plans[0].files.map((file) => file.path)).toEqual([
      'src/modules/posts/post.ts',
      'src/modules/posts/dto/create-post.dto.ts',
      'src/modules/posts/dto/update-post.dto.ts',
      'src/modules/posts/dto/list-post.query.ts',
      'src/modules/posts/db.ts',
      'src/modules/posts/db/index.ts',
      'src/modules/posts/db/posts.schema.ts',
      'src/modules/posts/db/posts.relations.ts',
      'src/modules/posts/repositories/posts.repository.ts',
      'src/modules/posts/repositories/posts.repository.spec.ts',
      'src/modules/posts/services/posts.service.ts',
      'src/modules/posts/controllers/posts.controller.ts',
      'src/modules/posts/posts.module.ts',
      'src/modules/posts/services/posts.service.spec.ts',
    ]);
  });

  it('writes the entity interface with its relations', () => {
    const content = file(plans, 'src/modules/posts/post.ts');
    expect(content).toContain('export interface Post {');
    expect(content).toContain('body: string | null;');
    expect(content).toContain("status: 'draft' | 'published';");
    expect(content).toContain('createdAt: Date | null;');
    expect(content).toContain('updatedAt: Date | null;');
    expect(content).toContain('deletedAt: Date | null;');
    expect(content).toContain('author?: User | null;');
    expect(content).toContain('comments?: Comment[];');
    expect(content).toContain("import type { User } from '../../auth/types/user.js';");
    expect(content).toContain("import type { Comment } from '../comments/comment.js';");
    expect(content).toContain('export interface PostPage {');
  });

  it('writes one schema file per DTO', () => {
    const create = file(plans, 'src/modules/posts/dto/create-post.dto.ts');
    expect(create).toContain('export const createPostSchema = z.object({');
    expect(create).toContain('title: z.string().min(1),');
    expect(create).toContain('body: z.string().min(1).nullish(),');
    expect(create).toContain("status: z.enum(['draft', 'published']).optional(),");
    expect(create).toContain('views: z.number().int().optional(),');
    expect(create).toContain('export type CreatePostDto = z.infer<typeof createPostSchema>;');
    expect(create).not.toContain('updatePostSchema');

    const update = file(plans, 'src/modules/posts/dto/update-post.dto.ts');
    expect(update).toContain('export const updatePostSchema = z.object({');
    expect(update).toContain('title: z.string().min(1).optional(),');
    expect(update).toContain('export type UpdatePostDto = z.infer<typeof updatePostSchema>;');
    expect(update).not.toContain('createPostSchema');

    // The list query: pagination, sort whitelist, per-field operators, search and include.
    const list = file(plans, 'src/modules/posts/dto/list-post.query.ts');
    expect(list).toContain('export const listPostQuerySchema = z.object({');
    expect(list).toContain('page: z.coerce.number().int().min(1).default(1),');
    expect(list).toContain('limit: z.coerce.number().int().min(1).max(100).default(20),');
    expect(list).toContain("sort: z.enum(['createdAt', 'updatedAt', 'title', 'body', 'status', 'authorId', 'views']).default('createdAt'),");
    expect(list).toContain("order: z.enum(['asc', 'desc']).default('desc'),");
    expect(list).toContain("'title.contains': z.string().optional(),");
    expect(list).toContain("'status.ne': z.enum(['draft', 'published']).optional(),");
    expect(list).toContain("'views.gte': z.coerce.number().int().optional(),");
    expect(list).toContain('search: z.string().optional(),');
    expect(list).toContain('export const parseIncludes =');
    expect(list).toContain('export type ListPostQueryDto = z.infer<typeof listPostQuerySchema>;');
  });

  it('writes the db entry points mirroring the auth module', () => {
    expect(file(plans, 'src/modules/posts/db.ts')).toContain("export * from './db/index.js';");
    const index = file(plans, 'src/modules/posts/db/index.ts');
    expect(index).toContain("export * from './posts.schema.js';");
    expect(index).not.toContain(' as ');
    expect(index).not.toContain('relations');
  });

  it('writes the table file with the shared timestamps spread', () => {
    const content = file(plans, 'src/modules/posts/db/posts.schema.ts');
    expect(content).toContain("import { pgTable, text, integer } from 'drizzle-orm/pg-core';");
    expect(content).toContain("import { timestamps } from '../../../database/fields.js';");
    expect(content).toContain("export const posts = pgTable('posts', {");
    expect(content).toContain("id: text('id').primaryKey(),");
    expect(content).toContain("authorId: text('author_id')");
    expect(content).toContain('.references(() => users.id),');
    expect(content).toContain("status: text('status', { enum: ['draft', 'published'] })");
    expect(content).toContain(".default('draft'),");
    expect(content).toContain('...timestamps,');
    expect(content).not.toContain('createdAt: at(');
    expect(content).toContain("from '../../../auth/db/auth.schema.js';");
  });

  it('writes the relations part with defineRelationsPart', () => {
    const content = file(plans, 'src/modules/posts/db/posts.relations.ts');
    expect(content).toContain("import { defineRelationsPart } from 'drizzle-orm';");
    expect(content).toContain("import { posts } from './posts.schema.js';");
    expect(content).toContain("from '../../comments/db/comments.schema.js';");
    expect(content).toContain("from '../../../auth/db/auth.schema.js';");
    expect(content).toContain('export const postsRelations = defineRelationsPart({ posts, comments, users }, (r) => ({');
    expect(content).toContain('author: r.one.users({ from: r.posts.authorId, to: r.users.id }),');
    expect(content).toContain('comments: r.many.comments({ from: r.posts.id, to: r.comments.postId }),');
  });

  it('writes the repository with the SQL-like builder and manual includes', () => {
    const content = file(plans, 'src/modules/posts/repositories/posts.repository.ts');
    expect(content).toContain('constructor(@InjectDrizzle() private readonly db: NodePgDatabase)');
    expect(content).toContain("import { posts } from '../db/posts.schema.js';");
    expect(content).toContain("import { users } from '../../../auth/db/auth.schema.js';");
    expect(content).toContain("import { comments } from '../../comments/db/comments.schema.js';");
    expect(content).toContain('async create(data: CreatePostDto): Promise<Post> {');
    expect(content).toContain('.select()');
    expect(content).toContain('.from(posts)');
    expect(content).toContain(".orderBy(query.order === 'asc' ? asc(posts[query.sort]) : desc(posts[query.sort]))");
    expect(content).toContain('this.db.$count(');
    expect(content).toContain("conditions.push(ilike(posts.title, `%${query['title.contains']}%`));");
    expect(content).toContain('conditions.push(gte(posts.views, query[\'views.gte\']));');
    expect(content).toContain('values({ id: randomUUID(), ...data }).returning()');
    expect(content).toContain("from '../dto/create-post.dto.js';");
    expect(content).not.toContain('db.query');
    expect(content).toContain('private async withIncludes(');
    expect(content).toContain("if (include?.has('author')) {");
    expect(content).toContain('.where(inArray(users.id, ids));');
    expect(content).toContain("if (include?.has('comments')) {");
    expect(content).toContain('.where(inArray(comments.postId, ids));');
    expect(content).toContain('row.author = byId.get(row.authorId) ?? null;');
    expect(content).toContain('row.comments = byParentId.get(row.id) ?? [];');
  });

  it('writes a repository spec with a mocked database', () => {
    const content = file(plans, 'src/modules/posts/repositories/posts.repository.spec.ts');
    expect(content).toContain("describe('PostsRepository', () => {");
    expect(content).toContain('new PostsRepository(db as unknown as NodePgDatabase);');
    expect(content).toContain('loads requested relations for a single');
    expect(content).toContain('loads requested relations for a page');
  });

  it('writes the controller with the validated list query', () => {
    const content = file(plans, 'src/modules/posts/controllers/posts.controller.ts');
    expect(content).toContain("@Controller('posts')");
    expect(content).toContain('@Query({ schema: listPostQuerySchema })');
    expect(content).toContain("@Get(':id')");
    expect(content).toContain('parseIncludes(include)');
    expect(content).toContain("@Delete(':id')");
    expect(content).toContain('@HttpCode(204)');
    expect(content).toContain("from '../services/posts.service.js';");
    expect(content).toContain("from '../dto/list-post.query.js';");
  });

  it('writes the service, module and spec', () => {
    expect(file(plans, 'src/modules/posts/services/posts.service.ts')).toContain('throw new NotFoundException(`Post with id ${id} was not found`);');
    expect(file(plans, 'src/modules/posts/services/posts.service.ts')).toContain("from '../repositories/posts.repository.js';");
    expect(file(plans, 'src/modules/posts/posts.module.ts')).toContain('controllers: [PostsController],');
    expect(file(plans, 'src/modules/posts/posts.module.ts')).toContain("from './controllers/posts.controller.js';");
    expect(file(plans, 'src/modules/posts/services/posts.service.spec.ts')).toContain("describe('PostsService', () => {");
    expect(file(plans, 'src/modules/posts/services/posts.service.spec.ts')).toContain("from '../dto/create-post.dto.js';");
  });

  it('uses the core query builder when no relation is declared', () => {
    const plain: EntityDefinition = { name: 'labels', fields: [{ name: 'name', type: 'text' }] };
    const [plan] = buildPlan([plain]);
    expect(plan.files.map((file) => file.path)).not.toContain('src/modules/labels/db/labels.relations.ts');
    expect(plan.files.map((file) => file.path)).toContain('src/modules/labels/db/labels.schema.ts');
    expect(plan.files.map((file) => file.path)).toContain('src/modules/labels/repositories/labels.repository.spec.ts');
    const repo = plan.files.find((file) => file.path === 'src/modules/labels/repositories/labels.repository.ts')?.content ?? '';
    expect(repo).toContain('this.db.select().from(labels)');
    expect(repo).toContain('private readonly db: NodePgDatabase');
    expect(repo).toContain("from 'drizzle-orm/node-postgres';");
    expect(repo).not.toContain('db.query');
    expect(repo).not.toContain('withIncludes');
    const table = plan.files.find((file) => file.path === 'src/modules/labels/db/labels.schema.ts')?.content ?? '';
    expect(table).not.toContain('database/schema.js');
    expect(table).toContain('...timestamps,');
  });
});

describe('apply', () => {
  it('creates every file once and wires the barrel and app module idempotently', async () => {
    await withTempRepo(async (root) => {
      const entities2 = [posts, comments];
      const plans = buildPlan(entities2, entities2, settings);
      const first = await applyPlan(plans, { force: false, entities: entities2, root, settings });
      expect(first.changes).toHaveLength(28);
      expect(first.changes.every((change) => change.action === 'created')).toBe(true);
      expect(first.warnings).toEqual([]);
      expect(first.edited).toEqual([join(root, 'src/db-schema.ts'), join(root, 'src/app.module.ts')]);

      const barrel = readFileSync(join(root, 'src/db-schema.ts'), 'utf8');
      expect(barrel).toContain("import { schema as AuthSchema } from './auth/db.js';");
      expect(barrel).toContain("export * from './modules/posts/db.js';");
      expect(barrel).toContain("export * from './modules/comments/db.js';");
      expect(barrel).not.toContain('PostsSchema');

      const appModule = readFileSync(join(root, 'src/app.module.ts'), 'utf8');
      expect(appModule).toContain("import { PostsModule } from './modules/posts/posts.module.js';");
      expect(appModule).toContain("import { CommentsModule } from './modules/comments/comments.module.js';");
      expect(appModule).toContain('PostsModule,');

      const second = await applyPlan(buildPlan(entities2, entities2, settings), { force: false, entities: entities2, root, settings });
      expect(second.changes.every((change) => change.action === 'skipped')).toBe(true);
      expect(second.edited).toEqual([]);

      const forced = await applyPlan(buildPlan(entities2, entities2, settings), { force: true, entities: entities2, root, settings });
      expect(forced.changes.every((change) => change.action === 'created')).toBe(true);
      expect(forced.edited).toEqual([]);
    });
  });

  it('warns about relations pointing at unknown tables', async () => {
    await withTempRepo(async (root) => {
      const orphan: EntityDefinition = {
        name: 'orphans',
        fields: [{ name: 'ghostId', type: 'text', references: 'ghosts.id' }],
      };
      const result = await applyPlan(buildPlan([orphan], [orphan], settings), { force: false, entities: [orphan], root, settings });
      expect(result.warnings).toContain('orphans.ghostId references unknown table "ghosts"');
    });
  });

  it('prunes barrel and app module entries of removed entities', async () => {
    await withTempRepo(async (root) => {
      const entities2 = [posts, comments];
      await applyPlan(buildPlan(entities2, entities2, settings), { force: false, entities: entities2, root, settings });

      const reduced = await applyPlan(buildPlan([posts], entities2, settings), { force: false, entities: [posts], root, settings });
      expect(reduced.warnings).toContain('Unregistered comments from src/db-schema.ts: no longer defined.');
      expect(reduced.warnings).toContain('Unregistered comments from AppModule: no longer defined.');

      const barrel = readFileSync(join(root, 'src/db-schema.ts'), 'utf8');
      expect(barrel).not.toContain('comments/db.js');
      expect(barrel).toContain("export * from './modules/posts/db.js';");
      const appModule = readFileSync(join(root, 'src/app.module.ts'), 'utf8');
      expect(appModule).not.toContain('CommentsModule');
      expect(appModule).toContain('PostsModule');
    });
  });

  it('prunes hand-placed export-star entries of removed entities', async () => {
    await withTempRepo(async (root) => {
      const entities2 = [posts, comments];
      await applyPlan(buildPlan(entities2, entities2, settings), { force: false, entities: entities2, root, settings });
      const barrelPath = join(root, 'src/db-schema.ts');
      writeFileSync(barrelPath, `${readFileSync(barrelPath, 'utf8')}export * from './modules/comments/db.js';\n`, 'utf8');

      const reduced = await applyPlan(buildPlan([posts], entities2, settings), { force: false, entities: [posts], root, settings });
      expect(reduced.warnings).toContain('Unregistered comments from src/db-schema.ts: no longer defined.');
      expect(readFileSync(barrelPath, 'utf8')).not.toContain("export * from './modules/comments/db.js';");
    });
  });
});

describe('appendEntity', () => {
  it('renders a definition in entities.ts syntax', () => {
    const text = entityDefinitionText(comments);
    expect(text).toContain("name: 'comments',");
    expect(text).toContain("references: 'posts.id'");
    expect(text).toContain('{ name: \'post\', type: \'one\', field: \'postId\', references: \'posts.id\' },');
    expect(text).not.toContain('timestamps: false');
  });
});
