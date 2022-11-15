/* eslint-disable */

import { defineConfig, splitVendorChunkPlugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createHtmlPlugin } from 'vite-plugin-html';
import { viteExternalsPlugin } from 'vite-plugin-externals';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import crypto from 'crypto';

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
  ? '//cdnjs.baoshuo.ren/ajax/libs'
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
    VitePWA({
      workbox: {
        sourcemap: true,
        maximumFileSizeToCacheInBytes: 1024 * 1024 * 1024, // 1024 MiB
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              [
                'sb.cdn.baoshuo.ren',
                'oier.api.baoshuo.ren',
                'oierdb-ng.github.io',
              ].includes(url.host),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'oierdb-data-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30, // <== 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https?:\/\/fonts\.googleapis\.com/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // <== 365 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https?:\/\/fonts\.gstatic\.com/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 365, // <== 365 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: ({ url }) =>
              [
                'cdnjs.baoshuo.ren',
                'cdnjs.rsb.net',
                'cdnjs.loli.net',
                'cdnjs.cloudflare.com',
              ].includes(url.host),
            handler: 'CacheFirst',
            options: {
              cacheName: 'cdnjs-cache',
              expiration: {
                maxEntries: 1000,
                maxAgeSeconds: 60 * 60 * 24 * 365, // <== 365 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https?:\/\/stat\.u\.sb\/.*\.js/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'analytics-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 7, // <== 7 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            handler: 'NetworkOnly',
            urlPattern: /^https?:\/\/stat\.u\.sb\/api\/.*/i,
            method: 'POST',
            options: {
              backgroundSync: {
                name: 'analytics-queue',
                options: {
                  maxRetentionTime: 24 * 60,
                },
              },
            },
          },
        ],
        globPatterns: [
          '**/*.{js,css,png,jpg,jpeg,svg,gif,webp,ico,woff,woff2,ttf,eot,otf,html}',
        ],
      },
      manifest: {
        name: 'OIerDb NG',
        short_name: 'OIerDb',
        description: 'Next Generation OIerDb.',
        theme_color: '#ffffff',
        icons: [
          {
            src: '/logo.png',
            sizes: '220x220',
            type: 'image/png',
          },
        ],
      },
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
