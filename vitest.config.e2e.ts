import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/nestjs_template',
      JWT_SECRET: 'e2e-test-secret-at-least-32-characters-long',
    },
  },
});
