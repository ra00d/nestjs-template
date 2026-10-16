import { spawn } from 'node:child_process';

/**
 * Run the seeding entry point through a package script
 * (`db:seed` → `nest start --entryFile seed`), inheriting stdio so its log
 * streams.
 */
export const runSeed = async (script: string): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    const child = spawn('pnpm', [script], {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('error', (error) => {
      reject(new Error(`Could not run "pnpm ${script}": ${error.message}`));
    });
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          signal
            ? `"${script}" was killed by ${signal}.`
            : `"${script}" exited with code ${code}.`,
        ),
      );
    });
  });
};
