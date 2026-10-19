import { resolve } from 'node:path'
import { defineConfig } from 'vite'

const fixtureRoot = resolve(import.meta.dirname)
const dataGridRoot = resolve(
  fixtureRoot,
  '../../../../packages/advanced/data-grid',
)

export default defineConfig({
  root: fixtureRoot,
  resolve: {
    alias: [
      {
        find: /^react$/,
        replacement: resolve(dataGridRoot, 'node_modules/react/index.js'),
      },
      {
        find: /^react-dom\/client$/,
        replacement: resolve(dataGridRoot, 'node_modules/react-dom/client.js'),
      },
      {
        find: /^react-dom$/,
        replacement: resolve(dataGridRoot, 'node_modules/react-dom/index.js'),
      },
      {
        find: /^@zeus-web\/data-grid\/cell-renderer-adapter$/,
        replacement: resolve(dataGridRoot, 'src/core/cell-renderer-adapter.ts'),
      },
    ],
  },
  server: {
    host: '127.0.0.1',
    port: 5177,
    strictPort: true,
  },
})
