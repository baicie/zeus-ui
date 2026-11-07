import type { AiTokenConfig, AiTokenRecord } from './auth'
import path from 'node:path'

import process from 'node:process'
import { parseAiTokens, tokenRecordsFromConfig } from './auth'
import { createAiHostServer } from './protocol-server'
import {
  resetPublicReplayDatabase,
  resolvePublicReplayRoot,
  seedPublicReplayConversation,
} from './public-replay'
import { createPersistentHost, openHostDatabase } from './store'
import { createProtectedWorkspace } from './workspace'

export interface AiTenantConfig {
  readonly id: string
  readonly databaseFile: string
  readonly workspaceRoot: string
}

export interface StartAiHostOptions {
  readonly databaseFile?: string
  readonly workspaceRoot?: string
  readonly port?: number
  readonly hostname?: string
  readonly allowedOrigins?: readonly string[]
  readonly tokens?: readonly AiTokenConfig[]
  readonly tenants?: readonly AiTenantConfig[]
  readonly mode?: 'live' | 'replay'
  readonly publicReplay?: boolean
  readonly allowedStreams?: readonly string[]
  readonly trustProxy?: boolean
  readonly maxSseClientsPerIp?: number
  readonly maxRequestsPerMinute?: number
  readonly maxSseClientsPerTenant?: number
  readonly maxAssetsPerTenant?: number
  readonly maxAssetBytes?: number
  readonly maxToolTimeoutMs?: number
}

export async function startAiHost(options: StartAiHostOptions = {}) {
  const mode =
    options.mode ?? (process.env.ZEUS_AI_MODE === 'live' ? 'live' : 'replay')
  const publicReplay =
    options.publicReplay ?? process.env.ZEUS_AI_PUBLIC_REPLAY === 'true'
  const trustProxy =
    options.trustProxy ?? process.env.ZEUS_AI_TRUST_PROXY === 'true'
  const tokens = resolveTokens(options.tokens)
  const tenantConfigs = resolveTenants(options)
  const runtimes = new Map<
    string,
    {
      host: ReturnType<typeof createPersistentHost>
      workspace: ReturnType<typeof createProtectedWorkspace>
      database: ReturnType<typeof openHostDatabase>
    }
  >()
  for (const tenant of tenantConfigs) {
    const database = openHostDatabase(tenant.databaseFile)
    let workspaceRoot = tenant.workspaceRoot
    if (publicReplay) {
      // Generation directories keep old demo data and visitor files intact;
      // only the SQLite event log is reset for the new seed version.
      workspaceRoot = resolvePublicReplayRoot(tenant.workspaceRoot).root
      resetPublicReplayDatabase(database)
    }
    const host = createPersistentHost({ database, streamId: 'reference' })
    if (publicReplay) seedPublicReplayConversation(host)
    const runtime = {
      host,
      workspace: createProtectedWorkspace({
        id: tenant.id,
        root: workspaceRoot,
        allowSelfApproval: mode === 'replay' && !publicReplay,
      }),
      database,
    }
    runtimes.set(tenant.id, runtime)
  }
  const server = createAiHostServer({
    tenants: new Map(
      [...runtimes].map(([id, runtime]) => [
        id,
        { id, host: runtime.host, workspace: runtime.workspace },
      ]),
    ),
    tokens,
    mode,
    publicReplay,
    trustProxy,
    ...(options.allowedStreams
      ? { allowedStreams: options.allowedStreams }
      : {}),
    ...(options.maxSseClientsPerIp === undefined
      ? {}
      : { maxSseClientsPerIp: options.maxSseClientsPerIp }),
    allowedOrigins: options.allowedOrigins ?? allowedOriginsFromEnvironment(),
    ...(options.maxRequestsPerMinute === undefined
      ? {}
      : { maxRequestsPerMinute: options.maxRequestsPerMinute }),
    ...(options.maxSseClientsPerTenant === undefined
      ? {}
      : { maxSseClientsPerTenant: options.maxSseClientsPerTenant }),
    ...(options.maxAssetsPerTenant === undefined
      ? {}
      : { maxAssetsPerTenant: options.maxAssetsPerTenant }),
    ...(options.maxAssetBytes === undefined
      ? {}
      : { maxAssetBytes: options.maxAssetBytes }),
    ...(options.maxToolTimeoutMs === undefined
      ? {}
      : { toolTimeoutMs: options.maxToolTimeoutMs }),
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
    mode,
    publicReplay,
    tokens: tokens.length,
    async close() {
      await server.close()
      for (const runtime of runtimes.values()) {
        runtime.host.close()
        runtime.database.close()
      }
    },
  }
}

function resolveTokens(
  explicit: readonly AiTokenConfig[] | undefined,
): readonly AiTokenRecord[] {
  if (explicit) return tokenRecordsFromConfig(explicit)
  return parseAiTokens(process.env.ZEUS_AI_TOKENS)
}

function resolveTenants(
  options: StartAiHostOptions,
): readonly AiTenantConfig[] {
  if (options.tenants && options.tenants.length > 0) return options.tenants
  const configured = process.env.ZEUS_AI_TENANTS
  if (configured) {
    let value: unknown
    try {
      value = JSON.parse(configured) as unknown
    } catch {
      throw new Error('ZEUS_AI_TENANTS must be valid JSON')
    }
    if (!Array.isArray(value) || value.length === 0) {
      throw new Error('ZEUS_AI_TENANTS must be a non-empty array')
    }
    return value.map((entry, index) => {
      if (
        !entry ||
        typeof entry !== 'object' ||
        typeof (entry as AiTenantConfig).id !== 'string' ||
        typeof (entry as AiTenantConfig).databaseFile !== 'string' ||
        typeof (entry as AiTenantConfig).workspaceRoot !== 'string'
      ) {
        throw new Error(`ZEUS_AI_TENANTS[${index}] is invalid`)
      }
      return entry as AiTenantConfig
    })
  }
  const databaseFile =
    options.databaseFile ??
    process.env.ZEUS_AI_DB ??
    path.resolve(import.meta.dirname, '../.data/ai.sqlite')
  const workspaceRoot =
    options.workspaceRoot ??
    process.env.ZEUS_AI_WORKSPACE ??
    path.resolve(import.meta.dirname, '../.data/workspace')
  return [{ id: 'reference', databaseFile, workspaceRoot }]
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
    if (started.tokens === 0) {
      console.warn(
        'Zeus AI reference host has no bearer tokens; all authenticated endpoints will return 401.',
      )
    }
  })
}
