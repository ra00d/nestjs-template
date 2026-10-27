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

let registered = false;

/**
 * Node's TypeScript support strips types but keeps ESM resolution rules, so
 * `import './foo'` does not find `foo.ts`. Config files loaded by the CLI
 * (`cli.config.ts`, `drizzle.config.ts`) may use extensionless imports like
 * the rest of the project; register a resolver that adds the extension.
 */
export const registerTsResolver = (): void => {
  if (registered) return;
  registered = true;

  registerHooks({
    resolve(specifier, context, nextResolve) {
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
      for (const extension of EXTENSIONS) {
        const candidate = `${base}${extension}`;
        if (existsSync(candidate)) {
          return { url: pathToFileURL(candidate).href, shortCircuit: true };
        }
      }
      for (const extension of EXTENSIONS) {
        const candidate = resolve(base, `index${extension}`);
        if (existsSync(candidate)) {
          return { url: pathToFileURL(candidate).href, shortCircuit: true };
        }
      }

      return nextResolve(specifier, context);
    },
  });
};
