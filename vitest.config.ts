import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'

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
            'scripts/docs/__tests__/**/*.test.ts',
            'scripts/docs/__tests__/**/*.spec.ts',
            'scripts/checks/__tests__/showcase-metadata/**/*.test.ts',
            'scripts/checks/__tests__/showcase-metadata/**/*.spec.ts',
            'examples/showcase-shared/src/__tests__/**/*.spec.ts',
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

            // Showcase page / route unit tests (requires build:examples deps).
            'examples/react-showcase/src/**/*.test.ts',
            'examples/react-showcase/src/**/*.spec.ts',
            'examples/react-showcase/src/**/*.test.tsx',
            'examples/react-showcase/src/**/*.spec.tsx',
            'examples/vue-showcase/src/**/*.test.ts',
            'examples/vue-showcase/src/**/*.spec.ts',
            'examples/vue-showcase/src/**/*.test.tsx',
            'examples/vue-showcase/src/**/*.spec.tsx',
          ],
          exclude: [
            ...configDefaults.exclude,
            '**/e2e/**',
            // Only run this test against an installed Zeus canary.
            canaryCapabilitiesTest,
          ],
        },
        plugins: [vue()],
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
            // React wrapper sub-paths for showcase tests (must come before base @zeus-web/* aliases).
            ...[
              '@zeus-web/alert',
              '@zeus-web/badge',
              '@zeus-web/button',
              '@zeus-web/checkbox',
              '@zeus-web/dialog',
              '@zeus-web/input',
              '@zeus-web/progress',
              '@zeus-web/select',
              '@zeus-web/switch',
              '@zeus-web/accordion',
              '@zeus-web/collapsible',
              '@zeus-web/tooltip',
              '@zeus-web/card',
              '@zeus-web/avatar',
              '@zeus-web/skeleton',
              '@zeus-web/separator',
              '@zeus-web/label',
              '@zeus-web/radio-group',
              '@zeus-web/tabs',
              '@zeus-web/textarea',
            ].flatMap(pkg => ({
              find: new RegExp(`^${pkg}/react$`),
              replacement: resolve(
                process.cwd(),
                `packages/primitives/${pkg.replace('@zeus-web/', '')}/dist/react/index.js`,
              ),
            })),
            // Icons and themes are in packages/* (not packages/primitives/*).
            {
              find: /^@zeus-web\/icons\/react$/,
              replacement: resolve(
                process.cwd(),
                'packages/icons/dist/react/index.js',
              ),
            },
            {
              find: /^@zeus-web\/themes\/react$/,
              replacement: resolve(
                process.cwd(),
                'packages/themes/dist/react/index.js',
              ),
            },
            // Vue wrapper sub-paths for showcase tests.
            ...[
              '@zeus-web/alert',
              '@zeus-web/badge',
              '@zeus-web/button',
              '@zeus-web/checkbox',
              '@zeus-web/dialog',
              '@zeus-web/input',
              '@zeus-web/progress',
              '@zeus-web/select',
              '@zeus-web/switch',
              '@zeus-web/accordion',
              '@zeus-web/collapsible',
              '@zeus-web/tooltip',
              '@zeus-web/card',
              '@zeus-web/avatar',
              '@zeus-web/skeleton',
              '@zeus-web/separator',
              '@zeus-web/label',
              '@zeus-web/radio-group',
              '@zeus-web/tabs',
              '@zeus-web/textarea',
            ].flatMap(pkg => ({
              find: new RegExp(`^${pkg}/vue$`),
              replacement: resolve(
                process.cwd(),
                `packages/primitives/${pkg.replace('@zeus-web/', '')}/dist/vue/index.js`,
              ),
            })),
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

      {
        extends: true,
        test: {
          name: 'showcase-e2e',
          environment: 'node',
          include: ['examples/showcase-e2e/*.spec.ts'],
          globalSetup: ['examples/showcase-e2e/setup.ts'],
          testTimeout: 30_000,
          hookTimeout: 120_000,
          pool: 'forks',
        },
      },
    ],
  },
})
