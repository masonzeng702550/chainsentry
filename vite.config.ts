import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { crx } from '@crxjs/vite-plugin';
import { resolve } from 'node:path';
import manifest from './manifest.config';

export default defineConfig({
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  plugins: [preact(), crx({ manifest })],
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        analysis: resolve(__dirname, 'src/analysis/index.html'),
      },
    },
  },
  server: { port: 5173, strictPort: true },
});
