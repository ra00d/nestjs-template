import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import {
  Node,
  Project,
  SyntaxKind,
  VariableDeclarationKind,
  type ObjectLiteralExpression,
  type SourceFile,
} from 'ts-morph';
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
        warnings.push(
          `${context.names.name}.${field.name} references unknown table "${targetTable}"`,
        );
      }
    }
    for (const relation of context.relations) {
      const target =
        relation.type === 'one'
          ? relation.references.split('.')[0]
          : relation.target;
      if (!known.has(toCamelCase(target))) {
        warnings.push(
          `${context.names.name} relation "${relation.name}" points at unknown table "${target}"`,
        );
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
    return {
      warnings: [
        'AppModule has no @Module decorator; register generated modules manually.',
      ],
      changed,
    };
  }
  const importsArray = moduleDecorator
    .getArguments()[0]
    ?.asKind(SyntaxKind.ObjectLiteralExpression)
    ?.getProperty('imports')
    ?.asKind(SyntaxKind.PropertyAssignment)
    ?.getInitializerIfKind(SyntaxKind.ArrayLiteralExpression);
  if (!importsArray) {
    return {
      warnings: [
        'AppModule has no imports array; register generated modules manually.',
      ],
      changed,
    };
  }

  for (const context of contexts) {
    const { plural, name } = context.names;
    const className = `${plural}Module`;
    const from = importPath(
      appModulePath,
      join(root, context.moduleDir, `${name}.module.ts`),
    );
    const declaration = appFile.getImportDeclaration((item) =>
      item
        .getNamedImports()
        .some((specifier) => specifier.getName() === className),
    );
    if (
      importsArray
        .getElements()
        .some((element) => element.getText() === className)
    ) {
      // Already registered: only fix the specifier when the module moved.
      if (declaration && declaration.getModuleSpecifierValue() !== from) {
        declaration.setModuleSpecifier(from);
        changed = true;
      }
      continue;
    }
    if (!declaration) {
      appFile.addImportDeclaration({
        moduleSpecifier: from,
        namedImports: [className],
      });
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
  const expectedClasses = new Set(
    contexts.map((context) => `${context.names.plural}Module`),
  );
  for (const declaration of appFile.getImportDeclarations()) {
    const specifier = declaration.getModuleSpecifierValue();
    if (!specifier.startsWith('.')) continue;
    const resolved = posix.normalize(posix.join(appDir, specifier));
    if (!resolved.startsWith(`${settings.modulesDir}/`)) continue;
    const stale = declaration
      .getNamedImports()
      .filter((item) => !expectedClasses.has(item.getName()));
    if (stale.length === 0) continue;
    const staleNames = new Set(stale.map((item) => item.getName()));
    for (const item of stale) item.remove();
    if (declaration.getNamedImports().length === 0) declaration.remove();
    const elements = importsArray.getElements();
    for (let index = elements.length - 1; index >= 0; index -= 1) {
      if (staleNames.has(elements[index].getText()))
        importsArray.removeElement(index);
    }
    const dir = resolved.split('/').at(-2) ?? 'unknown';
    warnings.push(`Unregistered ${dir} from AppModule: no longer defined.`);
    changed = true;
  }

  appFile.saveSync();
  return { warnings, changed };
};

/** Path of the schema/relations barrel aggregating every module's `db/` folder, relative to the repo root. */
export const SCHEMA_BARREL = 'src/db.ts';

/** Resolves a barrel import to a repo-relative path (`modules/x` or `./x`). */
const resolveSpecifier = (barrelDir: string, specifier: string): string =>
  specifier.startsWith('modules/')
    ? posix.normalize(
        posix.join('src/modules', specifier.slice('modules/'.length)),
      )
    : posix.normalize(posix.join(barrelDir, specifier));

/** Module directory (`src/modules/posts`) a resolved barrel entry belongs to. */
const moduleDirOf = (settings: ResolvedConfig, resolved: string): string =>
  `${settings.modulesDir}/${posix.relative(settings.modulesDir, resolved).split('/')[0]}`;

/**
 * Import specifier used by the barrel. Modules use the `modules/*` alias so
 * generated entries match the hand-written ones; everything else stays
 * relative.
 */
const barrelSpecifier = (
  settings: ResolvedConfig,
  barrelPath: string,
  root: string,
  target: string,
): string => {
  const withoutExtension = target.replace(/\.tsx?$/, '');
  const relative = posix.relative(root, withoutExtension);
  const prefix = `${settings.modulesDir}/`;
  if (settings.modulesDir === 'src/modules' && relative.startsWith(prefix)) {
    return `modules/${relative.slice(prefix.length)}`;
  }
  return importPath(barrelPath, target);
};

const ensureNamespaceImport = (
  file: SourceFile,
  name: string,
  moduleSpecifier: string,
): void => {
  const existing = file.getImportDeclaration(
    (declaration) => declaration.getNamespaceImport()?.getText() === name,
  );
  if (existing) return;
  file.addImportDeclaration({ namespaceImport: name, moduleSpecifier });
};

const ensureObject = (
  file: SourceFile,
  name: string,
): ObjectLiteralExpression => {
  const declaration = file.getVariableDeclaration(name);
  if (!declaration) {
    const statement = file.addVariableStatement({
      isExported: true,
      declarationKind: VariableDeclarationKind.Const,
      declarations: [{ name, initializer: '{}' }],
    });
    return statement
      .getDeclarationList()
      .getDeclarations()[0]
      .getInitializerIfKindOrThrow(SyntaxKind.ObjectLiteralExpression);
  }
  const initializer = declaration.getInitializerIfKind(
    SyntaxKind.ObjectLiteralExpression,
  );
  if (initializer) return initializer;
  declaration.setInitializer('{}');
  return declaration.getInitializerIfKindOrThrow(
    SyntaxKind.ObjectLiteralExpression,
  );
};

const ensureSpread = (
  objectLiteral: ObjectLiteralExpression,
  expression: string,
): void => {
  const exists = objectLiteral
    .getProperties()
    .some(
      (property) =>
        Node.isSpreadAssignment(property) &&
        property.getExpression().getText() === expression,
    );
  if (!exists) objectLiteral.addSpreadAssignment({ expression });
};

const hasExportFrom = (
  file: SourceFile,
  barrelDir: string,
  moduleSpecifier: string,
): boolean => {
  const target = resolveSpecifier(barrelDir, moduleSpecifier);
  return file.getExportDeclarations().some((declaration) => {
    if (!declaration.isNamespaceExport()) return false;
    const specifier = declaration.getModuleSpecifierValue();
    return specifier
      ? resolveSpecifier(barrelDir, specifier) === target
      : false;
  });
};

/**
 * Keeps `src/db.ts` in sync with `entities.ts`:
 *
 * - namespace imports (`import * as postsSchema from 'modules/posts/db'`)
 *   and spreads in the exported `schema` object;
 * - relation namespace imports and spreads in `relations`;
 * - flat `export *` re-exports so drizzle-kit still sees every table.
 *
 * Hand-written entries (auth, audit, abac) are left untouched. Entries of
 * modules that left `entities.ts` (or stopped declaring relations) are pruned.
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
    mkdirSync(posix.dirname(barrelPath), { recursive: true });
    writeFileSync(
      barrelPath,
      '// All drizzle schemas and relations\n\nexport const schema = {};\n\nexport const relations = {};\n',
      'utf8',
    );
  }
  const barrelFile = project.addSourceFileAtPath(barrelPath);
  const before = barrelFile.getFullText();
  const contexts = createContexts(entities, settings);
  const label = posix.relative(root, barrelPath);
  const barrelDir = posix.dirname(label);
  const schemaObject = ensureObject(barrelFile, 'schema');
  const relationsObject = ensureObject(barrelFile, 'relations');
  const expectedImports = new Set<string>();
  const expectedModuleDirs = new Set(
    contexts.map((context) => context.moduleDir),
  );

  for (const context of contexts) {
    const { moduleDir, names } = context;
    const base = toCamelCase(names.name);
    const schemaName = `${base}Schema`;
    const schemaFrom = barrelSpecifier(
      settings,
      barrelPath,
      root,
      join(root, moduleDir, 'db.ts'),
    );
    expectedImports.add(schemaName);
    ensureNamespaceImport(barrelFile, schemaName, schemaFrom);
    ensureSpread(schemaObject, schemaName);
    if (!hasExportFrom(barrelFile, barrelDir, schemaFrom)) {
      barrelFile.addExportDeclaration({ moduleSpecifier: schemaFrom });
    }

    if (context.relations.length === 0) continue;
    const relationsName = `${base}Relations`;
    const relationsFrom = barrelSpecifier(
      settings,
      barrelPath,
      root,
      join(root, moduleDir, 'db', `${names.name}.relations.ts`),
    );
    expectedImports.add(relationsName);
    ensureNamespaceImport(barrelFile, relationsName, relationsFrom);
    // The relation file exports the part itself (`postsRelations`), so spread
    // its value to keep the object keyed by table name, as Drizzle expects.
    ensureSpread(relationsObject, `${relationsName}.${relationsName}`);
  }

  const staleImports = new Set<string>();
  const staleModules = new Set<string>();
  for (const declaration of barrelFile.getImportDeclarations()) {
    const namespaceImport = declaration.getNamespaceImport();
    if (!namespaceImport) continue;
    const name = namespaceImport.getText();
    if (expectedImports.has(name)) continue;
    const specifier = declaration.getModuleSpecifierValue();
    const resolved = resolveSpecifier(barrelDir, specifier);
    if (!resolved.startsWith(`${settings.modulesDir}/`)) continue;
    staleImports.add(name);
    const moduleDir = moduleDirOf(settings, resolved);
    if (!expectedModuleDirs.has(moduleDir)) {
      staleModules.add(moduleDir.split('/').at(-1) ?? 'unknown');
    }
    declaration.remove();
  }
  for (const declaration of barrelFile.getExportDeclarations()) {
    if (!declaration.isNamespaceExport()) continue;
    const specifier = declaration.getModuleSpecifierValue();
    if (!specifier) continue;
    const resolved = resolveSpecifier(barrelDir, specifier);
    if (!resolved.startsWith(`${settings.modulesDir}/`)) continue;
    const moduleDir = moduleDirOf(settings, resolved);
    if (expectedModuleDirs.has(moduleDir)) continue;
    declaration.remove();
    staleModules.add(moduleDir.split('/').at(-1) ?? 'unknown');
  }
  for (const objectLiteral of [schemaObject, relationsObject]) {
    for (const property of objectLiteral.getProperties()) {
      if (!Node.isSpreadAssignment(property)) continue;
      const rootName = property.getExpression().getText().split('.')[0];
      if (staleImports.has(rootName)) property.remove();
    }
  }

  for (const moduleName of staleModules) {
    warnings.push(
      `Unregistered ${moduleName} from ${label}: no longer defined.`,
    );
  }

  const changed = barrelFile.getFullText() !== before;
  if (changed) barrelFile.saveSync();
  return { warnings, changed };
};
