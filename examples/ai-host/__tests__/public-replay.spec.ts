import type { AiTokenConfig } from '../src/auth'
import { Buffer } from 'node:buffer'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'
import { startAiHost } from '../src/server'

const VIEWER_A = 'viewer-a-token-0123456789'
const VIEWER_B = 'viewer-b-token-0123456789'
const EDITOR = 'editor-token-0123456789'
const OTHER = 'other-tenant-token-0123456789'

const TOKENS: readonly AiTokenConfig[] = [
  {
    token: VIEWER_A,
    tenantId: 'reference',
    userId: 'viewer-a',
    role: 'viewer',
  },
  {
    token: VIEWER_B,
    tenantId: 'reference',
    userId: 'viewer-b',
    role: 'viewer',
  },
  { token: EDITOR, tenantId: 'reference', userId: 'editor', role: 'editor' },
  {
    token: OTHER,
    tenantId: 'other',
    userId: 'other-viewer',
    role: 'viewer',
  },
]

const running: Array<Awaited<ReturnType<typeof startAiHost>>> = []
const directories: string[] = []

afterEach(async () => {
  while (running.length > 0) await running.pop()!.close()
  while (directories.length > 0) {
    rmSync(directories.pop()!, { recursive: true, force: true })
  }
})

function directory(): string {
  const value = mkdtempSync(path.join(tmpdir(), 'zeus-ai-public-'))
  directories.push(value)
  return value
}

async function start(
  options: {
    databaseFile?: string
    publicReplay?: boolean
    maxRequestsPerMinute?: number
    maxSseClientsPerIp?: number
    trustProxy?: boolean
    tenants?: Array<{
      id: string
      databaseFile: string
      workspaceRoot: string
    }>
  } = {},
) {
  const root = directory()
  const host = await startAiHost({
    databaseFile: options.databaseFile ?? path.join(root, 'ai.sqlite'),
    workspaceRoot: path.join(root, 'workspace'),
    port: 0,
    allowedOrigins: ['https://ai.example.test:8443'],
    tokens: TOKENS,
    publicReplay: options.publicReplay ?? true,
    trustProxy: options.trustProxy ?? true,
    ...(options.maxRequestsPerMinute === undefined
      ? {}
      : { maxRequestsPerMinute: options.maxRequestsPerMinute }),
    ...(options.maxSseClientsPerIp === undefined
      ? {}
      : { maxSseClientsPerIp: options.maxSseClientsPerIp }),
    ...(options.tenants ? { tenants: options.tenants } : {}),
  })
  running.push(host)
  return host
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` }
}

let hostOrigin = ''

function command(text: string, key: string, token = VIEWER_A) {
  return fetch(`${hostOrigin}/commands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth(token) },
    body: JSON.stringify({
      schemaVersion: 2,
      commandId: key,
      idempotencyKey: key,
      type: 'message.send',
      target: { kind: 'conversation', id: 'workbench' },
      payload: { text },
    }),
  })
}

async function get(pathname: string, token = VIEWER_A) {
  return fetch(`${hostOrigin}${pathname}`, {
    headers: { ...auth(token), Origin: 'https://ai.example.test:8443' },
  })
}

async function snapshot(token = VIEWER_A) {
  const response = await get('/snapshots?streamId=reference', token)
  return (await response.json()) as {
    events: Array<{
      type: string
      payload: { message?: { parts?: Array<{ text?: string }> } }
    }>
  }
}

async function readSse(after: number, token = VIEWER_A): Promise<string[]> {
  const controller = new AbortController()
  const response = await fetch(
    `${hostOrigin}/streams/reference/events?after=${after}`,
    {
      headers: { ...auth(token), Origin: 'https://ai.example.test:8443' },
      signal: controller.signal,
    },
  )
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  const lines: string[] = []
  try {
    while (lines.length < 8) {
      const { value, done } = await reader.read()
      if (done) break
      lines.push(...decoder.decode(value, { stream: true }).split('\n'))
      if (lines.some(line => line.startsWith('data: '))) break
    }
  } finally {
    controller.abort()
    await reader.cancel().catch(() => {})
  }
  return lines
}

describe('public replay isolation', () => {
  it('serves a seeded read-only reference conversation', async () => {
    const host = await start()
    hostOrigin = host.origin
    const health = (await (await fetch(`${host.origin}/health`)).json()) as {
      ok: boolean
      readOnly: boolean
      interactive: boolean
      publicReplay: boolean
      mode: string
    }
    expect(health).toMatchObject({
      ok: true,
      readOnly: true,
      interactive: false,
      publicReplay: true,
      mode: 'replay',
    })
    const body = await snapshot()
    expect(body.events.map(event => event.type)).toEqual([
      'conversation.upserted',
      'message.created',
      'message.created',
    ])
    expect(
      JSON.stringify(body.events).includes('read-only replay of the reference'),
    ).toBe(true)
  })

  it('rejects every viewer write and never persists a visitor message', async () => {
    const host = await start()
    hostOrigin = host.origin
    const before = await snapshot()
    const response = await command('secret-from-viewer-a', 'public-write-a')
    expect(response.status).toBe(403)
    expect((await response.json()).error.code).toBe(
      'AI_HOST_PUBLIC_REPLAY_READ_ONLY',
    )
    const after = await snapshot()
    expect(after.events.length).toBe(before.events.length)
    expect(JSON.stringify(after)).not.toContain('secret-from-viewer-a')
  })

  it('keeps A and B unable to see each other through snapshot or SSE', async () => {
    const host = await start()
    hostOrigin = host.origin
    const write = await command('secret-from-viewer-a', 'public-write-ab')
    expect(write.status).toBe(403)

    const bSnapshot = await snapshot(VIEWER_B)
    expect(JSON.stringify(bSnapshot)).not.toContain('secret-from-viewer-a')
    expect(bSnapshot.events.length).toBe(3)

    const first = await readSse(0, VIEWER_B)
    expect(JSON.stringify(first)).not.toContain('secret-from-viewer-a')
    expect(JSON.stringify(first)).toContain('message.created')

    const second = await readSse(0, VIEWER_A)
    expect(JSON.stringify(second)).not.toContain('secret-from-viewer-a')
  })

  it('rejects arbitrary streams and invalid cursors', async () => {
    const host = await start()
    hostOrigin = host.origin
    expect((await get('/snapshots?streamId=private-a')).status).toBe(404)
    expect((await get('/streams/private-a/events')).status).toBe(404)
    expect((await get('/snapshots?streamId=reference&after=-1')).status).toBe(
      400,
    )
    const sse = await fetch(
      `${host.origin}/streams/reference/events?after=not-a-number`,
      { headers: auth(VIEWER_A) },
    )
    expect(sse.status).toBe(400)
  })

  it('blocks propose, approve, uploads and test reports even for editors and approvers', async () => {
    const host = await start()
    hostOrigin = host.origin
    const propose = await fetch(`${host.origin}/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth(EDITOR) },
      body: JSON.stringify({
        schemaVersion: 2,
        commandId: 'propose-public',
        idempotencyKey: 'propose-public',
        type: 'changeset.propose',
        target: { kind: 'workspace', id: 'reference' },
        payload: { files: [{ path: 'notes/public.txt', content: 'no' }] },
      }),
    })
    expect(propose.status).toBe(403)

    const approve = await fetch(`${host.origin}/approvals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth(EDITOR) },
      body: JSON.stringify({ id: 'approval-1', revision: 1, approved: true }),
    })
    expect(approve.status).toBe(403)

    const upload = await fetch(`${host.origin}/assets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth(EDITOR) },
      body: JSON.stringify({
        name: 'public.txt',
        mimeType: 'text/plain',
        data: Buffer.from('asset').toString('base64'),
      }),
    })
    expect(upload.status).toBe(403)
    expect((await get('/assets/asset-1', EDITOR)).status).toBe(404)

    const report = await fetch(`${host.origin}/test-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth(EDITOR) },
      body: '{}',
    })
    expect(report.status).toBe(403)
  })

  it('keeps authentication and Origin boundaries', async () => {
    const host = await start()
    hostOrigin = host.origin
    expect((await fetch(`${host.origin}/workspace`)).status).toBe(401)
    expect((await get('/workspace')).status).toBe(200)
    const noOrigin = await fetch(`${host.origin}/workspace`, {
      headers: auth(VIEWER_A),
    })
    expect(noOrigin.status).toBe(200)
    const badOrigin = await fetch(`${host.origin}/workspace`, {
      headers: {
        ...auth(VIEWER_A),
        Origin: 'https://evil.example.test',
      },
    })
    expect(badOrigin.status).toBe(403)
    expect(badOrigin.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('rejects cross-tenant reads and writes', async () => {
    const root = directory()
    const host = await start({
      tenants: [
        {
          id: 'reference',
          databaseFile: path.join(root, 'reference.sqlite'),
          workspaceRoot: path.join(root, 'reference-workspace'),
        },
        {
          id: 'other',
          databaseFile: path.join(root, 'other.sqlite'),
          workspaceRoot: path.join(root, 'other-workspace'),
        },
      ],
    })
    hostOrigin = host.origin
    const own = await snapshot(VIEWER_A)
    const other = await snapshot(OTHER)
    expect(own.events.length).toBe(3)
    expect(other.events.length).toBe(3)
    const crossWrite = await command('cross', 'cross-write', OTHER)
    expect(crossWrite.status).toBe(403)
    const crossAsset = await fetch(`${host.origin}/assets/asset-x`, {
      headers: auth(OTHER),
    })
    expect(crossAsset.status).toBe(404)
  })

  it('clears visitor messages persisted by an earlier writable deployment', async () => {
    const root = directory()
    const databaseFile = path.join(root, 'ai.sqlite')
    const legacy = await startAiHost({
      databaseFile,
      workspaceRoot: path.join(root, 'workspace'),
      port: 0,
      allowedOrigins: [],
      tokens: TOKENS,
      publicReplay: false,
      mode: 'replay',
    })
    running.push(legacy)
    const legacyWrite = await fetch(`${legacy.origin}/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth(VIEWER_A) },
      body: JSON.stringify({
        schemaVersion: 2,
        commandId: 'legacy',
        idempotencyKey: 'legacy',
        type: 'message.send',
        target: { kind: 'conversation', id: 'workbench' },
        payload: { text: 'legacy-visitor-secret' },
      }),
    })
    expect(legacyWrite.status).toBe(200)

    const host = await start({ databaseFile })
    hostOrigin = host.origin
    const body = await snapshot()
    expect(JSON.stringify(body)).not.toContain('legacy-visitor-secret')
    expect(body.events.length).toBe(3)
  })

  it('enforces per-IP SSE and request limits behind the proxy', async () => {
    const host = await start({
      maxRequestsPerMinute: 3,
      maxSseClientsPerIp: 1,
    })
    hostOrigin = host.origin
    const headers = {
      ...auth(VIEWER_A),
      'X-Forwarded-For': '203.0.113.10',
    }
    const first = await fetch(
      `${host.origin}/streams/reference/events?after=0`,
      {
        headers,
      },
    )
    expect(first.status).toBe(200)
    const reader = first.body!.getReader()
    await reader.read()
    const second = await fetch(
      `${host.origin}/streams/reference/events?after=0`,
      { headers },
    )
    expect(second.status).toBe(429)
    await reader.cancel().catch(() => {})

    const ipB = { ...headers, 'X-Forwarded-For': '203.0.113.11' }
    expect(
      (
        await fetch(`${host.origin}/snapshots?streamId=reference`, {
          headers: ipB,
        })
      ).status,
    ).toBe(200)
  })

  it('fails closed for unsupported command types in writable mode', async () => {
    const root = directory()
    const host = await startAiHost({
      databaseFile: path.join(root, 'ai.sqlite'),
      workspaceRoot: path.join(root, 'workspace'),
      port: 0,
      allowedOrigins: [],
      tokens: TOKENS,
      publicReplay: false,
      mode: 'replay',
    })
    running.push(host)
    hostOrigin = host.origin
    const response = await fetch(`${host.origin}/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth(EDITOR) },
      body: JSON.stringify({
        schemaVersion: 2,
        commandId: 'unknown',
        idempotencyKey: 'unknown',
        type: 'workspace.delete-everything',
        target: { kind: 'workspace', id: 'reference' },
        payload: {},
      }),
    })
    expect(response.status).toBe(400)
    expect((await response.json()).error.code).toBe('AI_HOST_COMMAND_UNKNOWN')
  })
})
