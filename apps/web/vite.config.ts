import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const apiTarget = process.env['API_TARGET'] ?? 'http://127.0.0.1:8787';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@famlink/domain': fileURLToPath(new URL('../../packages/domain/src/index.ts', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // The browser only ever talks to the web origin; /api is proxied to the API service.
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
    },
    allowedHosts: true,
  },
  preview: { host: '0.0.0.0', port: 5173, allowedHosts: true },
});
