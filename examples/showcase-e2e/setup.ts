import type { ViteDevServer } from 'vite'
import { resolve } from 'node:path'
import process from 'node:process'
import { createServer } from 'vite'

interface ShowcaseServerConfig {
  root: string
  port: number
}

const showcaseServers: ShowcaseServerConfig[] = [
  {
    root: 'examples/react-showcase',
    port: 5173,
  },
  {
    root: 'examples/vue-showcase',
    port: 5174,
  },
]

function startShowcaseServer(
  config: ShowcaseServerConfig,
): Promise<ViteDevServer> {
  const root = resolve(process.cwd(), config.root)

  return createServer({
    root,
    configFile: resolve(root, 'vite.config.ts'),
    server: {
      host: '127.0.0.1',
      port: config.port,
      strictPort: true,
    },
  }).then(server => server.listen())
}

export default function setup() {
  const servers: ViteDevServer[] = []

  return Promise.all(
    showcaseServers.map(config =>
      startShowcaseServer(config).then(server => {
        servers.push(server)
      }),
    ),
  ).then(() => {
    return function teardown() {
      return Promise.all(servers.map(server => server.close())).then(() => {})
    }
  })
}
