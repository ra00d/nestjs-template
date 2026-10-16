import { Command } from 'commander';
import { createDbCommand } from './commands/db.ts';
import { createGenCommand } from './commands/gen.ts';

/**
 * Multi-command CLI entry point. Register additional commands here.
 */
const program = new Command();

program
  .name('cli')
  .description('Developer CLI for this NestJS template.')
  .version('0.0.1');

program.addCommand(createGenCommand());
program.addCommand(createDbCommand());

program.parseAsync(process.argv).catch((error) => {
  if (error instanceof Error) {
    console.error(error.message);
  }
  process.exit(1);
});
