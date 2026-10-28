import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const packages = resolve(__dirname, '../../packages')

// Consume the AI packages from source: the example doubles as the prototype
// and the browser E2E target, so it must not depend on a prior build.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: '@zeus-web/ai-primitives/extensions',
        replacement: `${packages}/ai-primitives/src/extensions/index.ts`,
      },
      {
        find: '@zeus-web/ai-wc/define',
        replacement: `${packages}/ai-wc/src/define.ts`,
      },
      ...[
        'ai-core',
        'ai-primitives',
        'ai-react',
        'ai-vue',
        'ai-wc',
        'ai-adapters',
      ].map(name => ({
        find: `@zeus-web/${name}`,
        replacement: `${packages}/${name}/src/index.ts`,
      })),
    ],
  },
  server: { host: '127.0.0.1', port: 5190 },
})
