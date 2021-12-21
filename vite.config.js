import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { minifyHtml } from 'vite-plugin-html';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react(), minifyHtml()],
    build: {
        sourcemap: true,
    },
    resolve: {
        alias: {
            '@': path.join(__dirname, './src'),
        },
    },
});
