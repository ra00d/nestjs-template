import { configDefaults, defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    // Compiled specs under dist/ must never run: `nest build` copies *.spec.ts
    // through, and a stale copy would shadow the sources they were built from.
    exclude: [...configDefaults.exclude, 'dist/**'],
  },
});
