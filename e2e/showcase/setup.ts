import { resolve } from 'node:path'
import process from 'node:process'
import { createServer } from 'vite'
import { createServer as createVitePressServer } from 'vitepress'

interface CloseableServer {
  close: () => Promise<void>
}

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
  {
    root: 'examples/advanced-showcase',
    port: 5176,
  },
]

const docsServer: ShowcaseServerConfig = {
  root: 'apps/docs',
  port: 5175,
}

function startShowcaseServer(
  config: ShowcaseServerConfig,
): Promise<CloseableServer> {
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

function startDocsServer(): Promise<CloseableServer> {
  const root = resolve(process.cwd(), docsServer.root)
  process.env.DOCS_BASE = '/zeus-ui/'
  if (!process.env.ZEUS_DOCS_CACHE_DIR) {
    process.env.ZEUS_DOCS_CACHE_DIR = resolve(
      process.cwd(),
      'node_modules/.cache/vitepress-showcase-e2e',
    )
  }

  return createVitePressServer(root, {
    host: '127.0.0.1',
    port: docsServer.port,
    strictPort: true,
  }).then(server => server.listen())
}

export default function setup() {
  const servers: CloseableServer[] = []

  return Promise.all(
    showcaseServers
      .map(config =>
        startShowcaseServer(config).then(server => {
          servers.push(server)
        }),
      )
      .concat(
        startDocsServer().then(server => {
          servers.push(server)
        }),
      ),
  ).then(() => {
    return function teardown() {
      return Promise.all(servers.map(server => server.close())).then(() => {})
    }
  })
}
