import { reactRouter } from '@react-router/dev/vite';
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import tsconfigPaths from 'vite-tsconfig-paths';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const buildHash =
  process.env.COMMIT_REF ||
  process.env.BUILD_SHA ||
  process.env.GITHUB_SHA ||
  crypto.createHash('sha256').update(new Date().toISOString()).digest('hex');

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(buildHash),
  },
  plugins: [
    reactRouter(),
    tsconfigPaths(),
    vanillaExtractPlugin(),
    VitePWA({
      srcDir: 'app',
      filename: 'sw.ts',
      strategies: 'injectManifest',
      injectRegister: false,
      manifest: false,
      injectManifest: {
        injectionPoint: undefined,
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@oierdb/adapter-http': path.resolve(__dirname, '../../packages/adapter-http/index.ts'),
      '@oierdb/adapter-idb': path.resolve(__dirname, '../../packages/adapter-idb/index.ts'),
      '@oierdb/adapter-memory': path.resolve(__dirname, '../../packages/adapter-memory/index.ts'),
      '@oierdb/core': path.resolve(__dirname, '../../packages/core/index.ts'),
      '@oierdb/parser': path.resolve(__dirname, '../../packages/parser/index.ts'),
    },
  },
});
