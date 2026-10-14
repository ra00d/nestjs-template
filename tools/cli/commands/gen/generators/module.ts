import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getConfig } from '../../../config.ts';

const pascalCase = (value: string): string =>
  value
    .split(/[-_ ]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

export function generateModule(
  name: string,
  path: string = '',
): string {
  const base = name.split('/').pop() ?? name;
  const rootDir = getConfig().rootDir;
  const dir = join(rootDir, path, name);

  const file = join(dir, `${base}.module.ts`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    file,
    `import { Module } from '@nestjs/common';

@Module({})
export class ${pascalCase(base)}Module {}
`,
    'utf8',
  );
  return file;
}

