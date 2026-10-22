import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.ts'],
    reporters: ['default'],
  },
  resolve: {
    alias: {
      '@famlink/domain': new URL('./packages/domain/src/index.ts', import.meta.url).pathname,
    },
  },
});
