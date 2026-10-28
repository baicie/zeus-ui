/**
 * Scripted, in-browser trusted host for the S1 / S2 / S3 stories.
 *
 * It plays the server's role faithfully enough to exercise the client
 * contract: commands are validated and idempotent (via the mock host),
 * answers stream as revisioned deltas, approvals are checked against the
 * current revision and status before anything runs, a rejection never
 * reports success, and applying a change set conflicts once until it is
 * rebased. Nothing here touches a real model, network or filesystem.
 */

import type {
  AnyDomainEvent,
  ApprovalRequest,
  AssetRef,
  ChangeSet,
  Command,
  CommandAck,
  DomainEventType,
  EntityId,
  MockHost,
} from '@zeus-web/ai-core'

import { createMockHost, createRejectedAck } from '@zeus-web/ai-core'

export const STREAM_ID = 'demo'
export const CHAT_ID = 'chat'
export const AGENT_CONVERSATION_ID = 'agent-chat'
const T0 = Date.parse('2026-10-27T09:00:00.000Z')

export interface DemoHost extends MockHost {
  /** Disconnect live subscriptions (simulates a dropped connection). */
  dropConnections: () => void
  /** Milliseconds between streamed words; tests set it to 0. */
  tokenDelay: number
}

interface Pending {
  timer?: ReturnType<typeof setTimeout>
  cancelled: boolean
}

const ANSWERS = [
  'A **unified diff** lists removed lines with `-` and added lines with `+`, grouped in hunks that start with `@@`.\n\n```diff\n-const y = 2\n+const y = 3\n```\n\nRead each hunk as one focused change.',
  'Streaming keeps the message readable while it grows; the timeline only follows when you are already at the bottom.',
]

const DIFFS: Record<string, string> = {
  'src/math.ts@1':
    '--- a/src/math.ts\n+++ b/src/math.ts\n@@ -1,4 +1,4 @@ export function add()\n export function add(a: number, b: number) {\n-  return a - b\n+  return a + b\n }\n \n',
  'src/math.spec.ts@1':
    '--- /dev/null\n+++ b/src/math.spec.ts\n@@ -0,0 +1,3 @@\n+import { add } from "./math"\n+\n+test("add", () => expect(add(1, 2)).toBe(3))\n',
  'src/math.ts@3':
    '--- a/src/math.ts\n+++ b/src/math.ts\n@@ -1,5 +1,5 @@ export function add()\n export function add(a: number, b: number) {\n-  return a - b\n+  return a + b // rebased\n }\n \n export const VERSION = 2\n',
  'src/math.spec.ts@3':
    '--- /dev/null\n+++ b/src/math.spec.ts\n@@ -0,0 +1,3 @@\n+import { add } from "./math"\n+\n+test("add", () => expect(add(1, 2)).toBe(3))\n',
}

export const REPORT_OUTPUT: Record<string, string> = {
  'report-output':
    'FAIL src/math.spec.ts > subtract\n  expected 1 to be -1\n    at src/math.spec.ts:7:21',
}

export function createDemoHost(): DemoHost {
  let clock = 0
  let answer = 0
  let ids = 0
  const pending = new Map<EntityId, Pending>()
  const controllers = new Set<AbortController>()
  const now = (): string => new Date(T0 + (clock += 1000)).toISOString()
  const next = (prefix: string): string => `${prefix}-${(ids += 1)}`

  // Host-side truth the client never gets to write.
  const executions = new Map<
    EntityId,
    { status: string; revision: number; messageId?: EntityId }
  >()
  const approvals = new Map<EntityId, ApprovalRequest>()
  let changeSet: ChangeSet | undefined
  let conflictsLeft = 1

  const host = createMockHost({
    streamId: STREAM_ID,
    onExecute: command => handle(command),
  }) as DemoHost
  host.tokenDelay = 25

  const baseSubscribe = host.subscribe.bind(host)
  host.subscribe = (streamId, afterSeq, signal) => {
    const controller = new AbortController()
    controllers.add(controller)
    signal?.addEventListener('abort', () => controller.abort(), { once: true })
    const iterable = baseSubscribe(streamId, afterSeq, controller.signal)

    async function* follow(): AsyncGenerator<AnyDomainEvent> {
      try {
        for await (const event of iterable) yield event
      } finally {
        controllers.delete(controller)
      }
      if (controller.signal.aborted && !signal?.aborted) {
        throw new Error('connection dropped')
      }
    }

    return follow()
  }
  host.dropConnections = () => {
    for (const controller of controllers) controller.abort()
  }

  host.loadAsset = async (asset: AssetRef) => {
    const text = DIFFS[asset.id] ?? REPORT_OUTPUT[asset.id]
    if (text === undefined) throw new Error(`unknown asset ${asset.id}`)
    return new TextEncoder().encode(text)
  }

  function emit(type: DomainEventType, id: string, payload: unknown): void {
    host.emit(type, id, payload)
  }

  function setExecution(id: EntityId, to: string): void {
    const execution = executions.get(id)!
    emit('execution.status.changed', id, {
      id,
      from: execution.status,
      to,
      revision: execution.revision + 1,
    })
    execution.status = to
    execution.revision += 1
  }

  function wait(ms: number): Promise<void> {
    return ms <= 0
      ? Promise.resolve()
      : new Promise(resolve => setTimeout(resolve, ms))
  }

  /** Stream an assistant answer for an execution, honouring cancellation. */
  async function streamAnswer(
    conversationId: EntityId,
    parentMessageId: EntityId | undefined,
    executionId: EntityId,
    text: string,
  ): Promise<void> {
    const messageId = next('assistant')
    executions.get(executionId)!.messageId = messageId
    emit('message.created', messageId, {
      message: {
        id: messageId,
        conversationId,
        parentMessageId,
        author: 'assistant',
        parts: [
          { id: 'p', kind: 'text', revision: 0, text: '', format: 'markdown' },
        ],
        executionId,
        status: 'streaming',
        revision: 1,
        createdAt: now(),
      },
    })

    const state: Pending = { cancelled: false }
    pending.set(executionId, state)
    const words = text.split(/(?<=\s)/)
    let revision = 0

    for (const word of words) {
      await wait(host.tokenDelay)
      if (state.cancelled) break
      emit('message.part.delta', messageId, {
        messageId,
        partId: 'p',
        baseRevision: revision,
        nextRevision: revision + 1,
        append: word,
      })
      revision += 1
    }

    pending.delete(executionId)
    emit('message.completed', messageId, {
      messageId,
      revision: revision + 2,
      status: state.cancelled ? 'cancelled' : 'complete',
    })
    if (!state.cancelled) setExecution(executionId, 'completed')
  }

  function startGeneration(
    conversationId: EntityId,
    parentMessageId: EntityId | undefined,
    retryOf?: EntityId,
  ): void {
    const executionId = next('exec')
    executions.set(executionId, { status: 'running', revision: 1 })
    emit('execution.started', executionId, {
      execution: {
        id: executionId,
        kind: 'generation',
        conversationId,
        status: 'running',
        createdAt: now(),
        revision: 1,
        activeStepIds: [],
        ...(retryOf ? { outcome: { summary: `retry of ${retryOf}` } } : {}),
      },
    })
    const text = ANSWERS[answer % ANSWERS.length]
    answer += 1
    void streamAnswer(conversationId, parentMessageId, executionId, text)
  }

  function ensureConversation(id: EntityId, title: string): void {
    if (
      !host
        .events()
        .some(
          event =>
            event.type === 'conversation.upserted' && event.entity.id === id,
        )
    ) {
      emit('conversation.upserted', id, {
        conversation: { id, title, revision: 1 },
      })
    }
  }

  // -------------------------------------------------------------------------
  // S2: agent run with an approval gate
  // -------------------------------------------------------------------------

  async function runAgent(): Promise<void> {
    const executionId = next('run')
    executions.set(executionId, { status: 'queued', revision: 1 })
    emit('execution.started', executionId, {
      execution: {
        id: executionId,
        kind: 'agent',
        conversationId: AGENT_CONVERSATION_ID,
        status: 'queued',
        createdAt: now(),
        revision: 1,
        activeStepIds: [],
      },
    })
    setExecution(executionId, 'running')

    const plan = `${executionId}-plan`
    emit('step.upserted', plan, {
      step: {
        id: plan,
        executionId,
        kind: 'plan',
        status: 'completed',
        label: 'Plan: fix add() and run the tests',
      },
    })
    const stepId = `${executionId}-test`
    const toolId = `${executionId}-tool`
    emit('step.upserted', stepId, {
      step: {
        id: stepId,
        executionId,
        parentStepId: plan,
        kind: 'tool',
        status: 'pending',
        label: 'Run the test suite',
        toolInvocationId: toolId,
      },
    })
    emit('tool.upserted', toolId, {
      tool: {
        id: toolId,
        executionId,
        stepId,
        toolName: 'shell',
        summary: 'pnpm test --filter math',
        inputPreview: {
          command: 'pnpm test --filter math',
          env: { NPM_TOKEN: 'npm_live_secret_value' },
        },
        status: 'requested',
      },
    })

    const approvalId = `${executionId}-approval`
    const approval: ApprovalRequest = {
      id: approvalId,
      executionId,
      toolInvocationId: toolId,
      title: 'Allow running a shell command?',
      summary: 'The agent wants to run the test suite in workspace "demo".',
      operation: {
        kind: 'shell',
        target: 'workspace demo: pnpm test --filter math',
        preview: { command: 'pnpm test --filter math' },
      },
      scope: 'once',
      risk: 'high',
      expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
      status: 'pending',
      revision: 1,
    }
    approvals.set(approvalId, approval)
    emit('approval.requested', approvalId, { approval })
    setExecution(executionId, 'awaiting-approval')
  }

  async function resolveApproval(
    approval: ApprovalRequest,
    decision: 'approved' | 'rejected',
  ): Promise<void> {
    const executionId = approval.executionId
    const toolId = approval.toolInvocationId!
    const stepId = `${executionId}-test`
    const updated = {
      ...approval,
      status: decision,
      revision: approval.revision + 1,
    }
    approvals.set(approval.id, updated)
    emit('approval.resolved', approval.id, {
      approvalId: approval.id,
      decision,
      revision: updated.revision,
    })

    const tool = (status: string) =>
      emit('tool.upserted', toolId, {
        tool: {
          id: toolId,
          executionId,
          stepId,
          toolName: 'shell',
          summary: 'pnpm test --filter math',
          status,
        },
      })
    const step = (status: string) =>
      emit('step.upserted', stepId, {
        step: {
          id: stepId,
          executionId,
          parentStepId: `${executionId}-plan`,
          kind: 'tool',
          status,
          label: 'Run the test suite',
          toolInvocationId: toolId,
        },
      })

    if (decision === 'rejected') {
      // A rejection never turns into "executed successfully".
      tool('cancelled')
      step('cancelled')
      setExecution(executionId, 'cancelled')
      return
    }

    setExecution(executionId, 'running')
    tool('running')
    step('running')
    await wait(host.tokenDelay * 4)
    tool('succeeded')
    step('completed')
    setExecution(executionId, 'completed')
    emit('message.created', `${executionId}-summary`, {
      message: {
        id: `${executionId}-summary`,
        conversationId: AGENT_CONVERSATION_ID,
        author: 'assistant',
        parts: [
          {
            id: 'p',
            kind: 'text',
            revision: 0,
            text: 'Tests passed: **3 passed, 0 failed**.',
            format: 'markdown',
          },
        ],
        executionId,
        status: 'complete',
        revision: 1,
        createdAt: now(),
      },
    })
  }

  // -------------------------------------------------------------------------
  // S3: change set review and apply
  // -------------------------------------------------------------------------

  function publishChangeSet(
    revision: number,
    baseRevision: string,
    status: ChangeSet['status'],
  ): void {
    const executionId = 'coding-run'
    if (!executions.has(executionId)) {
      executions.set(executionId, { status: 'completed', revision: 1 })
      emit('execution.started', executionId, {
        execution: {
          id: executionId,
          kind: 'agent',
          workspaceId: 'ws-demo',
          status: 'completed',
          createdAt: now(),
          revision: 1,
          activeStepIds: [],
        },
      })
    }
    changeSet = {
      id: 'cs-demo',
      executionId,
      workspaceId: 'ws-demo',
      baseRevision,
      status,
      revision,
      files: [
        {
          path: 'src/math.ts',
          status: 'modified',
          stats: { additions: 1, deletions: 1 },
          diffAsset: {
            id: `src/math.ts@${revision === 1 ? 1 : 3}`,
            mimeType: 'text/x-diff',
          },
        },
        {
          path: 'src/math.spec.ts',
          status: 'added',
          stats: { additions: 3, deletions: 0 },
          diffAsset: {
            id: `src/math.spec.ts@${revision === 1 ? 1 : 3}`,
            mimeType: 'text/x-diff',
          },
        },
      ],
    }
    emit('changeset.updated', changeSet.id, { changeset: changeSet })
  }

  async function apply(command: Command): Promise<CommandAck | undefined> {
    if (!changeSet)
      return createRejectedAck(command, 'AI_CHANGESET_UNKNOWN', 'no change set')
    if (command.expectedRevision !== changeSet.revision) {
      return createRejectedAck(
        command,
        'AI_REVISION_MISMATCH',
        'the change set changed; review it again',
      )
    }
    const current = changeSet
    void (async () => {
      await wait(host.tokenDelay * 2)
      publishChangeSet(current.revision + 1, current.baseRevision, 'applying')
      await wait(host.tokenDelay * 2)
      if (conflictsLeft > 0) {
        conflictsLeft -= 1
        publishChangeSet(
          current.revision + 2,
          current.baseRevision,
          'conflicted',
        )
      } else {
        publishChangeSet(current.revision + 2, current.baseRevision, 'applied')
      }
    })()
    return undefined
  }

  // -------------------------------------------------------------------------

  async function handle(command: Command): Promise<CommandAck | undefined> {
    const payload = command.payload as Record<string, unknown>

    switch (command.type) {
      case 'message.send': {
        const conversationId = command.target.id
        ensureConversation(conversationId, 'Chat')
        const messageId = next('user')
        emit('message.created', messageId, {
          message: {
            id: messageId,
            conversationId,
            parentMessageId: payload.parentMessageId,
            author: 'user',
            parts: [
              {
                id: 'p',
                kind: 'text',
                revision: 0,
                text: String(payload.text ?? ''),
                format: 'markdown',
              },
            ],
            status: 'complete',
            revision: 1,
            createdAt: now(),
          },
        })
        startGeneration(conversationId, messageId)
        return undefined
      }
      case 'message.edit': {
        const conversationId = String(payload.conversationId)
        const messageId = next('user')
        emit('message.created', messageId, {
          message: {
            id: messageId,
            conversationId,
            parentMessageId: payload.parentMessageId,
            author: 'user',
            parts: [
              {
                id: 'p',
                kind: 'text',
                revision: 0,
                text: String(payload.text ?? ''),
                format: 'markdown',
              },
            ],
            status: 'complete',
            revision: 1,
            createdAt: now(),
          },
        })
        startGeneration(conversationId, messageId)
        return undefined
      }
      case 'execution.retry':
        startGeneration(
          String(payload.conversationId),
          payload.parentMessageId as EntityId | undefined,
          payload.retryOf as EntityId | undefined,
        )
        return undefined
      case 'execution.cancel': {
        const execution = executions.get(command.target.id)
        if (
          !execution ||
          ['completed', 'failed', 'cancelled'].includes(execution.status)
        ) {
          return createRejectedAck(
            command,
            'AI_EXECUTION_FINISHED',
            'the run already finished',
          )
        }
        const stream = pending.get(command.target.id)
        if (stream) stream.cancelled = true
        setTimeout(setExecution, 0, command.target.id, 'cancelled')
        return undefined
      }
      case 'agent.start':
        ensureConversation(AGENT_CONVERSATION_ID, 'Agent')
        void runAgent()
        return undefined
      case 'approval.resolve': {
        const approval = approvals.get(command.target.id)
        // The host, not the client, decides whether the decision is valid.
        if (!approval) {
          return createRejectedAck(
            command,
            'AI_APPROVAL_UNKNOWN',
            'unknown approval',
          )
        }
        if (approval.status !== 'pending') {
          return createRejectedAck(
            command,
            'AI_APPROVAL_DECIDED',
            'already decided',
          )
        }
        if (command.expectedRevision !== approval.revision) {
          return createRejectedAck(
            command,
            'AI_REVISION_MISMATCH',
            'approval changed',
          )
        }
        if (approval.expiresAt && Date.parse(approval.expiresAt) < Date.now()) {
          return createRejectedAck(
            command,
            'AI_APPROVAL_EXPIRED',
            'approval expired',
          )
        }
        const decision =
          payload.decision === 'approved' ? 'approved' : 'rejected'
        setTimeout(() => void resolveApproval(approval, decision), 0)
        return undefined
      }
      case 'coding.start':
        publishChangeSet(1, 'base-1', 'ready')
        return undefined
      case 'changeset.apply':
        return apply(command)
      case 'changeset.rebase':
        if (!changeSet || changeSet.status !== 'conflicted') {
          return createRejectedAck(
            command,
            'AI_CHANGESET_NOT_CONFLICTED',
            'nothing to rebase',
          )
        }
        setTimeout(
          () => publishChangeSet(changeSet!.revision + 1, 'base-2', 'ready'),
          0,
        )
        return undefined
      case 'changeset.discard':
        if (changeSet) {
          setTimeout(
            () =>
              publishChangeSet(
                changeSet!.revision + 1,
                changeSet!.baseRevision,
                'rejected',
              ),
            0,
          )
        }
        return undefined
      case 'review.comment':
        return undefined
      default:
        return createRejectedAck(
          command,
          'AI_COMMAND_UNSUPPORTED',
          `demo host does not handle ${command.type}`,
        )
    }
  }

  return host
}

export const TEST_REPORT = {
  schema: 'zeus.test-report/v1',
  summary: { passed: 2, failed: 1, skipped: 0, durationMs: 412 },
  cases: [
    { id: 'add', name: 'add() adds', status: 'passed' },
    { id: 'zero', name: 'add() handles zero', status: 'passed' },
    {
      id: 'sub',
      name: 'subtract() returns the difference',
      status: 'failed',
      location: { file: 'src/math.spec.ts', line: 7 },
      message: 'expected 1 to be -1',
      output: { id: 'report-output', mimeType: 'text/plain' },
    },
  ],
}
