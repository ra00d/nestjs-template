#!/usr/bin/env node
import * as p from '@clack/prompts';
import { createGenCommand } from './cli/commands/gen.ts';

// Backwards-compatible entry point for `pnpm gen`.
const program = createGenCommand();

program.parseAsync(process.argv).catch((error) => {
  if (error instanceof Error) {
    p.log.error(error.message);
  }
  process.exit(1);
});
