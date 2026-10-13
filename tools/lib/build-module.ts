import type { EntityContext } from './context.ts';
import { importPath } from './paths.ts';
import { buildFile } from './project.ts';

/** `posts.module.ts`: wires the controller, service and repository together. */
export const buildModuleFile = (context: EntityContext): { path: string; content: string } => {
  const { names, moduleDir } = context;
  const path = `${moduleDir}/${names.name}.module.ts`;

  const content = buildFile(path, (file) => {
    file.addImportDeclaration({ moduleSpecifier: '@nestjs/common', namedImports: ['Module'] });
    file.addImportDeclaration({
      moduleSpecifier: importPath(path, `${moduleDir}/controllers/${names.name}.controller.ts`),
      namedImports: [`${names.plural}Controller`],
    });
    file.addImportDeclaration({
      moduleSpecifier: importPath(path, `${moduleDir}/repositories/${names.name}.repository.ts`),
      namedImports: [`${names.plural}Repository`],
    });
    file.addImportDeclaration({ moduleSpecifier: importPath(path, `${moduleDir}/services/${names.name}.service.ts`), namedImports: [`${names.plural}Service`] });
    file.addClass({
      name: `${names.plural}Module`,
      isExported: true,
      decorators: [
        {
          name: 'Module',
          arguments: [
            `{ controllers: [${names.plural}Controller], providers: [${names.plural}Repository, ${names.plural}Service], exports: [${names.plural}Service, ${names.plural}Repository] }`,
          ],
        },
      ],
    });
  });

  return { path, content };
};
