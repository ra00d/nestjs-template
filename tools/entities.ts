import { defineEntity } from './lib/types.ts';

/**
 * Every module the generator scaffolds. Add an entity here (or run
 * `pnpm gen add` for the interactive wizard) and run
 * `pnpm gen <name>` to emit its full NestJS slice. Running `pnpm gen`
 * with no arguments emits every defined entity.
 */
export const entities = [
  defineEntity({
    // A blog post: filters, pagination, `?search=`, an owner (users) and a
    // list of comments, all loaded opt-in through `?include=author,comments`.
    name: 'posts',
    fields: [
      { name: 'title', type: 'text', searchable: true },
      { name: 'body', type: 'text', required: false, searchable: true },
      {
        name: 'status',
        type: 'enum',
        values: ['draft', 'published'],
        default: 'draft',
        searchable: true,
      },
      { name: 'authorId', type: 'text', references: 'users.id' },
      { name: 'views', type: 'integer', default: 0 },
    ],
    relations: [
      {
        name: 'author',
        type: 'one',
        field: 'authorId',
        references: 'users.id',
      },
      {
        name: 'comments',
        type: 'many',
        target: 'comments',
        foreignKey: 'postId',
      },
    ],
    timestamps: true,
  }),
  defineEntity({
    name: 'comments',
    fields: [
      { name: 'postId', type: 'text', references: 'posts.id' },
      { name: 'body', type: 'text', searchable: true },
      { name: 'authorId', type: 'text', references: 'users.id' },
    ],
    relations: [
      { name: 'post', type: 'one', field: 'postId', references: 'posts.id' },
      {
        name: 'author',
        type: 'one',
        field: 'authorId',
        references: 'users.id',
      },
    ],
    timestamps: true,
  }),
];
