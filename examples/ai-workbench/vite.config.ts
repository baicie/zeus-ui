import { resolve } from 'node:path'
import process from 'node:process'

import { defineConfig } from 'vite'

const packages = resolve(__dirname, '../../packages')

export default defineConfig({
  plugins: [],
  define: {
    __ZEUS_AI_HOST__: JSON.stringify(process.env.ZEUS_AI_HOST_ORIGIN ?? ''),
  },
  resolve: {
    alias: [
      {
        find: '@zeus-web/ai-wc/define',
        replacement: `${packages}/ai-wc/src/define.ts`,
      },
      ...['ai-core', 'ai-adapters', 'ai-wc', 'ai-primitives'].map(name => ({
        find: `@zeus-web/${name}`,
        replacement: `${packages}/${name}/src/index.ts`,
      })),
    ],
  },
  server: {
    host: '127.0.0.1',
    port: 5191,
    proxy: {
      '/ai-host/': {
        target: process.env.ZEUS_AI_HOST_ORIGIN ?? 'http://127.0.0.1:8788',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/ai-host/, ''),
      },
    },
  },
  preview: { host: '127.0.0.1', port: 4191 },
})
