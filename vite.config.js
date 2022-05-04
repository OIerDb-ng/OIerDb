import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { minifyHtml, injectHtml } from 'vite-plugin-html';
import path from 'path';
import crypto from 'node:crypto';

const buildHash =
  /* Netlify */ process.env.COMMIT_REF ||
  /* CI */ process.env.BUILD_SHA ||
  /* GitHub Actions */ process.env.GITHUB_SHA ||
  /* Local */ crypto
    .createHash('sha256')
    .update(new Date().toISOString())
    .digest('hex');

const data = {
  appVersion: buildHash,
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), minifyHtml(), injectHtml({ data })],
  build: {
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@': path.join(__dirname, './src'),
    },
  },
});
