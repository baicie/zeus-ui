import { resolve } from 'node:path'

import { configDefaults, defineConfig } from 'vitest/config'

import { entries } from './scripts/config/aliases'

const canaryCapabilitiesTest =
  'packages/zeus-compat/__tests__/canary-capabilities.spec.ts'

// Zeus package default node entry is CJS-like but published as ESM.
// Use the browser ESM bundle in jsdom so runtime-dom stays inlined.
const zeusEsmPath = resolve(
  process.cwd(),
  'node_modules/@zeus-js/zeus/dist/zeus.esm-browser.js',
)

// ESM bundler imports @zeus-js/runtime-dom which also has a CJS index.js.
// Alias it to its ESM bundle so transitive deps resolve correctly in jsdom.
const runtimeDomEsmPath = resolve(
  process.cwd(),
  'node_modules/@zeus-js/runtime-dom/dist/runtime-dom.esm-bundler.js',
)

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
            // Only run this test against an installed Zeus canary.
            canaryCapabilitiesTest,
          ],
        },
        resolve: {
          conditions: ['import', 'module', 'browser', 'default'],
          alias: [
            // More specific patterns first.
            {
              find: /^@zeus-js\/zeus$/,
              replacement: zeusEsmPath,
            },
            {
              find: /^@zeus-js\/runtime-dom$/,
              replacement: runtimeDomEsmPath,
            },
            // Then workspace aliases required by local packages.
            ...Object.entries(entries).map(([find, replacement]) => ({
              find,
              replacement,
            })),
          ],
        },
        ssr: {
          noExternal: ['@zeus-js/zeus', '@zeus-js/runtime-dom'],
          resolve: {
            externalConditions: ['import', 'module', 'browser', 'default'],
          },
        },
        server: {
          deps: {
            inline: ['@zeus-js/zeus', '@zeus-js/runtime-dom'],
          },
        },
      },

      {
        extends: true,
        test: {
          name: 'canary',
          environment: 'jsdom',
          include: [canaryCapabilitiesTest],
        },
        resolve: {
          conditions: ['import', 'module', 'browser', 'default'],
          alias: [
            {
              find: /^@zeus-js\/zeus$/,
              replacement: zeusEsmPath,
            },
            {
              find: /^@zeus-js\/runtime-dom$/,
              replacement: runtimeDomEsmPath,
            },
            ...Object.entries(entries).map(([find, replacement]) => ({
              find,
              replacement,
            })),
          ],
        },
        ssr: {
          noExternal: ['@zeus-js/zeus', '@zeus-js/runtime-dom'],
          resolve: {
            externalConditions: ['import', 'module', 'browser', 'default'],
          },
        },
        server: {
          deps: {
            inline: ['@zeus-js/zeus', '@zeus-js/runtime-dom'],
          },
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
            'examples/*/__tests__/e2e/*.spec.ts',
          ],
          exclude: ['packages/zeus-compat/**'],
        },
      },
    ],
  },
})
