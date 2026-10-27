import { Scope } from 'ts-morph';
import type { EntityContext } from './context';
import { importPath } from './paths';
import { buildFile } from './project';

/** `controllers/posts.controller.ts`: REST CRUD with the validated list query. */
export const buildControllerFile = (
  context: EntityContext,
): { path: string; content: string } => {
  const { names, relations, entity, moduleDir } = context;
  const path = `${moduleDir}/controllers/${names.name}.controller.ts`;
  const route = names.route;

  const content = buildFile(path, (file) => {
    // `Post` is both the route decorator and the entity name: the decorator is
    // imported under an alias when the entity is called `Post`.
    const postImport =
      names.entity === 'Post' ? 'Post as PostDecorator' : 'Post';
    const postDecorator = names.entity === 'Post' ? 'PostDecorator' : 'Post';
    const commonImports = [
      'Body',
      'Controller',
      'Delete',
      'Get',
      'HttpCode',
      'Param',
      'Patch',
      postImport,
      'Query',
    ];
    file.addImportDeclaration({
      moduleSpecifier: '@nestjs/common',
      namedImports: commonImports,
    });
    if (entity.public) {
      file.addImportDeclaration({
        moduleSpecifier: '@nestjs/authentication',
        namedImports: ['Public'],
      });
    }
    file.addImportDeclaration({
      moduleSpecifier: importPath(path, `${moduleDir}/${names.base}.ts`),
      namedImports: [names.entity, `${names.entity}Page`],
      isTypeOnly: true,
    });
    file.addImportDeclaration({
      moduleSpecifier: importPath(path, `${moduleDir}/dto/create-${names.base}.dto.ts`),
      namedImports: [
        `type Create${names.entity}Dto`,
        `create${names.entity}Schema`,
      ],
    });
    file.addImportDeclaration({
      moduleSpecifier: importPath(path, `${moduleDir}/dto/update-${names.base}.dto.ts`),
      namedImports: [
        `type Update${names.entity}Dto`,
        `update${names.entity}Schema`,
      ],
    });
    file.addImportDeclaration({
      moduleSpecifier: importPath(path, `${moduleDir}/dto/list-${names.base}.query.ts`),
      namedImports: [
        `type List${names.entity}QueryDto`,
        `list${names.entity}QuerySchema`,
        ...(relations.length > 0 ? ['parseIncludes'] : []),
      ],
    });
    file.addImportDeclaration({
      moduleSpecifier: importPath(path, `${moduleDir}/services/${names.name}.service.ts`),
      namedImports: [`${names.plural}Service`],
    });

    file.addClass({
      name: `${names.plural}Controller`,
      isExported: true,
      decorators: [
        ...(entity.public ? [{ name: 'Public', arguments: [] }] : []),
        { name: 'Controller', arguments: [`'${route}'`] },
      ],
      ctors: [
        {
          parameters: [
            {
              name: `${names.base}Service`,
              type: `${names.plural}Service`,
              scope: Scope.Private,
              isReadonly: true,
            },
          ],
          statements: [],
        },
      ],
      methods: [
        {
          name: 'create',
          decorators: [{ name: postDecorator, arguments: [] }],
          parameters: [
            {
              name: 'body',
              type: `Create${names.entity}Dto`,
              decorators: [
                {
                  name: 'Body',
                  arguments: [`{ schema: create${names.entity}Schema }`],
                },
              ],
            },
          ],
          returnType: `Promise<${names.entity}>`,
          statements: [`return this.${names.base}Service.create(body);`],
        },
        {
          name: 'findAll',
          decorators: [{ name: 'Get', arguments: [] }],
          parameters: [
            {
              name: 'query',
              type: `List${names.entity}QueryDto`,
              decorators: [
                {
                  name: 'Query',
                  arguments: [`{ schema: list${names.entity}QuerySchema }`],
                },
              ],
            },
          ],
          returnType: `Promise<${names.entity}Page>`,
          statements: [`return this.${names.base}Service.findAll(query);`],
        },
        {
          name: 'findOne',
          decorators: [{ name: 'Get', arguments: [`':id'`] }],
          parameters: [
            {
              name: 'id',
              type: 'string',
              decorators: [{ name: 'Param', arguments: [`'id'`] }],
            },
            ...(relations.length > 0
              ? [
                  {
                    name: 'include',
                    type: 'string',
                    hasQuestionToken: true,
                    decorators: [{ name: 'Query', arguments: [`'include'`] }],
                  },
                ]
              : []),
          ],
          returnType: `Promise<${names.entity}>`,
          statements: [
            `return this.${names.base}Service.findOne(${relations.length > 0 ? 'id, parseIncludes(include)' : 'id'});`,
          ],
        },
        {
          name: 'update',
          decorators: [{ name: 'Patch', arguments: [`':id'`] }],
          parameters: [
            {
              name: 'id',
              type: 'string',
              decorators: [{ name: 'Param', arguments: [`'id'`] }],
            },
            {
              name: 'body',
              type: `Update${names.entity}Dto`,
              decorators: [
                {
                  name: 'Body',
                  arguments: [`{ schema: update${names.entity}Schema }`],
                },
              ],
            },
          ],
          returnType: `Promise<${names.entity}>`,
          statements: [`return this.${names.base}Service.update(id, body);`],
        },
        {
          name: 'remove',
          decorators: [
            { name: 'Delete', arguments: [`':id'`] },
            { name: 'HttpCode', arguments: ['204'] },
          ],
          parameters: [
            {
              name: 'id',
              type: 'string',
              decorators: [{ name: 'Param', arguments: [`'id'`] }],
            },
          ],
          returnType: 'Promise<void>',
          statements: [`return this.${names.base}Service.remove(id);`],
        },
      ],
    });
  });

  return { path, content };
};
