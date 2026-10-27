// @ts-check
import { BannerPlugin } from '@rspack/core';
import { defineConfig } from '@rspack/cli';
import nodeExternals from 'webpack-node-externals';

export default defineConfig({
  context: import.meta.dirname,
  target: 'node',
  entry: {
    cli: './tools/cli/index.ts',
  },
  output: {
    clean: true,
    path: './bin',
    filename: 'cli.js',
    // The package is `"type": "module"`, so the bundle has to be ESM.
    module: true,
    chunkFormat: 'module',
  },
  resolve: {
    extensions: ['...', '.ts', '.tsx', '.jsx'],
  },
  module: {
    parser: {
      javascript: {
        // Runtime config files are imported by absolute path; leave
        // `import()` alone so Node resolves them (and their TypeScript).
        importDynamic: false,
      },
    },
    rules: [
      {
        test: /\.(?:js|mjs|ts)$/,
        exclude: [/node_modules/],
        loader: 'builtin:swc-loader',
        options: {
          detectSyntax: 'auto',
        },
      },
      {
        test: /\.node$/,
        type: 'asset/resource',
      },
    ],
  },
  externals: [
    // Keep packages external: this produces one file for the CLI code while
    // dependencies continue to resolve from node_modules at runtime.
    nodeExternals({ importType: 'module' }),
  ],
  plugins: [
    new BannerPlugin({
      banner: '#!/usr/bin/env node',
      raw: true,
    }),
  ],
});
