import { reactRouter } from '@react-router/dev/vite';
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [reactRouter(), tsconfigPaths(), vanillaExtractPlugin()],
  resolve: {
    alias: {
      '@oierdb/adapter-http': path.resolve(__dirname, '../../packages/adapter-http/index.ts'),
      '@oierdb/adapter-idb': path.resolve(__dirname, '../../packages/adapter-idb/index.ts'),
      '@oierdb/core': path.resolve(__dirname, '../../packages/core/index.ts'),
      '@oierdb/parser': path.resolve(__dirname, '../../packages/parser/index.ts'),
    },
  },
});
