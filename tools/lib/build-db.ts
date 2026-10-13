import type { EntityContext } from './context.ts';
import { buildFile } from './project.ts';

/**
 * `<module>/db.ts`: the module's database entry point, mirroring the auth
 * module (`src/auth/db.ts`). Re-exported namespaces are aggregated in
 * `src/db-schema.ts`.
 */
export const buildDbFile = (context: EntityContext): { path: string; content: string } => ({
  path: `${context.moduleDir}/db.ts`,
  content: `export * from './db/index.js';\n`,
});

/**
 * `<module>/db/index.ts`: re-exports the module's tables with plain
 * re-exports (no aliases) so they stay visible to drizzle-kit through
 * `src/db-schema.ts`. Relations parts live in `db/<module>.relations.ts`
 * for later composition and stay out of the index.
 */
export const buildDbIndexFile = (context: EntityContext): { path: string; content: string } => {
  const { names, moduleDir } = context;
  const path = `${moduleDir}/db/index.ts`;
  const content = buildFile(path, (file) => {
    file.addStatements([`export * from './${names.name}.schema.js';`]);
  });
  return { path, content };
};
