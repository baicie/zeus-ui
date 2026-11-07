import type {
  AnyDomainEvent,
  ApprovalRequest,
  ChangeSet,
  Command,
  CommandAck,
  Message,
} from '@zeus-web/ai-core'

import type { AiPrincipal, AiTokenRecord } from './auth'
import type { PersistentHost } from './store'
import type { ProtectedWorkspace } from './workspace'

import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import http from 'node:http'

import { authenticateBearer, requireAiRole } from './auth'
import { countDiffLines, createUnifiedDiff } from './diff'
import { FixedWindowLimiter } from './rate-limit'

export interface AiTenantRuntime {
  readonly id: string
  readonly host: PersistentHost
  readonly workspace: ProtectedWorkspace
}

export interface AiHostServerOptions {
  readonly tenants: ReadonlyMap<string, AiTenantRuntime>
  readonly tokens: readonly AiTokenRecord[]
  readonly allowedOrigins?: readonly string[]
  readonly mode?: 'live' | 'replay'
  /**
   * Strictly non-writable public replay. Every mutating request is rejected
   * before routing and only the seeded stream is readable. There is no
   * per-visitor identity behind a shared proxy token, so this is the only
   * safe way to expose the Workbench anonymously.
   */
  readonly publicReplay?: boolean
  /** Stream ids a client may read. Defaults to the seeded `reference` stream. */
  readonly allowedStreams?: readonly string[]
  /** Trust the Workbench-injected X-Forwarded-For for per-IP rate limits. */
  readonly trustProxy?: boolean
  readonly maxSseClientsPerIp?: number
  readonly commandDelayMs?: number
  readonly maxRequestsPerMinute?: number
  readonly maxSseClientsPerTenant?: number
  readonly maxAssetsPerTenant?: number
  readonly maxAssetBytes?: number
  readonly assetTtlMs?: number
  readonly toolTimeoutMs?: number
}

export interface AiHostServer {
  readonly port: number
  readonly origin: string
  readonly inner: http.Server
  close: () => Promise<void>
}

const MAX_BODY_BYTES = 512 * 1024
const DEFAULT_TOOL_TIMEOUT_MS = 15_000
const DEFAULT_ASSET_TTL_MS = 60 * 60 * 1000

interface StreamClient {
  readonly response: http.ServerResponse
  readonly streamId: string
  tenantId: string
  after: number
  closed: boolean
  pending: string
  flushScheduled: boolean
}

interface TenantState {
  readonly runtime: AiTenantRuntime
  readonly clients: Set<StreamClient>
  readonly conversations: Set<string>
  readonly assets: Map<
    string,
    {
      readonly mimeType: string
      readonly bytes: Uint8Array
      readonly name: string
      readonly createdAt: number
    }
  >
  assetBytes: number
}

export function createAiHostServer(options: AiHostServerOptions): AiHostServer {
  const states = new Map<string, TenantState>()
  for (const [id, runtime] of options.tenants) {
    states.set(id, {
      runtime,
      clients: new Set(),
      conversations: new Set(),
      assets: new Map(),
      assetBytes: 0,
    })
  }
  const maxRequests = new FixedWindowLimiter({
    limit: options.maxRequestsPerMinute ?? 120,
    windowMs: 60_000,
    maxEntries: 10_000,
  })
  const maxSseClientsPerTenant = options.maxSseClientsPerTenant ?? 8
  const maxAssetsPerTenant = options.maxAssetsPerTenant ?? 64
  const maxAssetBytes = options.maxAssetBytes ?? 128 * 1024
  const assetTtlMs = options.assetTtlMs ?? DEFAULT_ASSET_TTL_MS
  const toolTimeoutMs = options.toolTimeoutMs ?? DEFAULT_TOOL_TIMEOUT_MS
  const mode = options.mode ?? 'replay'
  const publicReplay = options.publicReplay === true
  const allowedStreams = new Set(options.allowedStreams ?? ['reference'])
  const trustProxy = options.trustProxy === true
  const maxSseClientsPerIp = options.maxSseClientsPerIp ?? 4
  const sseClientsByIp = new Map<string, number>()

  const server = http.createServer((request, response) => {
    void handle(request, response).catch(error => {
      const status =
        error && typeof error === 'object' && 'status' in error
          ? Number(error.status)
          : 500
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String(error.code)
          : 'AI_HOST_INTERNAL'
      sendJson(response, status, {
        error: {
          code,
          message: error instanceof Error ? error.message : String(error),
        },
      })
    })
  })

  async function handle(
    request: http.IncomingMessage,
    response: http.ServerResponse,
  ): Promise<void> {
    const method = request.method ?? 'GET'
    const url = new URL(request.url ?? '/', 'http://localhost')
    const origin = request.headers.origin
    const allowed = options.allowedOrigins ?? []
    // A browser Origin must always be on the allowlist. Falling back to `*`
    // for an authenticated endpoint silently widens CORS.
    if (origin && !allowed.includes(origin)) {
      sendJson(response, 403, {
        error: { code: 'AI_HOST_ORIGIN', message: 'Origin is not allowed.' },
      })
      return
    }
    if (origin) {
      response.setHeader('Access-Control-Allow-Origin', origin)
    }
    response.setHeader('Vary', 'Origin')
    if (method === 'OPTIONS') {
      response.writeHead(204, {
        'Access-Control-Allow-Headers':
          'Authorization, Content-Type, Last-Event-ID, Idempotency-Key',
        'Access-Control-Allow-Methods': 'GET, POST',
      })
      response.end()
      return
    }

    if (url.pathname === '/health' && method === 'GET') {
      sendJson(response, 200, {
        ok: true,
        workspace: states.keys().next().value ?? 'reference',
        mode,
        publicReplay,
        readOnly: publicReplay,
        interactive: !publicReplay,
        streamId: 'reference',
      })
      return
    }

    const principal = authenticateBearer(request, options.tokens)
    if (!principal) {
      response.setHeader('WWW-Authenticate', 'Bearer')
      sendJson(response, 401, {
        error: {
          code: 'AI_HOST_AUTH_REQUIRED',
          message: 'A valid bearer token is required.',
        },
      })
      return
    }
    const state = states.get(principal.tenantId)
    if (!state) {
      sendJson(response, 403, {
        error: {
          code: 'AI_HOST_TENANT_FORBIDDEN',
          message: 'Token is not valid for this tenant.',
        },
      })
      return
    }
    const clientIp = trustProxy ? forwardedClientIp(request) : undefined
    const rateKey =
      publicReplay && clientIp
        ? `public:${clientIp}`
        : `${principal.tenantId}:${principal.userId}`
    if (!maxRequests.allow(rateKey)) {
      sendJson(response, 429, {
        error: {
          code: 'AI_HOST_RATE_LIMITED',
          message: 'Too many requests. Retry later.',
        },
      })
      return
    }

    // Public replay is read-only at the transport boundary. This guard runs
    // before every route so a future POST endpoint cannot accidentally become
    // writable, and it covers unknown paths too.
    if (
      publicReplay &&
      method !== 'GET' &&
      method !== 'HEAD' &&
      method !== 'OPTIONS'
    ) {
      sendJson(response, 403, {
        error: {
          code: 'AI_HOST_PUBLIC_REPLAY_READ_ONLY',
          message: 'The public replay demo is read-only.',
        },
      })
      return
    }

    if (url.pathname === '/assets' && method === 'POST') {
      if (!requireAiRole(principal, ['editor', 'admin'])) {
        sendJson(response, 403, {
          error: {
            code: 'AI_HOST_FORBIDDEN',
            message: 'Asset upload requires editor access.',
          },
        })
        return
      }
      const body = (await readJson(request)) as {
        name?: unknown
        mimeType?: unknown
        data?: unknown
      }
      const name = typeof body.name === 'string' ? body.name : ''
      const mimeType = typeof body.mimeType === 'string' ? body.mimeType : ''
      const data = typeof body.data === 'string' ? body.data : ''
      const allowedTypes = new Set([
        'text/plain',
        'application/json',
        'image/png',
        'image/jpeg',
      ])
      if (
        name.length === 0 ||
        name.length > 128 ||
        name.includes('/') ||
        name.includes('\\') ||
        !allowedTypes.has(mimeType) ||
        data.length === 0
      ) {
        sendJson(response, 400, {
          error: {
            code: 'AI_HOST_ASSET_INVALID',
            message:
              'Asset requires a safe name, supported MIME type and data.',
          },
        })
        return
      }
      pruneAssets(state)
      if (state.assets.size >= maxAssetsPerTenant) {
        sendJson(response, 429, {
          error: {
            code: 'AI_HOST_ASSET_LIMIT',
            message: 'Asset quota is exhausted.',
          },
        })
        return
      }
      const bytes = Buffer.from(data, 'base64')
      if (
        bytes.byteLength === 0 ||
        bytes.byteLength > maxAssetBytes ||
        state.assetBytes + bytes.byteLength > maxAssetBytes * 4
      ) {
        sendJson(response, 413, {
          error: {
            code: 'AI_HOST_ASSET_SIZE',
            message: 'Asset exceeds the per-tenant limit.',
          },
        })
        return
      }
      const id = `asset-${randomUUID()}`
      state.assets.set(id, {
        mimeType,
        bytes: new Uint8Array(bytes),
        name,
        createdAt: Date.now(),
      })
      state.assetBytes += bytes.byteLength
      sendJson(response, 200, {
        asset: { id, mimeType, size: bytes.byteLength },
      })
      return
    }
    if (url.pathname === '/commands' && method === 'POST') {
      const command = (await readJson(request)) as Command
      const denied = authorizeCommand(principal, command, mode, publicReplay)
      if (denied) {
        sendJson(response, denied.status, {
          error: { code: denied.code, message: denied.message },
        })
        return
      }
      const ack = await withTimeout(
        state.runtime.host.execute(command),
        toolTimeoutMs,
      )
      await afterCommand(state, principal, command, ack)
      sendJson(response, 200, ack)
      return
    }
    if (url.pathname === '/snapshots' && method === 'GET') {
      if (
        !requireAiRole(principal, ['viewer', 'editor', 'approver', 'admin'])
      ) {
        sendJson(response, 403, {
          error: {
            code: 'AI_HOST_FORBIDDEN',
            message: 'Read access required.',
          },
        })
        return
      }
      const streamId = url.searchParams.get('streamId') ?? 'reference'
      if (!allowedStreams.has(streamId)) {
        sendJson(response, 404, {
          error: {
            code: 'AI_HOST_STREAM_NOT_FOUND',
            message: 'Stream not found.',
          },
        })
        return
      }
      const after = parseCursor(url.searchParams.get('after'), 0)
      if (after === undefined) {
        sendJson(response, 400, {
          error: {
            code: 'AI_HOST_CURSOR_INVALID',
            message: 'after must be a non-negative integer.',
          },
        })
        return
      }
      const snapshot = await state.runtime.host.getSnapshot({
        kind: 'stream',
        id: streamId,
      })
      sendJson(response, 200, {
        ...snapshot,
        events: state.runtime.host.events(streamId, after),
      })
      return
    }
    if (/^\/assets\/[^/]+$/.test(url.pathname) && method === 'GET') {
      // Public replay never serves visitor-uploaded or approval assets: the
      // seeded demo is text-only and uploads are rejected above.
      if (publicReplay) {
        sendJson(response, 404, {
          error: {
            code: 'AI_HOST_ASSET_NOT_FOUND',
            message: 'Asset not found.',
          },
        })
        return
      }
      const id = decodeURIComponent(url.pathname.split('/')[2]!)
      pruneAssets(state)
      const asset = state.assets.get(id)
      if (!asset) {
        sendJson(response, 404, {
          error: {
            code: 'AI_HOST_ASSET_NOT_FOUND',
            message: 'Asset not found.',
          },
        })
        return
      }
      response.writeHead(200, {
        'Content-Type': asset.mimeType,
        'Content-Length': asset.bytes.byteLength,
        'Cache-Control': 'no-store',
      })
      response.end(Buffer.from(asset.bytes))
      return
    }
    if (url.pathname === '/test-report' && method === 'POST') {
      if (!requireAiRole(principal, ['editor', 'admin'])) {
        sendJson(response, 403, {
          error: {
            code: 'AI_HOST_FORBIDDEN',
            message: 'Test reports require editor access.',
          },
        })
        return
      }
      const files = await state.runtime.workspace.snapshot()
      const target = files.find(file => file.path === 'notes/workbench.txt')
      const passed = target !== undefined
      const outputId = `test-output-${randomUUID()}`
      const output = passed
        ? 'workspace contains notes/workbench.txt'
        : 'workspace is missing notes/workbench.txt'
      state.assets.set(outputId, {
        mimeType: 'text/plain; charset=utf-8',
        bytes: new TextEncoder().encode(`${output}\n`),
        name: 'workbench-check.txt',
        createdAt: Date.now(),
      })
      sendJson(response, 200, {
        report: {
          schema: 'zeus.test-report/v1',
          summary: {
            passed: passed ? 1 : 0,
            failed: passed ? 0 : 1,
            skipped: 0,
          },
          cases: [
            {
              id: 'workspace-write',
              name: 'workspace contains notes/workbench.txt',
              status: passed ? 'passed' : 'failed',
              message: passed ? undefined : output,
              output: {
                id: outputId,
                mimeType: 'text/plain; charset=utf-8',
              },
            },
          ],
        },
      })
      return
    }
    if (/^\/streams\/[^/]+\/events$/.test(url.pathname) && method === 'GET') {
      if (
        !requireAiRole(principal, ['viewer', 'editor', 'approver', 'admin'])
      ) {
        sendJson(response, 403, {
          error: {
            code: 'AI_HOST_FORBIDDEN',
            message: 'Read access required.',
          },
        })
        return
      }
      if (state.clients.size >= maxSseClientsPerTenant) {
        sendJson(response, 429, {
          error: {
            code: 'AI_HOST_SSE_LIMIT',
            message: 'SSE connection limit reached for this tenant.',
          },
        })
        return
      }
      const streamId = decodeURIComponent(url.pathname.split('/')[2]!)
      if (!allowedStreams.has(streamId)) {
        sendJson(response, 404, {
          error: {
            code: 'AI_HOST_STREAM_NOT_FOUND',
            message: 'Stream not found.',
          },
        })
        return
      }
      const cursor = parseCursor(
        rawHeader(request, 'last-event-id') ?? url.searchParams.get('after'),
        0,
      )
      if (cursor === undefined) {
        sendJson(response, 400, {
          error: {
            code: 'AI_HOST_CURSOR_INVALID',
            message: 'after must be a non-negative integer.',
          },
        })
        return
      }
      if (publicReplay && clientIp) {
        const current = sseClientsByIp.get(clientIp) ?? 0
        if (current >= maxSseClientsPerIp) {
          sendJson(response, 429, {
            error: {
              code: 'AI_HOST_SSE_LIMIT',
              message: 'SSE connection limit reached for this client.',
            },
          })
          return
        }
        sseClientsByIp.set(clientIp, current + 1)
      }
      response.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      })
      response.socket?.setNoDelay(true)
      response.flushHeaders()
      response.write(': connected\n\n')
      const client: StreamClient = {
        response,
        streamId,
        tenantId: principal.tenantId,
        after: cursor,
        closed: false,
        pending: '',
        flushScheduled: false,
      }
      state.clients.add(client)
      request.on('close', () => {
        client.closed = true
        state.clients.delete(client)
        if (publicReplay && clientIp) {
          const current = sseClientsByIp.get(clientIp) ?? 0
          if (current <= 1) sseClientsByIp.delete(clientIp)
          else sseClientsByIp.set(clientIp, current - 1)
        }
      })
      for (const event of state.runtime.host.events(streamId, client.after)) {
        client.after = event.seq
        writeEvent(client, event)
      }
      return
    }
    if (url.pathname === '/workspace' && method === 'GET') {
      if (
        !requireAiRole(principal, ['viewer', 'editor', 'approver', 'admin'])
      ) {
        sendJson(response, 403, {
          error: {
            code: 'AI_HOST_FORBIDDEN',
            message: 'Read access required.',
          },
        })
        return
      }
      sendJson(response, 200, {
        workspace: state.runtime.workspace.id,
        files: await state.runtime.workspace.snapshot(),
        approvals: state.runtime.workspace.pending().map(item => ({
          id: item.id,
          executionId: item.executionId,
          revision: item.revision,
          title: item.title,
          summary: item.summary,
          requestedBy: item.requestedBy,
        })),
      })
      return
    }
    if (url.pathname === '/approvals' && method === 'POST') {
      if (!requireAiRole(principal, ['approver', 'admin'])) {
        sendJson(response, 403, {
          error: {
            code: 'AI_HOST_FORBIDDEN',
            message: 'Approval requires approver access.',
          },
        })
        return
      }
      const body = (await readJson(request)) as {
        id?: unknown
        revision?: unknown
        approved?: unknown
      }
      if (
        typeof body.id !== 'string' ||
        typeof body.revision !== 'number' ||
        typeof body.approved !== 'boolean'
      ) {
        sendJson(response, 400, {
          error: {
            code: 'AI_APPROVAL_INVALID',
            message: 'Approval request is invalid.',
          },
        })
        return
      }
      const result = await state.runtime.workspace.resolve(
        body.id,
        body.revision,
        body.approved ? 'approved' : 'rejected',
        { userId: principal.userId, role: principal.role },
      )
      if (!result.ok) {
        sendJson(
          response,
          result.code === 'ZEUS_AI_APPROVAL_NOT_FOUND' ? 404 : 409,
          {
            error: { code: result.code, message: result.message },
          },
        )
        return
      }
      sendJson(response, 200, { status: result.status })
      return
    }
    sendJson(response, 404, {
      error: { code: 'AI_HOST_NOT_FOUND', message: 'Route not found.' },
    })
  }

  async function afterCommand(
    state: TenantState,
    principal: AiPrincipal,
    command: Command,
    ack: CommandAck,
  ): Promise<void> {
    if (!ack.accepted) return
    if (command.type === 'message.send') {
      if (!state.conversations.has(command.target.id)) {
        emit(
          state,
          'conversation.upserted',
          { kind: 'conversation', id: command.target.id },
          {
            conversation: {
              id: command.target.id,
              title: 'Reference conversation',
              revision: 1,
            },
          },
        )
        state.conversations.add(command.target.id)
      }
      const payload = command.payload as {
        text?: unknown
        attachments?: Array<{ id?: unknown }>
      }
      const text = typeof payload.text === 'string' ? payload.text : ''
      const nextSeq = state.runtime.host.latestSeq('reference') + 1
      const attachmentParts = (payload.attachments ?? []).flatMap(
        (attachment, index) => {
          if (typeof attachment.id !== 'string') return []
          const asset = state.assets.get(attachment.id)
          if (!asset) return []
          const isImage = asset.mimeType.startsWith('image/')
          return [
            isImage
              ? {
                  id: `part-${nextSeq}-asset-${index}`,
                  kind: 'image' as const,
                  asset: {
                    id: attachment.id,
                    mimeType: asset.mimeType,
                    size: asset.bytes.byteLength,
                  },
                }
              : {
                  id: `part-${nextSeq}-asset-${index}`,
                  kind: 'file' as const,
                  asset: {
                    id: attachment.id,
                    mimeType: asset.mimeType,
                    size: asset.bytes.byteLength,
                  },
                  name: asset.name,
                },
          ]
        },
      )
      const message: Message = {
        id: `message-${nextSeq}`,
        conversationId: command.target.id,
        author: 'user',
        parts: [
          ...(text.length > 0
            ? [
                {
                  id: `part-${nextSeq}`,
                  kind: 'text' as const,
                  revision: 1,
                  text,
                  format: 'plain' as const,
                },
              ]
            : []),
          ...attachmentParts,
        ],
        status: 'complete',
        revision: 1,
        createdAt: new Date().toISOString(),
      }
      emit(
        state,
        'message.created',
        { kind: 'message', id: message.id },
        {
          message,
        },
      )
      return
    }
    if (command.type === 'changeset.propose') {
      const payload = command.payload as {
        files?: Array<{ path?: unknown; content?: unknown }>
      }
      const files = (payload.files ?? []).filter(
        (file): file is { path: string; content: string } =>
          typeof file.path === 'string' && typeof file.content === 'string',
      )
      try {
        const approval = state.runtime.workspace.propose(
          files,
          principal.userId,
        )
        emit(
          state,
          'execution.started',
          { kind: 'execution', id: approval.executionId },
          {
            execution: {
              id: approval.executionId,
              kind: 'agent',
              workspaceId: state.runtime.workspace.id,
              status: 'awaiting-approval',
              createdAt: new Date().toISOString(),
              revision: 1,
              activeStepIds: [],
            },
          },
        )
        const approvalRequest: ApprovalRequest = {
          id: approval.id,
          executionId: approval.executionId,
          title: approval.title,
          summary: approval.summary,
          operation: {
            kind: 'changeset.apply',
            target: `workspace:${state.runtime.workspace.id}`,
          },
          scope: 'workspace',
          risk: 'high',
          status: 'pending',
          revision: approval.revision,
        }
        emit(
          state,
          'approval.requested',
          { kind: 'approval', id: approval.id },
          {
            approval: approvalRequest,
          },
        )
        const changeSetFiles = approval.files.map((file, index) => {
          const diff = createUnifiedDiff({
            path: file.path,
            previous: file.previous,
            next: file.content,
          })
          const assetId = `${approval.id}-diff-${index}`
          const bytes = new TextEncoder().encode(diff)
          state.assets.set(assetId, {
            mimeType: 'text/x-diff; charset=utf-8',
            bytes,
            name: file.path,
            createdAt: Date.now(),
          })
          const stats = countDiffLines(diff)
          return {
            path: file.path,
            status:
              file.previous.length === 0
                ? ('added' as const)
                : ('modified' as const),
            diffAsset: {
              id: assetId,
              mimeType: 'text/x-diff; charset=utf-8',
              size: bytes.byteLength,
            },
            stats,
          }
        })
        const changeSet: ChangeSet = {
          id: `changeset-${approval.id}`,
          executionId: approval.executionId,
          workspaceId: state.runtime.workspace.id,
          baseRevision: 'workspace-head',
          files: changeSetFiles,
          status: 'ready',
          revision: 1,
        }
        emit(
          state,
          'changeset.updated',
          { kind: 'changeset', id: changeSet.id },
          {
            changeset: changeSet,
          },
        )
      } catch (error) {
        emit(
          state,
          'execution.status.changed',
          { kind: 'execution', id: 'execution-failed' },
          {
            id: 'execution-failed',
            from: 'running',
            to: 'failed',
            revision: 2,
          },
        )
        throw error
      }
    }
    if (command.type === 'approval.resolve') {
      const payload = command.payload as {
        decision?: unknown
        scope?: unknown
        operation?: unknown
      }
      if (
        (payload.decision !== 'approved' && payload.decision !== 'rejected') ||
        command.expectedRevision === undefined
      ) {
        emit(
          state,
          'approval.resolved',
          { kind: 'approval', id: command.target.id },
          {
            approvalId: command.target.id,
            decision: 'revoked',
            revision: (command.expectedRevision ?? 0) + 1,
          },
        )
        return
      }
      const outcome = await state.runtime.workspace.resolve(
        command.target.id,
        command.expectedRevision,
        payload.decision,
        { userId: principal.userId, role: principal.role },
      )
      emit(
        state,
        'approval.resolved',
        { kind: 'approval', id: command.target.id },
        {
          approvalId: command.target.id,
          decision: outcome.ok
            ? payload.decision
            : payload.decision === 'approved'
              ? 'revoked'
              : 'expired',
          revision: command.expectedRevision + 1,
        },
      )
    }
  }

  function emit<T extends AnyDomainEvent>(
    state: TenantState,
    type: T['type'],
    entity: T['entity'],
    payload: T['payload'],
  ): void {
    const event = state.runtime.host.append(type, entity, payload) as T
    for (const client of state.clients) {
      if (event.streamId === client.streamId && event.seq > client.after) {
        client.after = event.seq
        writeEvent(client, event)
      }
    }
  }

  function writeEvent(client: StreamClient, event: AnyDomainEvent): void {
    if (client.closed) return
    client.pending += `id: ${event.seq}\nevent: ai-event\ndata: ${JSON.stringify(event)}\n\n`
    if (client.flushScheduled) return
    client.flushScheduled = true
    queueMicrotask(() => {
      client.flushScheduled = false
      if (client.closed) return
      const payload = client.pending
      client.pending = ''
      client.response.write(payload)
    })
  }

  function pruneAssets(state: TenantState): void {
    const cutoff = Date.now() - assetTtlMs
    for (const [id, asset] of state.assets) {
      if (asset.createdAt < cutoff) {
        state.assets.delete(id)
        state.assetBytes -= asset.bytes.byteLength
      }
    }
  }

  return {
    port: 0,
    origin: '',
    inner: server,
    async close() {
      for (const state of states.values()) {
        for (const client of state.clients) client.response.end()
        state.clients.clear()
      }
      await new Promise<void>((resolve, reject) =>
        server.close(error => (error ? reject(error) : resolve())),
      )
    },
  }
}

const SUPPORTED_COMMANDS = new Set([
  'message.send',
  'changeset.propose',
  'approval.resolve',
])

function authorizeCommand(
  principal: AiPrincipal,
  command: Command,
  mode: 'live' | 'replay',
  publicReplay: boolean,
): { status: number; code: string; message: string } | undefined {
  if (publicReplay) {
    return {
      status: 403,
      code: 'AI_HOST_PUBLIC_REPLAY_READ_ONLY',
      message: 'The public replay demo is read-only.',
    }
  }
  if (mode === 'live') {
    return {
      status: 503,
      code: 'AI_HOST_LIVE_NOT_CONFIGURED',
      message: 'Live mode requires a configured authenticated provider.',
    }
  }
  // Fail closed for command types this Host does not implement. The mock host
  // accepts unknown commands by default, so this allowlist is the boundary.
  if (!SUPPORTED_COMMANDS.has(command.type)) {
    return {
      status: 400,
      code: 'AI_HOST_COMMAND_UNKNOWN',
      message: `Unsupported command type: ${String(command.type)}`,
    }
  }
  if (command.type === 'changeset.propose') {
    return requireAiRole(principal, ['editor', 'admin'])
      ? undefined
      : {
          status: 403,
          code: 'AI_HOST_FORBIDDEN',
          message: 'Changeset proposals require editor access.',
        }
  }
  if (command.type === 'approval.resolve') {
    return requireAiRole(principal, ['approver', 'admin'])
      ? undefined
      : {
          status: 403,
          code: 'AI_HOST_FORBIDDEN',
          message: 'Approval requires approver access.',
        }
  }
  return undefined
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(
          Object.assign(new Error('Tool execution timed out.'), {
            status: 504,
            code: 'AI_HOST_TOOL_TIMEOUT',
          }),
        )
      }, timeoutMs).unref?.()
    }),
  ])
}

function rawHeader(
  request: http.IncomingMessage,
  name: string,
): string | undefined {
  const value = request.headers[name]
  return Array.isArray(value) ? value[0] : value
}

function parseCursor(
  value: string | null | undefined,
  fallback: number,
): number | undefined {
  if (value === null || value === undefined || value === '') return fallback
  if (!/^\d{1,15}$/.test(value)) return undefined
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : undefined
}

/**
 * The Workbench nginx overwrites X-Forwarded-For with the direct client
 * address. Only enable trustProxy behind that proxy; otherwise the header is
 * spoofable and must not influence limits.
 */
function forwardedClientIp(request: http.IncomingMessage): string | undefined {
  const value = rawHeader(request, 'x-forwarded-for')
  if (!value) return undefined
  const first = value.split(',')[0]?.trim()
  return first && first.length <= 64 ? first : undefined
}

function sendJson(
  response: http.ServerResponse,
  status: number,
  body: unknown,
): void {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
  })
  response.end(JSON.stringify(body))
}

async function readJson(request: http.IncomingMessage): Promise<unknown> {
  const contentType = request.headers['content-type'] ?? ''
  if (!contentType.includes('application/json')) {
    throw Object.assign(new Error('Content-Type must be application/json.'), {
      status: 415,
      code: 'AI_HOST_JSON_REQUIRED',
    })
  }
  let size = 0
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.byteLength
    if (size > MAX_BODY_BYTES) {
      throw Object.assign(new Error('Request body is too large.'), {
        status: 413,
        code: 'AI_HOST_BODY_TOO_LARGE',
      })
    }
    chunks.push(buffer)
  }
  if (size === 0) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw Object.assign(new Error('Request body is not valid JSON.'), {
      status: 400,
      code: 'AI_HOST_INVALID_JSON',
    })
  }
}
