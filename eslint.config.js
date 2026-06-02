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
    },
  },

  // Let ESLint format TypeScript files via @stylistic instead of Prettier
  // Only add rules antfu doesn't already apply (it uses "style/" prefix)
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
    },
  },

  {
    ignores: [
      '**/dist/',
      '**/temp/',
      '**/coverage/',
      '.idea/',
      'explorations/',
      'dts-build/packages',
      'playground',
      '**/*.md',
    ],
  },
)
