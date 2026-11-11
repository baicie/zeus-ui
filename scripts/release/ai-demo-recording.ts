/**
 * Records the AI demo stream from the real Host.
 *
 * The published Workbench runs on GitHub Pages, where no Host process exists.
 * Rather than invent conversational replies — which would make the demo a lie —
 * this boots `startAiHost` in-process, drives it over its own HTTP API exactly
 * as the browser does, and records the domain events it emits. The demo then
 * replays that recording through `createReplayHost`, the same adapter CI uses.
 *
 * What is recorded is what the Host produced: a user message, a proposed
 * changeset and its approval. No model call is simulated — this Host is the
 * reference service, not an LLM gateway.
 *
 * Usage:
 *   node --import tsx scripts/release/ai-demo-recording.mjs --out <file>
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { parseArgs } from 'node:util'

import { startAiHost } from '../../examples/ai-host/src/server'

const { values } = parseArgs({
  options: {
    out: { type: 'string' },
    'ui-commit': { type: 'string', default: 'unknown' },
  },
})

if (!values.out) throw new Error('--out is required')

const EDITOR_TOKEN = 'demo-editor-token-0123456789'
const APPROVER_TOKEN = 'demo-approver-token-0123456789'

const scratch = mkdtempSync(path.join(tmpdir(), 'zeus-ai-demo-'))
const tokens = [
  {
    token: EDITOR_TOKEN,
    tenantId: 'reference',
    userId: 'editor',
    role: 'editor' as const,
  },
  {
    token: APPROVER_TOKEN,
    tenantId: 'reference',
    userId: 'approver',
    role: 'approver' as const,
  },
]

const host = await startAiHost({
  port: 0,
  hostname: '127.0.0.1',
  databaseFile: path.join(scratch, 'ai.sqlite'),
  workspaceRoot: path.join(scratch, 'workspace'),
  tokens,
  mode: 'replay',
  allowedOrigins: [],
})

async function call<T>(
  pathname: string,
  token: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${host.origin}${pathname}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })
  if (!response.ok) {
    throw new Error(
      `${init.method ?? 'GET'} ${pathname} -> ${response.status}: ${await response.text()}`,
    )
  }
  return (await response.json()) as T
}

let seq = 0
function command(input: {
  type: string
  targetId: string
  payload: unknown
  targetKind?: string
}) {
  seq += 1
  return {
    schemaVersion: 2,
    commandId: `demo-command-${seq}`,
    idempotencyKey: `demo-idempotency-${seq}`,
    type: input.type,
    target: { kind: input.targetKind ?? 'conversation', id: input.targetId },
    payload: input.payload,
  }
}

try {
  // 1. A user message, so the thread has a real exchange to show.
  await call('/commands', EDITOR_TOKEN, {
    method: 'POST',
    body: JSON.stringify(
      command({
        type: 'message.send',
        targetId: 'workbench',
        payload: {
          text: '请把 notes/workbench.txt 更新为演示版本，并说明这次改动。',
        },
      }),
    ),
  })

  // 2. A changeset proposal: this is the approval surface, and it is the Host —
  //    not the demo — that decides it needs approval.
  await call('/commands', EDITOR_TOKEN, {
    method: 'POST',
    body: JSON.stringify(
      command({
        type: 'changeset.propose',
        targetId: 'workbench',
        payload: {
          files: [
            {
              path: 'notes/workbench.txt',
              content: 'Zeus AI Workbench demo workspace.\n',
            },
          ],
        },
      }),
    ),
  })

  const workspace = await call<{
    approvals: Array<{ id: string; revision: number }>
  }>('/workspace', EDITOR_TOKEN)
  const approval = workspace.approvals[0]
  if (!approval) throw new Error('the Host produced no approval to record')

  // 3. Approve it as a second principal: the recording then shows the real
  //    transition, including why self-approval is refused.
  await call('/approvals', APPROVER_TOKEN, {
    method: 'POST',
    body: JSON.stringify({
      id: approval.id,
      revision: approval.revision,
      approved: true,
    }),
  })

  const snapshot = await call<{ events: unknown[] }>(
    '/snapshots?streamId=reference',
    EDITOR_TOKEN,
  )

  const recording = {
    schema: 'zeus.ai-demo/v1',
    generatedAt: new Date().toISOString(),
    uiCommit: values['ui-commit'] ?? 'unknown',
    streamId: 'reference',
    events: snapshot.events,
  }

  writeFileSync(values.out, `${JSON.stringify(recording, null, 2)}\n`)
  console.info(
    `ai demo recording: ${snapshot.events.length} events -> ${values.out}`,
  )
} finally {
  await host.close()
  rmSync(scratch, { recursive: true, force: true })
}
