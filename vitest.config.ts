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
            'packages/*/*.{test,spec}.*',
            'packages/*/__tests__/**/*.{test,spec}.*',
            'packages/primitives/*/*.{test,spec}.*',
            'packages/primitives/*/__tests__/**/*.{test,spec}.*',
            'scripts/checks/__tests__/**/*.{test,spec}.*',
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
