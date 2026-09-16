import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

import { readFileSync } from 'node:fs';
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@sdk': r('./src/sdk'),
      '@app': r('./src/app'),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': { target: process.env.MAGICDASH_API ?? 'http://localhost:3210', changeOrigin: false },
    },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
