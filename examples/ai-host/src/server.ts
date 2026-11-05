import path from 'node:path'
import process from 'node:process'

import { createAiHostServer } from './protocol-server'
import { createPersistentHost, openHostDatabase } from './store'
import { createProtectedWorkspace } from './workspace'

export interface StartAiHostOptions {
  readonly databaseFile?: string
  readonly workspaceRoot?: string
  readonly port?: number
  readonly hostname?: string
  readonly allowedOrigins?: readonly string[]
}

export async function startAiHost(options: StartAiHostOptions = {}) {
  const databaseFile =
    options.databaseFile ??
    process.env.ZEUS_AI_DB ??
    path.resolve(import.meta.dirname, '../.data/ai.sqlite')
  const workspaceRoot =
    options.workspaceRoot ??
    process.env.ZEUS_AI_WORKSPACE ??
    path.resolve(import.meta.dirname, '../.data/workspace')
  const database = openHostDatabase(databaseFile)
  const workspace = createProtectedWorkspace({
    id: 'reference',
    root: workspaceRoot,
  })
  const host = createPersistentHost({ database })
  const server = createAiHostServer({
    host,
    workspace,
    allowedOrigins: options.allowedOrigins ?? allowedOriginsFromEnvironment(),
  })
  await new Promise<void>((resolve, reject) => {
    server.inner.once('error', reject)
    server.inner.listen(
      options.port ?? Number(process.env.PORT ?? 8788),
      options.hostname ?? process.env.ZEUS_AI_HOST ?? '127.0.0.1',
      () => {
        server.inner.off('error', reject)
        resolve()
      },
    )
  })
  const address = server.inner.address()
  if (!address || typeof address === 'string')
    throw new Error('No AI host port')
  return {
    origin: `http://${options.hostname ?? process.env.ZEUS_AI_HOST ?? '127.0.0.1'}:${address.port}`,
    async close() {
      await server.close()
      host.close()
      database.close()
    },
  }
}

function allowedOriginsFromEnvironment(): readonly string[] {
  return (
    process.env.ZEUS_AI_ORIGINS ?? 'http://127.0.0.1:8788,http://localhost:8788'
  )
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void startAiHost().then(started => {
    console.info(`Zeus AI reference host listening on ${started.origin}`)
  })
}
