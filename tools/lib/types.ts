/**
 * The central schema definition the generator reads from. One entry per
 * module: `node tools/gen.ts` (or `pnpm gen`) turns each entity into a full
 * NestJS slice (repository, service, controller, module, Zod schemas, spec),
 * a Drizzle table with relations, and an `app.module.ts` registration.
 *
 * This file is never compiled into the application: `tsconfig.build.json`
 * only includes `src`, and `nest build` never sees `tools/`.
 */

/** Field storage types, mapped to Drizzle columns, Zod schemas and TS types. */
export type FieldType = 'text' | 'uuid' | 'integer' | 'boolean' | 'timestamp' | 'enum' | 'jsonb';

export interface FieldDefinition {
  /** Property name, camelCase. Becomes a snake_case column (`authorId` -> `author_id`). */
  name: string;
  type: FieldType;
  /** Default `true`. `false` makes the column nullable and the DTO field nullish. */
  required?: boolean;
  unique?: boolean;
  /** Default value for the column, inserted on every row that omits the field. */
  default?: string | number | boolean;
  /** Required for `type: 'enum'`. */
  values?: string[];
  /** Foreign key target, `'<table>.<column>'`, e.g. `'users.id'`. Emits `.references()`. */
  references?: string;
  /** Explicit column name. Defaults to the snake_case form of `name`. */
  column?: string;
  /** Default `true`. Adds equality/operator filters to the list query. */
  filterable?: boolean;
  /** Default `true`. Allows `?sort=<name>` on the list query. */
  sortable?: boolean;
  /** Default `false`. Included in the list query's `?search=` ilike match. */
  searchable?: boolean;
}

/** The entity holding the foreign key, e.g. `posts.authorId -> users`. */
export interface OneRelationDefinition {
  name: string;
  type: 'one';
  /** Field on this entity holding the foreign key. */
  field: string;
  /** `'<table>.<column>'`, e.g. `'users.id'`. */
  references: string;
}

/** The inverse side, e.g. `users` having many `posts`. */
export interface ManyRelationDefinition {
  name: string;
  type: 'many';
  /** Table being pointed at, e.g. `comments`. */
  target: string;
  /** Foreign key column on the target table pointing back here, e.g. `postId`. */
  foreignKey: string;
  /** Local column the foreign key points at. Default `'id'`. */
  localKey?: string;
}

export type RelationDefinition = OneRelationDefinition | ManyRelationDefinition;

export interface EntityDefinition {
  /** Kebab or camelCase plural, e.g. `posts` or `email-tokens`. Drives file/class names. */
  name: string;
  /** REST base path. Defaults to the kebab-case entity name. */
  route?: string;
  fields: FieldDefinition[];
  relations?: RelationDefinition[];
  /** Default `true`. Adds `createdAt`/`updatedAt` columns and a default `createdAt desc` sort. */
  timestamps?: boolean;
  /** Default `false`. `true` marks every generated route `@Public()`. */
  public?: boolean;
}

/** Identity helper that gives `entities.ts` a typed, autocompleted shape. */
export const defineEntity = (definition: EntityDefinition): EntityDefinition => definition;
