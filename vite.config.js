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
