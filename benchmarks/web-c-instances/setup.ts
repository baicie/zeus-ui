import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build, preview } from 'vite'

const BENCHMARK_PORT = 5177

export default function setup() {
  const root = fileURLToPath(new URL('.', import.meta.url))
  const outDir = resolve(root, '../../temp/web-c-instance-benchmark')

  return rm(outDir, { recursive: true, force: true })
    .then(() =>
      build({
        root,
        configFile: false,
        build: {
          outDir,
          emptyOutDir: true,
          target: 'es2016',
        },
      }),
    )
    .then(() =>
      preview({
        root,
        configFile: false,
        build: {
          outDir,
        },
        preview: {
          host: '127.0.0.1',
          port: BENCHMARK_PORT,
          strictPort: true,
        },
      }),
    )
    .then(server => {
      return function teardown() {
        return server.close().then(() => {
          return rm(outDir, { recursive: true, force: true })
        })
      }
    })
}
