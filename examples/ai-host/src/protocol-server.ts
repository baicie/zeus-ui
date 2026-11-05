import type {
  AnyDomainEvent,
  ApprovalRequest,
  ChangeSet,
  Command,
  CommandAck,
  Message,
} from '@zeus-web/ai-core'

import type { PersistentHost } from './store'

import type { ProtectedWorkspace } from './workspace'
import { Buffer } from 'node:buffer'
import http from 'node:http'
import { countDiffLines, createUnifiedDiff } from './diff'

export interface AiHostServerOptions {
  readonly host: PersistentHost
  readonly workspace: ProtectedWorkspace
  readonly port?: number
  readonly hostname?: string
  readonly allowedOrigins?: readonly string[]
  readonly commandDelayMs?: number
}

export interface AiHostServer {
  readonly port: number
  readonly origin: string
  readonly inner: http.Server
  close: () => Promise<void>
}

const MAX_BODY_BYTES = 512 * 1024

interface StreamClient {
  readonly response: http.ServerResponse
  readonly streamId: string
  after: number
  closed: boolean
  pending: string
  flushScheduled: boolean
}

export function createAiHostServer(options: AiHostServerOptions): AiHostServer {
  const clients = new Set<StreamClient>()
  const knownConversations = new Set<string>()
  const assets = new Map<
    string,
    {
      readonly mimeType: string
      readonly bytes: Uint8Array
      readonly name: string
    }
  >()

  function emit<T extends AnyDomainEvent>(
    type: T['type'],
    entity: T['entity'],
    payload: T['payload'],
  ): void {
    const event = options.host.append(type, entity, payload) as T
    for (const client of clients) {
      if (event.streamId === client.streamId && event.seq > client.after) {
        client.after = event.seq
        writeEvent(client, event)
      }
    }
  }

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
    if (origin && allowed.length > 0 && !allowed.includes(origin)) {
      sendJson(response, 403, {
        error: { code: 'AI_HOST_ORIGIN', message: 'Origin is not allowed.' },
      })
      return
    }
    response.setHeader(
      'Access-Control-Allow-Origin',
      origin && allowed.includes(origin) ? origin : (allowed[0] ?? '*'),
    )
    response.setHeader('Vary', 'Origin')
    if (method === 'OPTIONS') {
      response.writeHead(204, {
        'Access-Control-Allow-Headers':
          'Content-Type, Last-Event-ID, Idempotency-Key',
        'Access-Control-Allow-Methods': 'GET, POST',
      })
      response.end()
      return
    }

    if (url.pathname === '/health' && method === 'GET') {
      sendJson(response, 200, { ok: true, workspace: options.workspace.id })
      return
    }
    if (url.pathname === '/assets' && method === 'POST') {
      const body = (await readJson(request)) as {
        name?: unknown
        mimeType?: unknown
        data?: unknown
      }
      const name = typeof body.name === 'string' ? body.name : ''
      const mimeType = typeof body.mimeType === 'string' ? body.mimeType : ''
      const data = typeof body.data === 'string' ? body.data : ''
      const allowed = new Set([
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
        !allowed.has(mimeType) ||
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
      const bytes = Buffer.from(data, 'base64')
      if (bytes.byteLength === 0 || bytes.byteLength > 128 * 1024) {
        sendJson(response, 413, {
          error: {
            code: 'AI_HOST_ASSET_SIZE',
            message: 'Asset exceeds the 128 KiB limit.',
          },
        })
        return
      }
      const id = `asset-${assets.size + 1}`
      assets.set(id, { mimeType, bytes: new Uint8Array(bytes), name })
      sendJson(response, 200, {
        asset: { id, mimeType, size: bytes.byteLength },
      })
      return
    }
    if (url.pathname === '/commands' && method === 'POST') {
      const command = (await readJson(request)) as Command
      const ack = await options.host.execute(command)
      await afterCommand(command, ack)
      sendJson(response, 200, ack)
      return
    }
    if (url.pathname === '/snapshots' && method === 'GET') {
      const streamId = url.searchParams.get('streamId') ?? 'reference'
      const after = Number(url.searchParams.get('after') ?? 0)
      const snapshot = await options.host.getSnapshot({
        kind: 'stream',
        id: streamId,
      })
      sendJson(response, 200, {
        ...snapshot,
        events: options.host.events(streamId, after),
      })
      return
    }
    if (/^\/assets\/[^/]+$/.test(url.pathname) && method === 'GET') {
      const id = decodeURIComponent(url.pathname.split('/')[2]!)
      const asset = assets.get(id)
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
      const files = await options.workspace.snapshot()
      const target = files.find(file => file.path === 'notes/workbench.txt')
      const passed = target !== undefined
      const outputId = `test-output-${Date.now()}`
      const output = passed
        ? 'workspace contains notes/workbench.txt'
        : 'workspace is missing notes/workbench.txt'
      assets.set(outputId, {
        mimeType: 'text/plain; charset=utf-8',
        bytes: new TextEncoder().encode(`${output}\n`),
        name: 'workbench-check.txt',
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
      const streamId = decodeURIComponent(url.pathname.split('/')[2]!)
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
        after: Number(
          rawHeader(request, 'last-event-id') ??
            url.searchParams.get('after') ??
            0,
        ),
        closed: false,
        pending: '',
        flushScheduled: false,
      }
      clients.add(client)
      request.on('close', () => {
        client.closed = true
        clients.delete(client)
      })
      for (const event of options.host.events(streamId, client.after)) {
        client.after = event.seq
        writeEvent(client, event)
      }
      return
    }
    if (url.pathname === '/workspace' && method === 'GET') {
      sendJson(response, 200, {
        workspace: options.workspace.id,
        files: await options.workspace.snapshot(),
        approvals: options.workspace.pending().map(item => ({
          id: item.id,
          executionId: item.executionId,
          revision: item.revision,
          title: item.title,
          summary: item.summary,
        })),
      })
      return
    }
    if (url.pathname === '/approvals' && method === 'POST') {
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
      const result = await options.workspace.resolve(
        body.id,
        body.revision,
        body.approved ? 'approved' : 'rejected',
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
    command: Command,
    ack: CommandAck,
  ): Promise<void> {
    if (!ack.accepted) return
    if (command.type === 'message.send') {
      if (!knownConversations.has(command.target.id)) {
        emit(
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
        knownConversations.add(command.target.id)
      }
      const payload = command.payload as {
        text?: unknown
        attachments?: Array<{ id?: unknown }>
      }
      const text = typeof payload.text === 'string' ? payload.text : ''
      const nextSeq = options.host.latestSeq('reference') + 1
      const attachmentParts = (payload.attachments ?? []).flatMap(
        (attachment, index) => {
          if (typeof attachment.id !== 'string') return []
          const asset = assets.get(attachment.id)
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
        createdAt: new Date(Date.now()).toISOString(),
      }
      emit('message.created', { kind: 'message', id: message.id }, { message })
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
        const approval = options.workspace.propose(files)
        emit(
          'execution.started',
          { kind: 'execution', id: approval.executionId },
          {
            execution: {
              id: approval.executionId,
              kind: 'agent',
              workspaceId: options.workspace.id,
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
            target: `workspace:${options.workspace.id}`,
          },
          scope: 'workspace',
          risk: 'high',
          status: 'pending',
          revision: approval.revision,
        }
        emit(
          'approval.requested',
          { kind: 'approval', id: approval.id },
          { approval: approvalRequest },
        )
        const changeSetFiles = approval.files.map((file, index) => {
          const diff = createUnifiedDiff({
            path: file.path,
            previous: file.previous,
            next: file.content,
          })
          const assetId = `${approval.id}-diff-${index}`
          const bytes = new TextEncoder().encode(diff)
          assets.set(assetId, {
            mimeType: 'text/x-diff; charset=utf-8',
            bytes,
            name: file.path,
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
          workspaceId: options.workspace.id,
          baseRevision: 'workspace-head',
          files: changeSetFiles,
          status: 'ready',
          revision: 1,
        }
        emit(
          'changeset.updated',
          { kind: 'changeset', id: changeSet.id },
          { changeset: changeSet },
        )
      } catch {
        emit(
          'execution.status.changed',
          { kind: 'execution', id: 'execution-1' },
          {
            id: 'execution-1',
            from: 'running',
            to: 'failed',
            revision: 2,
          },
        )
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
      const outcome = await options.workspace.resolve(
        command.target.id,
        command.expectedRevision,
        payload.decision,
      )
      emit(
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

  return {
    port: 0,
    origin: '',
    inner: server,
    async close() {
      for (const client of clients) client.response.end()
      clients.clear()
      await new Promise<void>((resolve, reject) =>
        server.close(error => (error ? reject(error) : resolve())),
      )
    },
  }
}

function rawHeader(
  request: http.IncomingMessage,
  name: string,
): string | undefined {
  const value = request.headers[name]
  return Array.isArray(value) ? value[0] : value
}

function sendJson(
  response: http.ServerResponse,
  status: number,
  body: unknown,
): void {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  response.end(JSON.stringify(body))
}

async function readJson(request: http.IncomingMessage): Promise<unknown> {
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
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}
