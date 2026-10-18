import { posix } from 'node:path';
import { singularize, toCamelCase, toPascalCase } from './names.ts';
import type { EntityContext } from './context.ts';

/**
 * Repo-relative import path from one source file to another, with the `.ts`
 * source extension stripped like every import in the codebase.
 * Computed instead of hardcoded, so `modulesDir` can sit at any depth.
 */
export const importPath = (fromFile: string, toFile: string): string => {
  const target = toFile.replace(/\.ts(x)?$/, '');
  const relative = posix.relative(posix.dirname(fromFile), target);
  return relative.startsWith('.') ? relative : `./${relative}`;
};

/** Entity type name for a relation target table (without its import). */
export const targetTypeName = (context: EntityContext, rawTable: string): string => {
  const known = context.tables.get(toCamelCase(rawTable));
  return toPascalCase(singularize(known ? known.dir : rawTable));
};

/** Entity type and import specifier for a relation target table. */
export const targetEntityType = (
  context: EntityContext,
  fromFile: string,
  rawTable: string,
): { type: string; from: string } => {
  const known = context.tables.get(toCamelCase(rawTable));
  if (known) {
    const base = singularize(known.dir);
    return {
      type: toPascalCase(base),
      from: importPath(fromFile, `${context.settings.modulesDir}/${known.dir}/${base}.ts`),
    };
  }
  const base = singularize(rawTable);
  const source =
    context.settings.externalTypes[rawTable] ?? posix.normalize(`${context.moduleDir}/../${rawTable}/${base}.ts`);
  return { type: toPascalCase(base), from: importPath(fromFile, source) };
};
