import type { EntityDefinition } from './types';

/** `authorId` -> `author_id`, `createdAt` -> `created_at`. */
export const toSnakeCase = (value: string): string =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();

/** `createdAt` -> `created-at`, `emailTokens` -> `email-tokens`. */
export const toKebabCase = (value: string): string =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();

/** `email-tokens` -> `EmailTokens`. */
export const toPascalCase = (value: string): string =>
  value
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

/** `email-tokens` -> `emailTokens` (valid TS identifier, used for table names). */
export const toCamelCase = (value: string): string => {
  const pascal = toPascalCase(value);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
};

export const singularize = (value: string): string => (value.endsWith('s') ? value.slice(0, -1) : value);

export interface EntityNames {
  /** Entity name as given, kebab-cased: `posts`, `email-tokens`. */
  name: string;
  /** Directory and route base: `src/email-tokens/`, `/email-tokens`. */
  dir: string;
  /** Singular kebab-case base of per-entity files: `post.ts`, `email-token.schemas.ts`. */
  base: string;
  /** Entity interface/type name: `Post`, `EmailToken`. */
  entity: string;
  /** Class name prefix for service/repository/controller/module: `Posts`, `EmailTokens`. */
  plural: string;
  route: string;
}

export const entityNames = (entity: EntityDefinition): EntityNames => {
  const name = toKebabCase(entity.name);
  return {
    name,
    dir: name,
    base: singularize(name),
    entity: toPascalCase(singularize(name)),
    plural: toPascalCase(name),
    route: toKebabCase(entity.route ?? name),
  };
};
