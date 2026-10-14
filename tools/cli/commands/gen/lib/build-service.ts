import { Scope } from 'ts-morph';
import type { EntityContext } from './context.ts';
import { importPath } from './paths.ts';
import { buildFile } from './project.ts';

/** `services/posts.service.ts`: thin domain layer over the repository. */
export const buildServiceFile = (context: EntityContext): { path: string; content: string } => {
  const { names, relations, moduleDir } = context;
  const path = `${moduleDir}/services/${names.name}.service.ts`;
  const notFound = `throw new NotFoundException(\`${names.entity} with id \${id} was not found\`);`;

  const content = buildFile(path, (file) => {
    file.addImportDeclaration({ moduleSpecifier: '@nestjs/common', namedImports: ['Injectable', 'NotFoundException'] });
    file.addImportDeclaration({ moduleSpecifier: importPath(path, `${moduleDir}/${names.base}.ts`), namedImports: [names.entity, `${names.entity}Page`], isTypeOnly: true });
    file.addImportDeclaration({
      moduleSpecifier: importPath(path, `${moduleDir}/dto/create-${names.base}.dto.ts`),
      namedImports: [`Create${names.entity}Dto`],
      isTypeOnly: true,
    });
    file.addImportDeclaration({
      moduleSpecifier: importPath(path, `${moduleDir}/dto/update-${names.base}.dto.ts`),
      namedImports: [`Update${names.entity}Dto`],
      isTypeOnly: true,
    });
    file.addImportDeclaration({
      moduleSpecifier: importPath(path, `${moduleDir}/dto/list-${names.base}.query.ts`),
      namedImports: [`List${names.entity}QueryDto`],
      isTypeOnly: true,
    });
    file.addImportDeclaration({ moduleSpecifier: importPath(path, `${moduleDir}/repositories/${names.name}.repository.ts`), namedImports: [`${names.plural}Repository`] });
    file.addClass({
      name: `${names.plural}Service`,
      isExported: true,
      decorators: [{ name: 'Injectable', arguments: [] }],
      ctors: [
        {
          parameters: [
            {
              name: `${names.base}Repository`,
              type: `${names.plural}Repository`,
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
          parameters: [{ name: 'data', type: `Create${names.entity}Dto` }],
          returnType: `Promise<${names.entity}>`,
          statements: [`return this.${names.base}Repository.create(data);`],
        },
        {
          name: 'findAll',
          isAsync: true,
          parameters: [{ name: 'query', type: `List${names.entity}QueryDto` }],
          returnType: `Promise<${names.entity}Page>`,
          statements: [
            `const { data, total } = await this.${names.base}Repository.findAll(query);`,
            'return {',
            '  data,',
            '  meta: {',
            '    page: query.page,',
            '    limit: query.limit,',
            '    total,',
            '    totalPages: Math.ceil(total / query.limit),',
            '  },',
            '};',
          ],
        },
        {
          name: 'findOne',
          isAsync: true,
          parameters: [
            { name: 'id', type: 'string' },
            ...(relations.length > 0 ? [{ name: 'include', type: 'Set<string>', hasQuestionToken: true }] : []),
          ],
          returnType: `Promise<${names.entity}>`,
          statements: [
            `const ${names.base} = await this.${names.base}Repository.findById(${
              relations.length > 0 ? 'id, include' : 'id'
            });`,
            `if (!${names.base}) {`,
            notFound,
            '}',
            `return ${names.base};`,
          ],
        },
        {
          name: 'update',
          isAsync: true,
          parameters: [
            { name: 'id', type: 'string' },
            { name: 'data', type: `Update${names.entity}Dto` }],
          returnType: `Promise<${names.entity}>`,
          statements: [
            `const updated = await this.${names.base}Repository.update(id, data);`,
            'if (!updated) {',
            notFound,
            '}',
            'return updated;',
          ],
        },
        {
          name: 'remove',
          parameters: [{ name: 'id', type: 'string' }],
          returnType: 'Promise<void>',
          statements: [`return this.${names.base}Repository.remove(id);`],
        },
      ],
    });
  });

  return { path, content };
};
