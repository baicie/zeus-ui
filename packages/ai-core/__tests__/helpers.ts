/**
 * Shared builders for controller tests. Everything runs in plain Node.
 */

import type {
  ApprovalRequest,
  ChangeSet,
  Execution,
  ExecutionStep,
  Message,
  ToolInvocation,
} from '../src/domain/types'
import type { Command, CommandAck } from '../src/protocol/commands'

import { vi } from 'vitest'
import { createEventFactory } from '../src/host/event-factory'
import { createAiStore } from '../src/store/store'

export const T = '2026-01-01T00:00:00.000Z'

export function message(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    conversationId: 'conv-1',
    author: 'assistant',
    parts: [
      { id: 'p1', kind: 'text', revision: 0, text: '', format: 'markdown' },
    ],
    status: 'streaming',
    revision: 1,
    createdAt: T,
    ...overrides,
  }
}

export function execution(overrides: Partial<Execution> = {}): Execution {
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

export function step(overrides: Partial<ExecutionStep> = {}): ExecutionStep {
  return {
    id: 'step-1',
    executionId: 'exec-1',
    kind: 'tool',
    status: 'running',
    label: 'run tests',
    ...overrides,
  }
}

export function tool(overrides: Partial<ToolInvocation> = {}): ToolInvocation {
  return {
    id: 'tool-1',
    executionId: 'exec-1',
    toolName: 'shell',
    summary: 'pnpm test',
    status: 'running',
    ...overrides,
  }
}

export function approval(
  overrides: Partial<ApprovalRequest> = {},
): ApprovalRequest {
  return {
    id: 'approval-1',
    executionId: 'exec-1',
    title: 'Run shell command',
    summary: 'pnpm test in workspace ws-1',
    operation: { kind: 'shell', target: 'ws-1:pnpm test' },
    scope: 'once',
    risk: 'medium',
    status: 'pending',
    revision: 1,
    ...overrides,
  }
}

export function changeSet(overrides: Partial<ChangeSet> = {}): ChangeSet {
  return {
    id: 'cs-1',
    executionId: 'exec-1',
    workspaceId: 'ws-1',
    baseRevision: 'abc123',
    files: [
      {
        path: 'src/a.ts',
        status: 'modified',
        stats: { additions: 1, deletions: 1 },
      },
    ],
    status: 'ready',
    revision: 1,
    ...overrides,
  }
}

/** A store plus an event factory that keeps seq in order. */
export function createFixture(streamId = 'stream-test') {
  const store = createAiStore({ streamId })
  const factory = createEventFactory(streamId)

  return {
    store,
    factory,
    emit(
      type: Parameters<typeof factory.create>[0],
      id: string,
      payload: unknown,
    ) {
      const result = store.ingest(factory.create(type, id, payload))
      if (result.status !== 'applied') {
        throw new Error(
          `fixture event ${type} ${id} was ${result.status}: ${JSON.stringify(result)}`,
        )
      }
      return result
    },
  }
}

/** A session stand-in whose `execute` records commands and answers via `respond`. */
export function createSessionStub(
  store: ReturnType<typeof createAiStore>,
  respond: (
    command: Command,
  ) => CommandAck | Promise<CommandAck> = command => ({
    accepted: true,
    commandId: command.commandId,
    operationId: `op-${command.idempotencyKey}`,
  }),
) {
  const execute = vi.fn(async (command: Command) => respond(command))
  return {
    store,
    execute,
    commands: () => execute.mock.calls.map(call => call[0]),
  }
}

/** Deterministic ids for snapshot-friendly assertions. */
export function sequentialIds(): (prefix: string) => string {
  let counter = 0
  return prefix => `${prefix}-${(counter += 1)}`
}

export function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
