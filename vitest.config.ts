import { configDefaults, defineConfig } from 'vitest/config'
import { entries } from './scripts/config/aliases'

export default defineConfig({
  define: {
    __DEV__: true,
    __TEST__: true,
  },
  resolve: {
    alias: entries,
  },
  test: {
    globals: true,
    pool: 'threads',
    setupFiles: 'scripts/config/setup-vitest.ts',
    sequence: {
      hooks: 'list',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['packages/*/src/**', 'packages/primitives/*/src/**'],
      exclude: [],
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          exclude: [...configDefaults.exclude, '**/e2e/**'],
        },
      },
      {
        extends: true,
        test: {
          name: 'unit-jsdom',
          include: [
            'packages/**/*.test.ts',
            'packages/**/*.spec.ts',
            'packages/**/*.test.tsx',
            'packages/**/*.spec.tsx',
            'packages/**/*.test.js',
            'packages/**/*.spec.js',
            'packages/primitives/**/*.test.ts',
            'packages/primitives/**/*.spec.ts',
            'packages/primitives/**/*.test.tsx',
            'packages/primitives/**/*.spec.tsx',
            'scripts/checks/__tests__/**/*.test.ts',
            'scripts/checks/__tests__/**/*.spec.ts',
          ],
          exclude: [...configDefaults.exclude, '**/e2e/**'],
          environment: 'jsdom',
        },
      },
      {
        extends: true,
        test: {
          name: 'e2e',
          environment: 'jsdom',
          include: [
            'packages/*/__tests__/e2e/*.spec.ts',
            'packages/primitives/*/__tests__/e2e/*.spec.ts',
          ],
        },
      },
    ],
  },
})
