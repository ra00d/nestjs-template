import * as p from '@clack/prompts';

/**
 * Cancel the current TUI flow and exit the process.
 */
export const cancel = (): never => {
  p.cancel('Aborted.');
  return process.exit(0);
};