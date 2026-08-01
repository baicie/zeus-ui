import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const BENCHMARK_PORT = 5177

export default function setup() {
  const root = fileURLToPath(new URL('.', import.meta.url))

  return createServer({
    root,
    configFile: false,
    server: {
      host: '127.0.0.1',
      port: BENCHMARK_PORT,
      strictPort: true,
    },
  })
    .then(server => server.listen())
    .then(server => {
      return function teardown() {
        return server.close()
      }
    })
}
