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
          exclude: [
            ...configDefaults.exclude,
            '**/e2e/**',
            // zeus-compat tests need jsdom and use Zeus DOM APIs — skip in Node-only unit pool.
            'packages/zeus-compat/**',
            // Canary-only test — only runs in zeus-canary-compat.yml.
            'packages/zeus-compat/__tests__/canary-capabilities.spec.ts',
          ],
          include: [
            'packages/**/*.test.ts',
            'packages/**/*.spec.ts',
            'packages/**/*.test.tsx',
            'packages/**/*.spec.tsx',
            'scripts/checks/__tests__/**/*.test.ts',
            'scripts/checks/__tests__/**/*.spec.ts',
          ],
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
          ],
          exclude: [
            ...configDefaults.exclude,
            '**/e2e/**',
            'packages/zeus-compat/**',
          ],
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
          exclude: ['packages/zeus-compat/**'],
        },
      },
    ],
  },
})
