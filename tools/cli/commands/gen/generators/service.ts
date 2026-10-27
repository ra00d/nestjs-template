import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getConfig } from '../../../config';

const pascalCase = (value: string): string =>
  value
    .split(/[-_ ]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

export function generateService(
  name: string,
  path: string = '',
): string {
  const base = name.split('/').pop() ?? name;
  const rootDir = getConfig().rootDir;
  const dir = join(rootDir, path, name);

  const file = join(dir, `${base}.service.ts`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    file,
    `import { Injectable } from '@nestjs/common';

@Injectable()
export class ${pascalCase(base)}Service {}
`,
    'utf8',
  );
  return file;
}

