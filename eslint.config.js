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
      'style/arrow-parens': 'off',
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
    files: ['packages/primitives/**', 'packages/registry/templates/**'],
    rules: {
      'no-restricted-globals': 'off',
    },
  },

  // E2E tests and harnesses - run in jsdom, need DOM globals
  {
    files: [
      'e2e/**',
      'packages/ai-react/__tests__/**',
      'packages/ai-vue/__tests__/**',
      'packages/ai-wc/**',
      'examples/ai-showcase/**',
    ],
    rules: {
      'no-restricted-globals': 'off',
    },
  },

  // Browser entry points and jsdom tests for the headless examples, moved
  // here from `zeus`. `src/main.tsx` mounts into `#root` and the
  // `__tests__` files build their DOM by hand, so both reach for `document`
  // for the same reason `examples/ai-showcase/**` above does.
  {
    files: [
      'examples/headless/__tests__/**',
      'examples/headless-demo/src/main.tsx',
      'examples/registry-react/src/main.tsx',
      'examples/use-headless-cli/src/main.tsx',
      'examples/use-headless-react/src/main.tsx',
    ],
    rules: {
      'no-restricted-globals': 'off',
    },
  },

  // Demo buttons that call `alert()` to show the press handler fired. These
  // are training examples, not product surfaces, and the alert is the whole
  // point of the demo.
  {
    files: [
      'examples/use-headless-cli/**',
      'examples/use-headless-react/**',
      'examples/use-headless-vue/**',
    ],
    rules: {
      'no-alert': 'off',
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
      'style/quote-props': 'off',
      'perfectionist/sort-named-exports': 'off',
      // Disable in favour of Prettier's formatting.
      'style/member-delimiter-style': 'off',
      'style/quotes': 'off',
      'style/jsx-curly-newline': 'off',
      'style/jsx-one-expression-per-line': 'off',
      'style/jsx-wrap-multilines': 'off',
      'style/multiline-ternary': 'off',
      'style/indent': 'off',
      'style/indent-binary-ops': 'off',
    },
  },
  // Vue files - disable rules that conflict with Prettier
  {
    files: ['**/*.vue'],
    rules: {
      'style/brace-style': 'off',
      'style/indent-binary-ops': 'off',
      'style/member-delimiter-style': 'off',
      'style/quotes': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/html-indent': 'off',
      'vue/html-self-closing': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/multiline-html-element-content-newline': 'off',
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
      '**/next-env.d.ts',
    ],
  },
)
