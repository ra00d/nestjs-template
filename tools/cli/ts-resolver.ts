import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * Extensions tried when a config file imports a relative path without one,
 * e.g. `import config from './tools/gen.config'`.
 */
const EXTENSIONS = [
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
];

/** Project aliases from `tsconfig.json`, resolved from the working directory. */
const ALIASES = [
  { prefix: '@/', directory: 'src' },
  { prefix: 'modules/', directory: 'src/modules' },
];

const resolveFile = (base: string): string | undefined => {
  for (const extension of EXTENSIONS) {
    const candidate = `${base}${extension}`;
    if (existsSync(candidate)) return candidate;
  }
  for (const extension of EXTENSIONS) {
    const candidate = resolve(base, `index${extension}`);
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
};

let registered = false;

/**
 * Node's TypeScript support strips types but keeps ESM resolution rules, so
 * `import './foo'` does not find `foo.ts`. Config files loaded by the CLI
 * (`cli.config.ts`) and the seeder modules it runs may use extensionless
 * imports and the project's `@/` / `modules/` aliases; register a resolver
 * that adds the extension and maps those aliases.
 */
export const registerTsResolver = (): void => {
  if (registered) return;
  registered = true;

  registerHooks({
    resolve(specifier, context, nextResolve) {
      for (const alias of ALIASES) {
        if (!specifier.startsWith(alias.prefix)) continue;
        const base = resolve(
          process.cwd(),
          alias.directory,
          specifier.slice(alias.prefix.length),
        );
        const candidate = resolveFile(base);
        if (candidate) {
          return { url: pathToFileURL(candidate).href, shortCircuit: true };
        }
      }

      const isRelative =
        specifier.startsWith('./') ||
        specifier.startsWith('../') ||
        isAbsolute(specifier);
      const hasKnownExtension = EXTENSIONS.some((extension) =>
        specifier.endsWith(extension),
      );
      if (!isRelative || hasKnownExtension) {
        return nextResolve(specifier, context);
      }

      const parent = context.parentURL;
      if (!parent?.startsWith('file:')) {
        return nextResolve(specifier, context);
      }

      const base = resolve(dirname(fileURLToPath(parent)), specifier);
      const candidate = resolveFile(base);
      if (candidate) {
        return { url: pathToFileURL(candidate).href, shortCircuit: true };
      }

      return nextResolve(specifier, context);
    },
  });
};
