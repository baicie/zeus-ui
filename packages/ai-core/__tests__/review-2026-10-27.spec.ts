/**
 * Regression suite for the 2026-10-27 review of `@zeus-web/ai-core`.
 * Each `describe` maps to a finding in
 * `docs/ai-headless-v2/review-2026-10-27-ai-core.md`.
 */

import type {
  ApprovalRequest,
  ChangeSet,
  Execution,
  ExecutionStep,
  Message,
  ToolInvocation,
} from '../src/domain/types'
import type { AiStoreDiagnostic, AiStoreOptions } from '../src/store/store'

import { describe, expect, it } from 'vitest'
import { createEventFactory } from '../src/host/event-factory'
import {
  createS1ChatScenario,
  createS2AgentApprovalScenario,
  SCENARIO_FIXTURES,
} from '../src/host/fixtures'
import { createMockHost } from '../src/host/mock-host'
import { createReplayHost } from '../src/host/replay-host'
import {
  createCommand,
  createIdempotencyTracker,
  IDEMPOTENCY_KEY_REUSED,
  retryCommand,
  validateCommand,
} from '../src/protocol/commands'
import {
  isSafeRelativePath,
  validateDomainEvent,
} from '../src/protocol/validation'
import {
  selectExecutionSteps,
  selectPendingApprovals,
} from '../src/store/selectors'
import { checksumState } from '../src/store/snapshot'
import { createAiStore } from '../src/store/store'

const T = '2026-01-01T00:00:00.000Z'

function execution(overrides: Partial<Execution> = {}): Execution {
  return {
    id: 'exec-1',
    kind: 'agent',
    status: 'running',
    createdAt: T,
    revision: 1,
    activeStepIds: [],
    ...overrides,
  }
}

function approval(overrides: Partial<ApprovalRequest> = {}): ApprovalRequest {
  return {
    id: 'approval-1',
    executionId: 'exec-1',
    title: 'run shell',
    summary: 'pnpm test',
    operation: { kind: 'shell', target: 'workspace:ws/pnpm test' },
    scope: 'once',
    risk: 'high',
    status: 'pending',
    revision: 1,
    ...overrides,
  }
}

function message(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    conversationId: 'conv-1',
    author: 'assistant',
    parts: [{ id: 'p1', kind: 'text', revision: 1, text: '', format: 'plain' }],
    status: 'streaming',
    revision: 1,
    createdAt: T,
    ...overrides,
  }
}

function step(overrides: Partial<ExecutionStep> = {}): ExecutionStep {
  return {
    id: 'step-1',
    executionId: 'exec-1',
    kind: 'tool',
    status: 'running',
    label: 'run tests',
    ...overrides,
  }
}

function tool(overrides: Partial<ToolInvocation> = {}): ToolInvocation {
  return {
    id: 'tool-1',
    executionId: 'exec-1',
    toolName: 'shell',
    summary: 'pnpm test',
    status: 'running',
    ...overrides,
  }
}

function setup(options: Partial<AiStoreOptions> = {}) {
  const diagnostics: AiStoreDiagnostic[] = []
  const streamId = options.streamId ?? 'stream-review'
  const factory = createEventFactory(streamId)
  const store = createAiStore({
    streamId,
    onDiagnostic: entry => diagnostics.push(entry),
    ...options,
  })

  return { factory, store, diagnostics }
}

describe('review f1 · lifecycle cannot be bypassed by re-sending an entity', () => {
  it('does not revive a completed execution through execution.started', () => {
    const { factory, store } = setup()

    store.ingest(
      factory.create('execution.started', 'exec-1', { execution: execution() }),
    )
    store.ingest(
      factory.create('execution.status.changed', 'exec-1', {
        id: 'exec-1',
        from: 'running',
        to: 'completed',
        revision: 2,
      }),
    )

    const revive = store.ingest(
      factory.create('execution.started', 'exec-1', {
        execution: execution({ status: 'running', revision: 3 }),
      }),
    )

    expect(revive).toMatchObject({
      status: 'rejected',
      code: 'illegal-transition',
    })
    expect(store.getState().executions['exec-1'].status).toBe('completed')
  })

  it('keeps an execution bound to its conversation and kind', () => {
    const { factory, store } = setup()

    store.ingest(
      factory.create('conversation.upserted', 'conv-1', {
        conversation: { id: 'conv-1', title: 'c', revision: 1 },
      }),
    )
    store.ingest(
      factory.create('execution.started', 'exec-1', {
        execution: execution({ conversationId: 'conv-1' }),
      }),
    )

    expect(
      store.ingest(
        factory.create('execution.started', 'exec-1', {
          execution: execution({ conversationId: 'conv-2', revision: 2 }),
        }),
      ),
    ).toMatchObject({ status: 'rejected', code: 'immutable-field' })
  })

  it('refuses late step and tool frames that reopen a terminal status', () => {
    const { factory, store } = setup()

    store.ingest(
      factory.create('execution.started', 'exec-1', { execution: execution() }),
    )
    store.ingest(
      factory.create('step.upserted', 'step-1', {
        step: step({ status: 'completed' }),
      }),
    )

    expect(
      store.ingest(
        factory.create('step.upserted', 'step-1', {
          step: step({ status: 'running' }),
        }),
      ),
    ).toMatchObject({ status: 'rejected', code: 'illegal-transition' })

    const second = setup()
    second.store.ingest(
      second.factory.create('execution.started', 'exec-1', {
        execution: execution(),
      }),
    )
    second.store.ingest(
      second.factory.create('tool.upserted', 'tool-1', {
        tool: tool({ status: 'succeeded' }),
      }),
    )
    expect(
      second.store.ingest(
        second.factory.create('tool.upserted', 'tool-1', {
          tool: tool({ status: 'running' }),
        }),
      ),
    ).toMatchObject({ status: 'rejected', code: 'illegal-transition' })
  })

  it('never flips a finished message to another terminal outcome', () => {
    const { factory, store } = setup()

    store.ingest(
      factory.create('conversation.upserted', 'conv-1', {
        conversation: { id: 'conv-1', title: 'c', revision: 1 },
      }),
    )
    store.ingest(
      factory.create('message.created', 'msg-1', { message: message() }),
    )
    store.ingest(
      factory.create('message.completed', 'msg-1', {
        messageId: 'msg-1',
        revision: 2,
        status: 'complete',
      }),
    )

    expect(
      store.ingest(
        factory.create('message.completed', 'msg-1', {
          messageId: 'msg-1',
          revision: 3,
          status: 'failed',
        }),
      ),
    ).toMatchObject({ status: 'rejected', code: 'illegal-transition' })
  })

  it('does not reopen an applied change set', () => {
    const { factory, store } = setup()
    const changeset: ChangeSet = {
      id: 'cs-1',
      executionId: 'exec-1',
      workspaceId: 'ws',
      baseRevision: 'abc',
      files: [{ path: 'src/a.ts', status: 'modified' }],
      status: 'applied',
      revision: 1,
    }

    store.ingest(
      factory.create('execution.started', 'exec-1', { execution: execution() }),
    )
    store.ingest(factory.create('changeset.updated', 'cs-1', { changeset }))

    expect(
      store.ingest(
        factory.create('changeset.updated', 'cs-1', {
          changeset: { ...changeset, status: 'ready', revision: 2 },
        }),
      ),
    ).toMatchObject({ status: 'rejected', code: 'illegal-transition' })
  })
})

describe('review f2 · approvals are decided only by approval.resolved', () => {
  function withExecution() {
    const context = setup()
    context.store.ingest(
      context.factory.create('execution.started', 'exec-1', {
        execution: execution(),
      }),
    )
    return context
  }

  it('refuses a request that arrives already approved', () => {
    const { factory, store } = withExecution()

    expect(
      store.ingest(
        factory.create('approval.requested', 'approval-1', {
          approval: approval({ status: 'approved' }),
        }),
      ),
    ).toMatchObject({ status: 'rejected', code: 'illegal-transition' })
    expect(store.getState().approvals['approval-1']).toBeUndefined()
  })

  it('refuses scope escalation and status changes on re-request', () => {
    const { factory, store } = withExecution()

    store.ingest(
      factory.create('approval.requested', 'approval-1', {
        approval: approval(),
      }),
    )

    expect(
      store.ingest(
        factory.create('approval.requested', 'approval-1', {
          approval: approval({ scope: 'workspace', revision: 2 }),
        }),
      ),
    ).toMatchObject({ status: 'rejected', code: 'immutable-field' })
  })

  it('allows a re-request to refresh display text while pending', () => {
    const { factory, store } = withExecution()

    store.ingest(
      factory.create('approval.requested', 'approval-1', {
        approval: approval(),
      }),
    )

    expect(
      store.ingest(
        factory.create('approval.requested', 'approval-1', {
          approval: approval({ summary: 'pnpm test --run', revision: 2 }),
        }),
      ),
    ).toMatchObject({ status: 'applied' })
  })

  it('refuses an approval for an execution the stream never started', () => {
    const { factory, store } = setup()

    expect(
      store.ingest(
        factory.create('approval.requested', 'approval-1', {
          approval: approval(),
        }),
      ),
    ).toMatchObject({ status: 'rejected', code: 'reference-missing' })
  })

  it('refuses an approval that gates a tool of another execution', () => {
    const { factory, store } = withExecution()

    store.ingest(
      factory.create('execution.started', 'exec-2', {
        execution: execution({ id: 'exec-2' }),
      }),
    )
    store.ingest(
      factory.create('tool.upserted', 'tool-2', {
        tool: tool({ id: 'tool-2', executionId: 'exec-2' }),
      }),
    )

    expect(
      store.ingest(
        factory.create('approval.requested', 'approval-1', {
          approval: approval({ toolInvocationId: 'tool-2' }),
        }),
      ),
    ).toMatchObject({ status: 'rejected', code: 'reference-mismatch' })
  })
})

describe('review f3 · a broken seq halts the stream explicitly', () => {
  function badDelta(factory: ReturnType<typeof createEventFactory>) {
    return factory.create('message.part.delta', 'msg-x', {
      messageId: 'msg-x',
      partId: 'p',
      baseRevision: 1,
      nextRevision: 2,
      append: 'x',
    })
  }

  it('reports snapshot-required instead of stalling as a fake gap', () => {
    const { factory, store, diagnostics } = setup()
    const broken = badDelta(factory)
    const next = factory.create('conversation.upserted', 'conv-1', {
      conversation: { id: 'conv-1', title: 'c', revision: 1 },
    })

    expect(store.ingest(broken)).toMatchObject({
      status: 'rejected',
      code: 'entity-missing',
      recovery: 'snapshot-required',
    })
    expect(store.ingest(next)).toMatchObject({
      status: 'desynced',
      halt: { seq: 1, code: 'entity-missing' },
    })
    expect(store.getCursor()).toBe(0)
    expect(store.getSyncState()).toMatchObject({
      status: 'desynced',
      cursor: 0,
    })
    expect(diagnostics.some(entry => entry.code === 'stream-desynced')).toBe(
      true,
    )
    expect(diagnostics.some(entry => entry.code === 'gap-detected')).toBe(false)
  })

  it('does not silently skip a buffered event that cannot be applied', () => {
    const { factory, store } = setup()
    const first = factory.create('conversation.upserted', 'conv-1', {
      conversation: { id: 'conv-1', title: 'c', revision: 1 },
    })
    const broken = badDelta(factory)

    expect(store.ingest(broken)).toMatchObject({ status: 'gap' })

    const result = store.ingest(first)

    expect(result).toMatchObject({
      status: 'applied',
      appliedSeqs: [1],
      halted: { seq: 2, code: 'entity-missing' },
    })
    expect(store.getCursor()).toBe(1)
    expect(store.getSyncState()).toMatchObject({
      status: 'desynced',
      pendingSeqs: [2],
    })
  })

  it('halts on an unreadable event at the next seq', () => {
    const { factory, store } = setup()
    const event = factory.create('conversation.upserted', 'conv-1', {
      conversation: { id: 'conv-1', title: 'c', revision: 1 },
    })

    expect(
      store.ingest({ ...event, type: 'conversation.archived' }),
    ).toMatchObject({
      status: 'quarantined',
      recovery: 'snapshot-required',
    })
    expect(store.getSyncState().status).toBe('desynced')
  })

  it('recovers from a host snapshot and drains events buffered past it', async () => {
    const host = createMockHost({ streamId: 'stream-review' })
    const { store } = setup()

    host.emit('conversation.upserted', 'conv-1', {
      conversation: { id: 'conv-1', title: 'c', revision: 1 },
    })
    const broken = {
      ...host.emit('conversation.upserted', 'conv-1', {
        conversation: { id: 'conv-1', title: 'c2', revision: 2 },
      }),
    }
    const snapshot = await host.getSnapshot({
      kind: 'conversation',
      id: 'conv-1',
    })
    const after = host.emit('conversation.upserted', 'conv-1', {
      conversation: { id: 'conv-1', title: 'c3', revision: 3 },
    })

    store.ingest(host.events()[0])
    // The client receives a corrupted copy of seq 2 and halts.
    store.ingest({ ...broken, payload: { conversation: null } })
    expect(store.ingest(after)).toMatchObject({ status: 'desynced' })

    expect(store.loadHostSnapshot(snapshot, T)).toMatchObject({ ok: true })
    expect(store.getSyncState()).toMatchObject({ status: 'live', cursor: 3 })
    expect(store.getState().conversations['conv-1'].title).toBe('c3')
  })
})

describe('review f4 · validation is structural and bound to the envelope', () => {
  it('rejects a null entity instead of throwing from the reducer', () => {
    const { factory, store } = setup()
    const event = factory.create('message.created', 'msg-1', { message: null })

    expect(() => store.ingest(event)).not.toThrow()
    expect(validateDomainEvent(event)).toMatchObject({
      ok: false,
      code: 'invalid-payload',
      field: 'payload.message',
    })
  })

  it('rejects an envelope that targets a different entity than its payload', () => {
    const factory = createEventFactory('s')
    const event = factory.create('conversation.upserted', 'conv-other', {
      conversation: { id: 'conv-victim', title: 'x', revision: 1 },
    })

    expect(validateDomainEvent(event)).toMatchObject({
      ok: false,
      code: 'entity-id-mismatch',
    })
  })

  it('requires exactly one of append or replace and unique part ids', () => {
    const factory = createEventFactory('s')

    expect(
      validateDomainEvent(
        factory.create('message.part.delta', 'm', {
          messageId: 'm',
          partId: 'p',
          baseRevision: 1,
          nextRevision: 2,
          append: 'a',
          replace: 'b',
        }),
      ),
    ).toMatchObject({ ok: false, code: 'invalid-payload' })

    const duplicated = message({
      parts: [
        { id: 'p', kind: 'text', revision: 1, text: '', format: 'plain' },
        { id: 'p', kind: 'text', revision: 1, text: '', format: 'plain' },
      ],
    })
    expect(
      validateDomainEvent(
        factory.create('message.created', 'msg-1', { message: duplicated }),
      ),
    ).toMatchObject({ ok: false, code: 'invalid-payload' })
  })

  it('keeps hostile change-set paths out of canonical state', () => {
    for (const path of [
      '../etc/passwd',
      'src/../../x',
      '/etc/passwd',
      '~/.ssh/id',
      'C:\\x',
      'a\nb',
      '',
    ]) {
      expect(isSafeRelativePath(path)).toBe(false)
    }
    expect(isSafeRelativePath('packages/ai-core/src/index.ts')).toBe(true)
    expect(isSafeRelativePath('docs/..hidden/file.md')).toBe(true)

    const factory = createEventFactory('s')
    const event = factory.create('changeset.updated', 'cs-1', {
      changeset: {
        id: 'cs-1',
        executionId: 'exec-1',
        workspaceId: 'ws',
        baseRevision: 'abc',
        files: [{ path: '../../outside', status: 'modified' }],
        status: 'ready',
        revision: 1,
      },
    })
    expect(validateDomainEvent(event)).toMatchObject({
      ok: false,
      code: 'invalid-payload',
      field: 'payload.changeset.files[0].path',
    })
  })
})

describe('review f5 · scoped stores refuse foreign conversations and executions', () => {
  it('rejects a message of another conversation on a conversation stream', () => {
    const { factory, store } = setup({
      scope: { kind: 'conversation', id: 'conv-1' },
    })

    store.ingest(
      factory.create('conversation.upserted', 'conv-1', {
        conversation: { id: 'conv-1', title: 'mine', revision: 1 },
      }),
    )
    store.ingest(
      factory.create('conversation.upserted', 'conv-2', {
        conversation: { id: 'conv-2', title: 'theirs', revision: 1 },
      }),
    )

    expect(store.getState().conversations['conv-2']).toBeUndefined()
    expect(store.getSyncState()).toMatchObject({
      status: 'desynced',
      halt: { code: 'out-of-scope' },
    })
  })

  it('rejects children of another execution on an execution stream', () => {
    const { factory, store } = setup({
      scope: { kind: 'execution', id: 'exec-1' },
    })

    store.ingest(
      factory.create('execution.started', 'exec-1', { execution: execution() }),
    )

    expect(
      store.ingest(
        factory.create('step.upserted', 'step-9', {
          step: step({ id: 'step-9', executionId: 'exec-9' }),
        }),
      ),
    ).toMatchObject({ status: 'rejected', code: 'out-of-scope' })
  })

  it('refuses a snapshot that carries entities outside the scope', () => {
    const fixture = createS1ChatScenario()
    const source = createAiStore({ streamId: fixture.streamId })
    fixture.events.forEach(event => source.ingest(event))

    const scoped = createAiStore({
      streamId: fixture.streamId,
      scope: { kind: 'conversation', id: 'conv-other' },
    })

    expect(scoped.loadSnapshot(source.exportSnapshot(T))).toMatchObject({
      ok: false,
      code: 'scope-mismatch',
    })
  })

  it('replays every recorded scenario under its natural scope', () => {
    const scopes = [
      { kind: 'conversation', id: 'conv-s1' },
      { kind: 'conversation', id: 'conv-s2' },
      { kind: 'execution', id: 'exec-s3' },
    ] as const

    SCENARIO_FIXTURES.forEach((fixture, index) => {
      const store = createAiStore({
        streamId: fixture.streamId,
        scope: scopes[index],
      })
      fixture.events.forEach(event => store.ingest(event))
      expect(store.getSyncState()).toMatchObject({
        status: 'live',
        cursor: fixture.events.length,
      })
    })
  })
})

describe('review f6 · an idempotency key executes at most once', () => {
  const input = {
    commandId: 'cmd-1',
    idempotencyKey: 'idem-approve-1',
    type: 'approval.resolve',
    target: { kind: 'approval', id: 'approval-1' },
    payload: { decision: 'approved' },
  }

  it('replays the recorded ack on retry instead of executing again', async () => {
    const host = createMockHost()
    const command = createCommand(input)

    const first = await host.execute(command)
    const retry = await host.execute(retryCommand(command, 'cmd-2'))

    expect(host.commands()).toHaveLength(1)
    expect(retry).toEqual({ ...first, commandId: 'cmd-2' })
  })

  it('shares one attempt between concurrent duplicates', async () => {
    let calls = 0
    const host = createMockHost({
      onExecute: async () => {
        calls += 1
        await Promise.resolve()
        return undefined
      },
    })
    const command = createCommand(input)

    const [left, right] = await Promise.all([
      host.execute(command),
      host.execute(retryCommand(command, 'cmd-2')),
    ])

    expect(calls).toBe(1)
    expect(left).toMatchObject({ accepted: true })
    expect(right).toMatchObject({ accepted: true, commandId: 'cmd-2' })
  })

  it('refuses a key reused for a different command', async () => {
    const host = createMockHost()

    await host.execute(createCommand(input))
    const reused = await host.execute(
      createCommand({
        ...input,
        commandId: 'cmd-3',
        payload: { decision: 'rejected' },
      }),
    )

    expect(reused).toMatchObject({
      accepted: false,
      code: IDEMPOTENCY_KEY_REUSED,
    })
    expect(host.commands()).toHaveLength(1)
  })

  it('lets a retry execute after a transport failure', async () => {
    let failures = 1
    const host = createMockHost({
      onExecute: () => {
        if (failures > 0) {
          failures -= 1
          throw new Error('socket hang up')
        }
        return undefined
      },
    })
    const command = createCommand(input)

    await expect(host.execute(command)).rejects.toThrow('socket hang up')
    await expect(
      host.execute(retryCommand(command, 'cmd-2')),
    ).resolves.toMatchObject({
      accepted: true,
    })
  })

  it('never evicts an in-flight key from the tracker', () => {
    const tracker = createIdempotencyTracker({ limit: 1 })
    const pending = createCommand(input)

    tracker.begin(pending)

    for (let index = 0; index < 3; index += 1) {
      const other = createCommand({
        ...input,
        idempotencyKey: `other-${index}`,
      })
      tracker.begin(other)
      tracker.acknowledge(other, {
        accepted: true,
        commandId: other.commandId,
        operationId: `op-${index}`,
      })
    }

    expect(tracker.begin(retryCommand(pending, 'cmd-9'))).toEqual({
      kind: 'in-flight',
    })
  })

  it('validates command targets and expected revisions', () => {
    const command = createCommand(input)

    expect(
      validateCommand({ ...command, target: { kind: 'approval', id: '' } }),
    ).toMatchObject({
      ok: false,
    })
    expect(validateCommand({ ...command, expectedRevision: -1 })).toMatchObject(
      { ok: false },
    )
  })
})

describe('review f7 · host snapshots are consistent with their cursor', () => {
  it('serves the folded state of the recording, not an empty state', async () => {
    const fixture = createS1ChatScenario()
    const host = createReplayHost(fixture.events)
    const snapshot = await host.getSnapshot({
      kind: 'conversation',
      id: 'conv-s1',
    })

    const replayed = createAiStore({ streamId: fixture.streamId })
    for await (const event of host.subscribe(fixture.streamId, 0)) {
      replayed.ingest(event)
    }

    const restored = createAiStore({ streamId: fixture.streamId })
    expect(restored.loadHostSnapshot(snapshot, T)).toMatchObject({ ok: true })
    expect(restored.getCursor()).toBe(fixture.events.length)
    expect(checksumState(restored.getState())).toBe(
      checksumState(replayed.getState()),
    )
    expect(snapshot.checksum).toBe(checksumState(replayed.getState()))
  })

  it('refuses to publish a snapshot for a stream it cannot fold', async () => {
    const host = createMockHost({ streamId: 's' })
    host.emit('message.part.delta', 'm', {
      messageId: 'm',
      partId: 'p',
      baseRevision: 1,
      nextRevision: 2,
      append: 'x',
    })

    await expect(
      host.getSnapshot({ kind: 'conversation', id: 'c' }),
    ).rejects.toThrow('AI_HOST_SNAPSHOT_UNAVAILABLE')
  })

  it('rejects a snapshot whose envelope cursors disagree with its state', () => {
    const { store } = setup()
    const snapshot = store.exportSnapshot(T)

    expect(
      store.loadSnapshot({ ...snapshot, cursors: { 'stream-review': 99 } }),
    ).toMatchObject({ ok: false, code: 'invalid-state' })

    const { messages: _messages, ...withoutMessages } = snapshot.state
    expect(
      store.loadSnapshot({ ...snapshot, state: withoutMessages }),
    ).toMatchObject({
      ok: false,
      code: 'invalid-state',
    })
  })
})

describe('review f8 · selectors stay correct and quiet', () => {
  it('lists every step an execution produced', () => {
    const fixture = createS2AgentApprovalScenario()
    const store = createAiStore({ streamId: fixture.streamId })
    fixture.events.forEach(event => store.ingest(event))

    expect(
      selectExecutionSteps(store.getState(), 'exec-s2').map(entry => entry.id),
    ).toEqual(['step-s2-plan'])
  })

  it('does not notify the pending-approvals view on every token', () => {
    const { factory, store } = setup()

    store.ingest(
      factory.create('conversation.upserted', 'conv-1', {
        conversation: { id: 'conv-1', title: 'c', revision: 1 },
      }),
    )
    store.ingest(
      factory.create('execution.started', 'exec-1', { execution: execution() }),
    )
    store.ingest(
      factory.create('approval.requested', 'approval-1', {
        approval: approval(),
      }),
    )
    store.ingest(
      factory.create('message.created', 'msg-1', { message: message() }),
    )

    const notifications: unknown[] = []
    store.subscribe(selectPendingApprovals, value => notifications.push(value))

    for (let revision = 1; revision <= 5; revision += 1) {
      store.ingest(
        factory.create('message.part.delta', 'msg-1', {
          messageId: 'msg-1',
          partId: 'p1',
          baseRevision: revision,
          nextRevision: revision + 1,
          append: 't',
        }),
      )
    }

    expect(notifications).toHaveLength(0)
  })

  it('keeps notifying other views when one listener throws', () => {
    const { factory, store, diagnostics } = setup()
    const seen: unknown[] = []

    store.subscribe(
      state => state.conversations,
      () => {
        throw new Error('view crashed')
      },
    )
    store.subscribe(
      state => state.conversations,
      value => seen.push(value),
    )

    store.ingest(
      factory.create('conversation.upserted', 'conv-1', {
        conversation: { id: 'conv-1', title: 'c', revision: 1 },
      }),
    )

    expect(seen).toHaveLength(1)
    expect(diagnostics.some(entry => entry.code === 'listener-error')).toBe(
      true,
    )
  })
})
