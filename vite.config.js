import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { minifyHtml, injectHtml } from 'vite-plugin-html';
import { viteExternalsPlugin } from 'vite-plugin-externals';
import path from 'path';
import crypto from 'node:crypto';

const isProd = process.env.NODE_ENV === 'production';

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
          tag: 'script',
          attrs: {
            src: '/OIerDb.js',
          },
        },
        {
          injectTo: 'head',
          tag: 'script',
          attrs: {
            src: '//oier-data.baoshuo.dev/static.js',
          },
        },
        {
          injectTo: 'head',
          tag: 'script',
          attrs: {
            src: '//oier-data.baoshuo.dev/result.sha512.js',
          },
        },
        {
          injectTo: 'head',
          tag: 'link',
          attrs: {
            rel: 'stylesheet',
            href: '//cdnjs.baoshuo.ren/ajax/libs/semantic-ui/2.4.1/semantic.min.css',
          },
        },
        {
          injectTo: 'head',
          tag: 'script',
          attrs: {
            defer: true,
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
                  src: '//cdnjs.baoshuo.ren/ajax/libs/react/17.0.2/umd/react.production.min.js',
                },
              },
              {
                injectTo: 'head',
                tag: 'script',
                attrs: {
                  src: '//cdnjs.baoshuo.ren/ajax/libs/react-dom/17.0.2/umd/react-dom.production.min.js',
                },
              },
              {
                injectTo: 'head',
                tag: 'script',
                attrs: {
                  src: '//cdnjs.baoshuo.ren/ajax/libs/react-router-dom/6.2.1/react-router-dom.production.min.js',
                },
              },
              {
                injectTo: 'head',
                tag: 'script',
                attrs: {
                  src: '//cdnjs.baoshuo.ren/ajax/libs/Chart.js/3.7.0/chart.min.js',
                },
              },
              {
                injectTo: 'head',
                tag: 'script',
                attrs: {
                  src: '',
                },
              },
            ]
          : [
              {
                injectTo: 'head-prepend',
                tag: 'meta',
                attrs: {
                  name: 'referrer',
                  content: 'no-referrer',
                },
              },
            ]),
      ],
    }),
    minifyHtml(),
    viteExternalsPlugin(
      {
        react: 'React',
        'react-dom': 'ReactDOM',
        'react-router-dom': 'ReactRouterDOM',
        'chart.js': 'Chart',
      },
      { disableInServe: true }
    ),
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
