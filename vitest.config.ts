import { configDefaults, defineConfig } from 'vitest/config'

import { entries } from './scripts/config/aliases'

const canaryCapabilitiesTest =
  'packages/zeus-compat/__tests__/canary-capabilities.spec.ts'

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
          include: [
            'packages/**/*.test.ts',
            'packages/**/*.spec.ts',
            'packages/**/*.test.tsx',
            'packages/**/*.spec.tsx',
            'scripts/checks/__tests__/**/*.test.ts',
            'scripts/checks/__tests__/**/*.spec.ts',
          ],
          exclude: [
            ...configDefaults.exclude,
            '**/e2e/**',
            // zeus-compat imports DOM runtime APIs and runs in jsdom.
            'packages/zeus-compat/**',
          ],
        },
      },

      {
        extends: true,
        test: {
          name: 'unit-jsdom',
          environment: 'jsdom',
          include: [
            'packages/**/*.test.ts',
            'packages/**/*.spec.ts',
            'packages/**/*.test.tsx',
            'packages/**/*.spec.tsx',
          ],
          exclude: [
            ...configDefaults.exclude,
            '**/e2e/**',
            // @zeus-js/zeus/capabilities is only available from real Zeus packages.
            'packages/zeus-compat/__tests__/contract.spec.ts',
            // Only run against an installed Zeus canary.
            canaryCapabilitiesTest,
          ],
        },
      },

      {
        extends: true,
        test: {
          name: 'canary',
          environment: 'jsdom',
          include: [canaryCapabilitiesTest],
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
