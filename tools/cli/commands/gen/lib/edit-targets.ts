import { existsSync, writeFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { Project, SyntaxKind } from 'ts-morph';
import { createContexts } from './context';
import { DEFAULT_CONFIG, type ResolvedConfig } from './config';
import { toCamelCase } from './names';
import { importPath } from './paths';
import type { EntityDefinition } from './types';


export interface SchemaEditResult {
  warnings: string[];
  /** Whether the schema was rewritten. Always false: the central schema is hand-owned. */
  changed: boolean;
}

/**
 * Validates entity references against generated tables and hand-written
 * ones (`externalTables`, e.g. from the external schema file). Module
 * tables live in each module's `db/` folder; the central schema is
 * hand-owned and never rewritten.
 */
export const applySchemaEdits = (
  entities: EntityDefinition[],
  settings: ResolvedConfig = DEFAULT_CONFIG,
  externalTables: string[] = [],
): SchemaEditResult => {
  const warnings: string[] = [];
  const contexts = createContexts(entities, settings);
  const known = new Set([
    ...contexts.map((context) => toCamelCase(context.names.name)),
    ...externalTables.map((table) => toCamelCase(table)),
  ]);
  for (const context of contexts) {
    for (const field of context.fields) {
      if (!field.references) continue;
      const [targetTable] = field.references.split('.');
      if (!known.has(toCamelCase(targetTable))) {
        warnings.push(`${context.names.name}.${field.name} references unknown table "${targetTable}"`);
      }
    }
    for (const relation of context.relations) {
      const target = relation.type === 'one' ? relation.references.split('.')[0] : relation.target;
      if (!known.has(toCamelCase(target))) {
        warnings.push(`${context.names.name} relation "${relation.name}" points at unknown table "${target}"`);
      }
    }
  }
  return { warnings, changed: false };
};
/** Rewrites `src/app.module.ts` to register new modules and the db relations. */
export const applyAppModuleEdits = (
  project: Project,
  appModulePath: string,
  entities: EntityDefinition[],
  settings: ResolvedConfig = DEFAULT_CONFIG,
  root: string = process.cwd(),
): { warnings: string[]; changed: boolean } => {
  const warnings: string[] = [];
  let changed = false;
  const appFile = project.addSourceFileAtPath(appModulePath);
  const contexts = createContexts(entities, settings);

  const moduleDecorator = appFile.getClass('AppModule')?.getDecorator('Module');
  if (!moduleDecorator) {
    return { warnings: ['AppModule has no @Module decorator; register generated modules manually.'], changed };
  }
  const importsArray = moduleDecorator
    .getArguments()[0]
    ?.asKind(SyntaxKind.ObjectLiteralExpression)
    ?.getProperty('imports')
    ?.asKind(SyntaxKind.PropertyAssignment)
    ?.getInitializerIfKind(SyntaxKind.ArrayLiteralExpression);
  if (!importsArray) {
    return { warnings: ['AppModule has no imports array; register generated modules manually.'], changed };
  }

  for (const context of contexts) {
    const { plural, name } = context.names;
    const className = `${plural}Module`;
    const from = importPath(appModulePath, join(root, context.moduleDir, `${name}.module.ts`));
    const declaration = appFile.getImportDeclaration((item) =>
      item.getNamedImports().some((specifier) => specifier.getName() === className),
    );
    if (importsArray.getElements().some((element) => element.getText() === className)) {
      // Already registered: only fix the specifier when the module moved.
      if (declaration && declaration.getModuleSpecifierValue() !== from) {
        declaration.setModuleSpecifier(from);
        changed = true;
      }
      continue;
    }
    if (!declaration) {
      appFile.addImportDeclaration({ moduleSpecifier: from, namedImports: [className] });
    } else if (declaration.getModuleSpecifierValue() !== from) {
      declaration.setModuleSpecifier(from);
    }
    importsArray.addElement(className);
    changed = true;
  }

  // Prune registrations for modules that left `entities.ts`: imports under
  // `modulesDir` that no current entity claims, plus their array elements.
  // (Relation wiring lives in the app's own composition and is untouched.)
  const appDir = posix.dirname(posix.relative(root, appModulePath));
  const expectedClasses = new Set(contexts.map((context) => `${context.names.plural}Module`));
  for (const declaration of appFile.getImportDeclarations()) {
    const specifier = declaration.getModuleSpecifierValue();
    if (!specifier.startsWith('.')) continue;
    const resolved = posix.normalize(posix.join(appDir, specifier));
    if (!resolved.startsWith(`${settings.modulesDir}/`)) continue;
    const stale = declaration.getNamedImports().filter((item) => !expectedClasses.has(item.getName()));
    if (stale.length === 0) continue;
    const staleNames = new Set(stale.map((item) => item.getName()));
    for (const item of stale) item.remove();
    if (declaration.getNamedImports().length === 0) declaration.remove();
    const elements = importsArray.getElements();
    for (let index = elements.length - 1; index >= 0; index -= 1) {
      if (staleNames.has(elements[index].getText())) importsArray.removeElement(index);
    }
    const dir = resolved.split('/').at(-2) ?? 'unknown';
    warnings.push(`Unregistered ${dir} from AppModule: no longer defined.`);
    changed = true;
  }

  appFile.saveSync();
  return { warnings, changed };
};

/** Path of the schema barrel aggregating every module's `db.ts`, relative to the repo root. */
export const SCHEMA_BARREL = 'src/db-schema.ts';

/**
 * Registers the entities' `db.ts` files in `src/db-schema.ts` as plain
 * re-exports (`export * from './modules/roles/db';`), mirroring the
 * existing auth entry. Unlike aliased namespaces, plain re-exports stay
 * visible to drizzle-kit. The file is created with the same shape when
 * absent. Entries of modules that left `entities.ts` are pruned.
 */
export const applySchemaBarrel = (
  project: Project,
  barrelPath: string,
  entities: EntityDefinition[],
  settings: ResolvedConfig = DEFAULT_CONFIG,
  root: string = process.cwd(),
): { warnings: string[]; changed: boolean } => {
  const warnings: string[] = [];
  if (!existsSync(barrelPath)) {
    writeFileSync(barrelPath, '// All drizzle schemas\n\nexport {};\n', 'utf8');
  }
  const barrelFile = project.addSourceFileAtPath(barrelPath);
  const before = barrelFile.getFullText();
  const contexts = createContexts(entities, settings);
  const barrelDir = posix.dirname(posix.relative(root, barrelPath));
  const expected = new Set<string>();

  for (const context of contexts) {
    const { moduleDir } = context;
    const from = importPath(barrelPath, join(root, moduleDir, 'db.ts'));
    expected.add(from);
    const starExported = barrelFile
      .getExportDeclarations()
      .some((item) => item.isNamespaceExport() && item.getModuleSpecifierValue() === from);
    if (!starExported) {
      barrelFile.addExportDeclaration({ moduleSpecifier: from });
    }
    // Migrate the previous aliased form (`import { schema as XSchema }`)
    // to plain re-exports.
    const declaration = barrelFile.getImportDeclaration((item) => item.getModuleSpecifierValue() === from);
    if (declaration) {
      const removed = declaration.getNamedImports().map((item) => item.getName());
      declaration.remove();
      const target = barrelFile.getExportDeclarations().find((item) => !item.getModuleSpecifier());
      if (target) {
        for (const item of target.getNamedExports()) {
          if (removed.includes(item.getName())) item.remove();
        }
      }
    }
  }

  // Prune entries for modules that left `entities.ts`: anything under
  // `modulesDir` that no current entity claims, in either import or
  // `export *` form.
  for (const declaration of barrelFile.getImportDeclarations()) {
    const specifier = declaration.getModuleSpecifierValue();
    if (!specifier.startsWith('.') || !/\/db(\.js)?$/.test(specifier) || expected.has(specifier)) continue;
    const resolved = posix.normalize(posix.join(barrelDir, specifier));
    if (!resolved.startsWith(`${settings.modulesDir}/`)) continue;
    const removed = declaration.getNamedImports().map((item) => item.getText().split(' as ').pop() ?? '');
    declaration.remove();
    const target = barrelFile.getExportDeclarations().find((item) => !item.getModuleSpecifier());
    if (target) {
      for (const item of target.getNamedExports()) {
        if (removed.includes(item.getName())) item.remove();
      }
    }
    warnings.push(`Unregistered ${(resolved.split('/').at(-2) ?? 'unknown')} from src/db-schema.ts: no longer defined.`);
  }
  for (const declaration of barrelFile.getExportDeclarations()) {
    if (!declaration.isNamespaceExport()) continue;
    const specifier = declaration.getModuleSpecifierValue();
    if (!specifier || !specifier.startsWith('.') || expected.has(specifier)) continue;
    const resolved = posix.normalize(posix.join(barrelDir, specifier));
    if (!resolved.startsWith(`${settings.modulesDir}/`)) continue;
    declaration.remove();
    warnings.push(`Unregistered ${(resolved.split('/').at(-2) ?? 'unknown')} from src/db-schema.ts: no longer defined.`);
  }

  const changed = barrelFile.getFullText() !== before;
  if (changed) barrelFile.saveSync();
  return { warnings, changed };
};
