import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { createSseHostAdapter } from '@zeus-web/ai-adapters'

import { createCommand } from '@zeus-web/ai-core'
import { afterEach, describe, expect, it } from 'vitest'
import { startAiHost } from '../src/server'
import { createProtectedWorkspace } from '../src/workspace'

const running: Array<Awaited<ReturnType<typeof startAiHost>>> = []

afterEach(async () => {
  while (running.length > 0) await running.pop()!.close()
})

async function start(
  options: { databaseFile?: string; workspaceRoot?: string } = {},
) {
  const directory = mkdtempSync(path.join(tmpdir(), 'zeus-ai-host-'))
  const host = await startAiHost({
    databaseFile: options.databaseFile ?? path.join(directory, 'ai.sqlite'),
    workspaceRoot: options.workspaceRoot ?? path.join(directory, 'workspace'),
    port: 0,
    allowedOrigins: ['http://127.0.0.1:5190'],
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

async function post(origin: string, body: unknown) {
  return fetch(`${origin}/commands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('aI reference host protocol', () => {
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
    const directory = mkdtempSync(path.join(tmpdir(), 'zeus-ai-restart-'))
    const databaseFile = path.join(directory, 'ai.sqlite')
    const first = await start({ databaseFile })
    await post(first.origin, command())
    const snapshot = await fetch(`${first.origin}/snapshots?streamId=reference`)
    const snapshotBody = await snapshot.json()
    expect(snapshotBody.events.length).toBeGreaterThan(0)
    await first.close()
    running.splice(running.indexOf(first), 1)

    const second = await start({ databaseFile })
    const resumed = await fetch(
      `${second.origin}/streams/reference/events?after=${snapshotBody.events.at(-1).seq}`,
      { signal: AbortSignal.timeout(1500) },
    ).catch(error => error)
    expect(resumed instanceof Response || resumed instanceof Error).toBe(true)
    const replay = await fetch(`${second.origin}/snapshots?streamId=reference`)
    expect((await replay.json()).events.length).toBeGreaterThan(0)
    // Windows cannot remove a directory while SQLite still holds the database
    // handle, so close the restarted host before cleaning up the fixture.
    await second.close()
    running.splice(running.indexOf(second), 1)
    rmSync(directory, { recursive: true, force: true })
  })

  it('rejects traversal paths before writing a file', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'zeus-ai-path-'))
    const workspace = createProtectedWorkspace({
      id: 'reference',
      root: directory,
    })
    expect(() =>
      workspace.propose([{ path: '../escape.txt', content: 'no' }]),
    ).toThrow(/ZEUS_AI_WORKSPACE_PATH/)
    expect(() =>
      workspace.propose([{ path: '/tmp/absolute.txt', content: 'no' }]),
    ).toThrow(/ZEUS_AI_WORKSPACE_PATH/)
    rmSync(directory, { recursive: true, force: true })
  })

  it('requires the current approval revision exactly once', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'zeus-ai-approval-'))
    const workspace = createProtectedWorkspace({
      id: 'reference',
      root: directory,
    })
    const approval = workspace.propose([
      { path: 'hello.txt', content: 'approved' },
    ])
    expect((await workspace.resolve(approval.id, 999, 'approved')).code).toBe(
      'ZEUS_AI_APPROVAL_STALE',
    )
    expect((await workspace.resolve(approval.id, 1, 'approved')).status).toBe(
      'applied',
    )
    expect((await workspace.resolve(approval.id, 1, 'approved')).code).toBe(
      'ZEUS_AI_APPROVAL_RESOLVED',
    )
    rmSync(directory, { recursive: true, force: true })
  })

  it('serves the standard SSE adapter with command and event round-trip', async () => {
    const host = await start()
    const adapter = createSseHostAdapter({ baseUrl: host.origin })
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
