import defineConfig from '@antfu/eslint-config'
import stylistic from '@stylistic/eslint-plugin'

const DOMGlobals = ['window', 'document']
const NodeGlobals = ['module', 'require']

const banConstEnum = {
  selector: 'TSEnumDeclaration[const=true]',
  message:
    'Please use non-const enums. This project automatically inlines enums.',
}

export default defineConfig(
  {
    rules: {
      'no-debugger': 'error',
      'no-console': ['error', { allow: ['warn', 'error', 'info'] }],
      'no-restricted-globals': ['error', ...DOMGlobals, ...NodeGlobals],

      'no-restricted-syntax': ['error', banConstEnum],
      'style/operator-linebreak': 'off',
      'antfu/if-newline': 'off',
    },
  },

  // shared, may be used in any env
  {
    files: ['packages/shared/**', 'eslint.config.js'],
    rules: {
      'no-restricted-globals': 'off',
    },
  },

  // Node scripts
  {
    files: [
      'rollup*.config.js',
      'scripts/**',
      './*.{js,ts}',
      'packages/*/*.js',
    ],
    rules: {
      'no-restricted-globals': 'off',
      'no-restricted-syntax': ['error', banConstEnum],
      'no-console': 'off',
      'node/prefer-global/process': 'off',
      'style/arrow-parens': 'off',
      'style/brace-style': 'off',
      'style/operator-linebreak': 'off',
      'antfu/if-newline': 'off',
      'jsonc/sort-keys': 'off',
    },
  },

  {
    files: ['pnpm-workspace.yaml'],
    rules: {
      'pnpm/yaml-enforce-settings': 'off',
    },
  },

  // CLI package - CLI tools need console and process
  {
    files: ['packages/cli/**'],
    rules: {
      'no-console': 'off',
      'node/prefer-global/process': 'off',
    },
  },

  // Web Component packages - need DOM globals
  {
    files: ['packages/primitives/**'],
    rules: {
      'no-restricted-globals': 'off',
    },
  },

  // Let ESLint format TypeScript files via @stylistic instead of Prettier
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      style: stylistic,
    },
    rules: {
      'prettier/prettier': 'off',
      // Extra rules not covered by antfu's defaults
      '@/comma-dangle': ['error', 'always-multiline'],
      '@/func-call-spacing': ['error', 'never'],
      '@/key-spacing': ['error', { beforeColon: false, afterColon: true }],
      '@/keyword-spacing': 'error',
      '@/object-curly-spacing': ['error', 'always'],
      '@/space-infix-ops': 'error',
      'jsonc/sort-keys': 'off',
      'style/operator-linebreak': 'off',
      'style/arrow-parens': ['error', 'as-needed'],
      'antfu/if-newline': 'off',
      'style/brace-style': ['error', '1tbs', { allowSingleLine: true }],
      'perfectionist/sort-named-exports': 'off',
      // Disable in favour of Prettier's formatting.
      'style/member-delimiter-style': 'off',
    },
  },

  {
    ignores: [
      '**/dist/',
      '**/temp/',
      '**/coverage/',
      '**/node_modules/',
      '.idea/',
      'explorations/',
      'dts-build/packages',
      'playground',
      '**/*.md',
      '**/.vitepress/cache/',
      '**/.vitepress/dist/',
      'packages/napi',
    ],
  },
)
