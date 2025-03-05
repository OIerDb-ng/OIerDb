/* eslint-disable */

import react from '@vitejs/plugin-react';
import crypto from 'crypto';
import path from 'path';
import { defineConfig, splitVendorChunkPlugin } from 'vite';
import { viteExternalsPlugin } from 'vite-plugin-externals';
import { createHtmlPlugin } from 'vite-plugin-html';

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

const cdnjsBaseUrl = process.env.VITE_BAOSHUO_CDNJS
  ? '//cdnjs.baoshuo.xyz/ajax/libs'
  : '//cdnjs.cloudflare.com/ajax/libs';

const externalPackageList = {
  react: {
    globalVariableName: 'React',
    devScript: 'umd/react.development.js',
    prodScript: 'umd/react.production.min.js',
  },
  'react-dom': {
    globalVariableName: 'ReactDOM',
    devScript: 'umd/react-dom.development.js',
    prodScript: 'umd/react-dom.production.min.js',
  },
  history: {
    globalVariableName: 'HistoryLibrary',
    devScript: 'history.development.js',
    prodScript: 'history.production.min.js',
  },
  'react-router': {
    globalVariableName: 'ReactRouter',
    devScript: 'react-router.development.js',
    prodScript: 'react-router.production.min.js',
  },
  'react-router-dom': {
    globalVariableName: 'ReactRouterDOM',
    devScript: 'react-router-dom.development.js',
    prodScript: 'react-router-dom.production.min.js',
  },
  'react-is': {
    globalVariableName: 'ReactIs',
    devScript: 'umd/react-is.development.js',
    prodScript: 'umd/react-is.production.min.js',
  },
};
const externalStylesheetList = {
  'semantic-ui': {
    file: 'semantic.min.css',
    version: '2.4.1',
  },
};

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  esbuild: {
    keepNames: true,
  },
  plugins: [
    splitVendorChunkPlugin(),
    react(),
    createHtmlPlugin({
      minify: true,
      entry: '/src/main.tsx',
      inject: {
        data,
        tags: [
          ...Object.entries(externalStylesheetList).map(
            ([name, { file, version }]) => ({
              injectTo: 'head',
              tag: 'link',
              attrs: {
                rel: 'stylesheet',
                href:
                  cdnjsBaseUrl +
                  '/' +
                  name +
                  '/' +
                  (version ?? require(`${name}/package.json`).version) +
                  '/' +
                  file,
              },
            })
          ),
          ...Object.entries(externalPackageList).map(
            ([name, { devScript, prodScript }]) => ({
              injectTo: 'head',
              tag: 'script',
              attrs: {
                defer: true,
                src:
                  cdnjsBaseUrl +
                  '/' +
                  name +
                  '/' +
                  require(`${name}/package.json`).version +
                  '/' +
                  (command === 'build' ? prodScript ?? devScript : devScript),
              },
            })
          ),
        ],
      },
    }),
    viteExternalsPlugin({
      ...Object.fromEntries(
        Object.entries(externalPackageList).map(
          ([name, { globalVariableName }]) => [name, globalVariableName]
        )
      ),
    }),
  ],
  build: {
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@': path.join(__dirname, './src'),
    },
  },
}));
