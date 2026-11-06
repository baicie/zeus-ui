import type { AiTokenConfig } from '../src/auth'
import type { AiTenantConfig } from '../src/server'
import { Buffer } from 'node:buffer'
import { mkdtempSync, rmSync } from 'node:fs'

import { tmpdir } from 'node:os'
import path from 'node:path'
import { createSseHostAdapter } from '@zeus-web/ai-adapters'

import { createCommand } from '@zeus-web/ai-core'
import { afterEach, describe, expect, it } from 'vitest'
import { startAiHost } from '../src/server'
import { createProtectedWorkspace } from '../src/workspace'

const EDITOR_TOKEN = 'editor-token-0123456789'
const APPROVER_TOKEN = 'approver-token-0123456789'
const VIEWER_TOKEN = 'viewer-token-0123456789'
const OTHER_TOKEN = 'other-tenant-token-0123456789'

const TOKENS: readonly AiTokenConfig[] = [
  {
    token: EDITOR_TOKEN,
    tenantId: 'reference',
    userId: 'editor',
    role: 'editor',
  },
  {
    token: APPROVER_TOKEN,
    tenantId: 'reference',
    userId: 'approver',
    role: 'approver',
  },
  {
    token: VIEWER_TOKEN,
    tenantId: 'reference',
    userId: 'viewer',
    role: 'viewer',
  },
  {
    token: OTHER_TOKEN,
    tenantId: 'other',
    userId: 'other-approver',
    role: 'approver',
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

function workspaceDirectory(): string {
  const directory = mkdtempSync(path.join(tmpdir(), 'zeus-ai-host-'))
  directories.push(directory)
  return directory
}

async function start(
  options: {
    databaseFile?: string
    workspaceRoot?: string
    tokens?: readonly AiTokenConfig[]
    tenants?: readonly AiTenantConfig[]
    mode?: 'live' | 'replay'
    maxRequestsPerMinute?: number
    maxAssetsPerTenant?: number
  } = {},
) {
  const directory = workspaceDirectory()
  const host = await startAiHost({
    databaseFile: options.databaseFile ?? path.join(directory, 'ai.sqlite'),
    workspaceRoot: options.workspaceRoot ?? path.join(directory, 'workspace'),
    port: 0,
    allowedOrigins: ['http://127.0.0.1:5190'],
    tokens: options.tokens ?? TOKENS,
    ...(options.tenants ? { tenants: options.tenants } : {}),
    ...(options.mode ? { mode: options.mode } : {}),
    ...(options.maxRequestsPerMinute === undefined
      ? {}
      : { maxRequestsPerMinute: options.maxRequestsPerMinute }),
    ...(options.maxAssetsPerTenant === undefined
      ? {}
      : { maxAssetsPerTenant: options.maxAssetsPerTenant }),
  })
  running.push(host)
  return host
}

function command(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 2,
    commandId: 'cmd-1',
    idempotencyKey: 'key-1',
    type: 'message.send',
    target: { kind: 'conversation', id: 'conversation-1' },
    payload: { text: 'hello' },
    ...overrides,
  }
}

function auth(token = EDITOR_TOKEN) {
  return { Authorization: `Bearer ${token}` }
}

async function post(origin: string, body: unknown, token = EDITOR_TOKEN) {
  return fetch(`${origin}/commands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth(token) },
    body: JSON.stringify(body),
  })
}

async function get(origin: string, pathname: string, token = EDITOR_TOKEN) {
  return fetch(`${origin}${pathname}`, { headers: auth(token) })
}

function proposeCommand(id = 'propose-1') {
  return {
    schemaVersion: 2,
    commandId: id,
    idempotencyKey: id,
    type: 'changeset.propose',
    target: { kind: 'workspace', id: 'reference' },
    payload: {
      files: [
        {
          path: `notes/${id}.txt`,
          content: 'approved through the protected AI host\n',
        },
      ],
    },
  }
}

describe('ai reference host security and protocol', () => {
  it('requires a bearer token and does not treat Origin as authentication', async () => {
    const host = await start()
    const unauthenticated = await fetch(`${host.origin}/commands`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://127.0.0.1:5190',
      },
      body: JSON.stringify(command()),
    })
    expect(unauthenticated.status).toBe(401)
    const noOrigin = await post(host.origin, command())
    expect(noOrigin.status).toBe(200)
    const workspaceWithoutToken = await fetch(`${host.origin}/workspace`)
    expect(workspaceWithoutToken.status).toBe(401)
  })

  it('accepts a valid command and replays the same ack for a retry', async () => {
    const host = await start()
    const first = await post(host.origin, command())
    expect(first.status).toBe(200)
    const ack = await first.json()
    expect(ack.accepted).toBe(true)
    const retry = await post(host.origin, command({ commandId: 'cmd-retry' }))
    expect((await retry.json()).operationId).toBe(ack.operationId)
  })

  it('rejects reusing an idempotency key for a different command', async () => {
    const host = await start()
    await post(host.origin, command())
    const conflict = await post(
      host.origin,
      command({ commandId: 'cmd-2', payload: { text: 'different' } }),
    )
    expect((await conflict.json()).code).toBe('AI_COMMAND_IDEMPOTENCY_CONFLICT')
  })

  it('replays events from the store cursor after a restart', async () => {
    const directory = workspaceDirectory()
    const databaseFile = path.join(directory, 'ai.sqlite')
    const first = await start({ databaseFile })
    await post(first.origin, command())
    const snapshot = await get(first.origin, '/snapshots?streamId=reference')
    const snapshotBody = await snapshot.json()
    expect(snapshotBody.events.length).toBeGreaterThan(0)
    await first.close()
    running.splice(running.indexOf(first), 1)

    const second = await start({ databaseFile })
    const replay = await get(second.origin, '/snapshots?streamId=reference')
    expect((await replay.json()).events.length).toBeGreaterThan(0)
    await second.close()
    running.splice(running.indexOf(second), 1)
  })

  it('rejects traversal paths before writing a file', () => {
    const directory = workspaceDirectory()
    const workspace = createProtectedWorkspace({
      id: 'reference',
      root: directory,
    })
    expect(() =>
      workspace.propose([{ path: '../escape.txt', content: 'no' }], 'editor'),
    ).toThrow(/ZEUS_AI_WORKSPACE_PATH/)
    expect(() =>
      workspace.propose(
        [{ path: '/tmp/absolute.txt', content: 'no' }],
        'editor',
      ),
    ).toThrow(/ZEUS_AI_WORKSPACE_PATH/)
  })

  it('requires an independent approver and resolves an approval exactly once', async () => {
    const directory = workspaceDirectory()
    const workspace = createProtectedWorkspace({
      id: 'reference',
      root: directory,
    })
    const approval = workspace.propose(
      [{ path: 'hello.txt', content: 'approved' }],
      'editor',
    )
    expect(
      (
        await workspace.resolve(approval.id, approval.revision, 'approved', {
          userId: 'editor',
          role: 'editor',
        })
      ).code,
    ).toBe('ZEUS_AI_APPROVAL_SELF')
    expect(
      (
        await workspace.resolve(approval.id, 999, 'approved', {
          userId: 'approver',
          role: 'approver',
        })
      ).code,
    ).toBe('ZEUS_AI_APPROVAL_STALE')
    expect(
      (
        await workspace.resolve(approval.id, 1, 'approved', {
          userId: 'approver',
          role: 'approver',
        })
      ).status,
    ).toBe('applied')
    expect(
      (
        await workspace.resolve(approval.id, 1, 'approved', {
          userId: 'approver',
          role: 'approver',
        })
      ).code,
    ).toBe('ZEUS_AI_APPROVAL_RESOLVED')
  })

  it('enforces roles and makes approval IDs non-transferable', async () => {
    const host = await start()
    const viewerProposal = await post(
      host.origin,
      proposeCommand('viewer-propose'),
      VIEWER_TOKEN,
    )
    expect(viewerProposal.status).toBe(403)
    const editorProposal = await post(
      host.origin,
      proposeCommand('editor-propose'),
    )
    expect(editorProposal.status).toBe(200)

    const workspace = (await (await get(host.origin, '/workspace')).json()) as {
      approvals: Array<{ id: string; revision: number }>
    }
    expect(workspace.approvals).toHaveLength(1)
    const approval = workspace.approvals[0]!
    const guessed = await fetch(`${host.origin}/approvals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth(APPROVER_TOKEN) },
      body: JSON.stringify({ id: 'approval-1', revision: 1, approved: true }),
    })
    expect(guessed.status).toBe(404)
    const viewerApproval = await fetch(`${host.origin}/approvals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth(VIEWER_TOKEN) },
      body: JSON.stringify({
        id: approval.id,
        revision: approval.revision,
        approved: true,
      }),
    })
    expect(viewerApproval.status).toBe(403)
    const approved = await fetch(`${host.origin}/approvals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth(APPROVER_TOKEN) },
      body: JSON.stringify({
        id: approval.id,
        revision: approval.revision,
        approved: true,
      }),
    })
    expect(approved.status).toBe(200)
    expect((await approved.json()).status).toBe('applied')
    const replay = await fetch(`${host.origin}/approvals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth(APPROVER_TOKEN) },
      body: JSON.stringify({
        id: approval.id,
        revision: approval.revision,
        approved: true,
      }),
    })
    expect(replay.status).toBe(409)
  })

  it('isolates tenants, streams, workspaces and approvals', async () => {
    const firstDirectory = workspaceDirectory()
    const secondDirectory = workspaceDirectory()
    const host = await start({
      tenants: [
        {
          id: 'reference',
          databaseFile: path.join(firstDirectory, 'ai.sqlite'),
          workspaceRoot: path.join(firstDirectory, 'workspace'),
        },
        {
          id: 'other',
          databaseFile: path.join(secondDirectory, 'ai.sqlite'),
          workspaceRoot: path.join(secondDirectory, 'workspace'),
        },
      ],
    })
    const proposal = await post(host.origin, proposeCommand('tenant-a'))
    expect(proposal.status).toBe(200)
    const ownWorkspace = (await (
      await get(host.origin, '/workspace')
    ).json()) as { workspace: string; approvals: Array<{ id: string }> }
    expect(ownWorkspace.workspace).toBe('reference')
    expect(ownWorkspace.approvals).toHaveLength(1)

    const otherWorkspace = (await (
      await get(host.origin, '/workspace', OTHER_TOKEN)
    ).json()) as { workspace: string; approvals: unknown[] }
    expect(otherWorkspace.workspace).toBe('other')
    expect(otherWorkspace.approvals).toEqual([])
    const crossTenant = await fetch(`${host.origin}/approvals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth(OTHER_TOKEN) },
      body: JSON.stringify({
        id: ownWorkspace.approvals[0]!.id,
        revision: 1,
        approved: true,
      }),
    })
    expect(crossTenant.status).toBe(404)
    const otherSnapshot = (await (
      await get(host.origin, '/snapshots?streamId=reference', OTHER_TOKEN)
    ).json()) as { events: unknown[] }
    expect(otherSnapshot.events).toEqual([])
  })

  it('enforces asset quotas and upload roles', async () => {
    const host = await start({
      maxRequestsPerMinute: 1000,
      maxAssetsPerTenant: 1,
    })
    const upload = (token: string, name: string) =>
      fetch(`${host.origin}/assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth(token) },
        body: JSON.stringify({
          name,
          mimeType: 'text/plain',
          data: Buffer.from('asset').toString('base64'),
        }),
      })
    expect((await upload(VIEWER_TOKEN, 'viewer.txt')).status).toBe(403)
    expect((await upload(EDITOR_TOKEN, 'one.txt')).status).toBe(200)
    expect((await upload(EDITOR_TOKEN, 'two.txt')).status).toBe(429)
  })

  it('rate-limits requests per tenant and user', async () => {
    const host = await start({ maxRequestsPerMinute: 2 })
    expect((await get(host.origin, '/workspace')).status).toBe(200)
    expect((await get(host.origin, '/workspace')).status).toBe(200)
    expect((await get(host.origin, '/workspace')).status).toBe(429)
  })

  it('rejects all commands in live mode without a configured provider', async () => {
    const host = await start({ mode: 'live' })
    const response = await post(host.origin, command())
    expect(response.status).toBe(503)
    expect((await response.json()).error.code).toBe(
      'AI_HOST_LIVE_NOT_CONFIGURED',
    )
  })

  it('persists pending approvals across workspace reopening', async () => {
    const directory = workspaceDirectory()
    const first = createProtectedWorkspace({ id: 'reference', root: directory })
    const approval = first.propose(
      [{ path: 'persisted.txt', content: 'persisted approval' }],
      'editor',
    )
    const reopened = createProtectedWorkspace({
      id: 'reference',
      root: directory,
    })
    expect(reopened.pending().map(item => item.id)).toContain(approval.id)
    const resolved = await reopened.resolve(
      approval.id,
      approval.revision,
      'approved',
      { userId: 'approver', role: 'approver' },
    )
    expect(resolved.status).toBe('applied')
  })

  it('serves the standard SSE adapter with command and event round-trip', async () => {
    const host = await start()
    const adapter = createSseHostAdapter({
      baseUrl: host.origin,
      headers: () => auth(),
    })
    const controller = new AbortController()
    const events: unknown[] = []
    const following = (async () => {
      for await (const event of adapter.subscribe(
        'reference',
        0,
        controller.signal,
      )) {
        events.push(event)
        if (events.length >= 2) return
      }
    })()
    const ack = await adapter.execute(
      createCommand({
        commandId: 'sse-command',
        idempotencyKey: 'sse-key',
        type: 'message.send',
        target: { kind: 'conversation', id: 'sse-conversation' },
        payload: { text: 'streamed' },
      }),
    )
    expect(ack.accepted).toBe(true)
    await Promise.race([
      following,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('SSE event timeout')), 2_000),
      ),
    ])
    controller.abort()
    expect(events.map((event: any) => event.type)).toEqual([
      'conversation.upserted',
      'message.created',
    ])
  })
})
