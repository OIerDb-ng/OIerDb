import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { minifyHtml, injectHtml } from 'vite-plugin-html';
import { viteExternalsPlugin } from 'vite-plugin-externals';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import crypto from 'crypto';

const isProd = process.env.NODE_ENV === 'production';
const isNetlify = process.env.NETLIFY;

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
  plugins: [
    react(),
    injectHtml({
      data,
      tags: [
        {
          injectTo: 'head',
          tag: 'link',
          attrs: {
            rel: 'stylesheet',
            href: '//cdnjs.baoshuo.ren/ajax/libs/semantic-ui/2.4.1/semantic.min.css',
          },
        },
        {
          injectTo: 'body',
          tag: 'script',
          attrs: {
            async: true,
            'data-domain': 'oier.baoshuo.dev',
            src: '//stat.u.sb/js/script.js',
          },
        },
        ...(isProd
          ? [
              {
                injectTo: 'head',
                tag: 'script',
                attrs: {
                  defer: true,
                  src: '//cdnjs.baoshuo.ren/ajax/libs/react/18.1.0/umd/react.production.min.js',
                },
              },
              {
                injectTo: 'head',
                tag: 'script',
                attrs: {
                  defer: true,
                  src: '//cdnjs.baoshuo.ren/ajax/libs/react-dom/18.1.0/umd/react-dom.production.min.js',
                },
              },
            ]
          : []),
        ...(isNetlify || !isProd
          ? [
              {
                injectTo: 'head-prepend',
                tag: 'meta',
                attrs: {
                  name: 'referrer',
                  content: 'no-referrer',
                },
              },
            ]
          : []),
      ],
    }),
    minifyHtml(),
    viteExternalsPlugin(
      {
        react: 'React',
        'react-dom': 'ReactDOM',
      },
      { disableInServe: true }
    ),
    VitePWA({
      workbox: {
        sourcemap: true,
        maximumFileSizeToCacheInBytes: 104857600, // 100 MiB
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/oier-data\.baoshuo\.dev\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'oierdb-data-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // <== 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https?:\/\/fonts\.googleapis\.com\/.*/i,
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
            urlPattern: /^https?:\/\/fonts\.gstatic\.com\/.*/i,
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
            urlPattern: /^https?:\/\/cdnjs\.baoshuo\.ren\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cdnjs-cache',
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
});
