import type { Message } from '../src/domain/types'

import type { AiState } from '../src/store/state'
import { describe, expect, it } from 'vitest'
import { createEventFactory } from '../src/host/event-factory'

import { reduceEvent } from '../src/store/reducers'
import { createInitialState } from '../src/store/state'

const factory = createEventFactory('stream-store')

function seed(): AiState {
  const conversation = factory.create('conversation.upserted', 'conv-1', {
    conversation: { id: 'conv-1', title: 'hi', revision: 1 },
  })
  const created = factory.create('message.created', 'msg-1', {
    message: {
      id: 'msg-1',
      conversationId: 'conv-1',
      author: 'assistant',
      parts: [
        {
          id: 'part-1',
          kind: 'text',
          revision: 1,
          text: 'Hel',
          format: 'plain',
        },
      ],
      status: 'streaming',
      revision: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
    } satisfies Message,
  })

  const first = reduceEvent(createInitialState(), conversation)
  if (!first.ok) throw new Error(first.message)
  const second = reduceEvent(first.state, created)
  if (!second.ok) throw new Error(second.message)

  return second.state
}

describe('canonical reducers (AI2-107)', () => {
  it('replaces only the touched collection', () => {
    const before = seed()
    const delta = factory.create('message.part.delta', 'msg-1', {
      messageId: 'msg-1',
      partId: 'part-1',
      baseRevision: 1,
      nextRevision: 2,
      append: 'lo',
    })

    const result = reduceEvent(before, delta)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.state.messages['msg-1']).not.toBe(before.messages['msg-1'])
    expect(result.state.conversations).toBe(before.conversations)
    expect(result.state.executions).toBe(before.executions)
    expect(result.state.conversationMessageIds).toBe(
      before.conversationMessageIds,
    )
    expect(result.state.messages['msg-1'].parts[0]).toMatchObject({
      text: 'Hello',
      revision: 2,
    })
  })

  it('rejects a delta whose base revision is stale', () => {
    const state = seed()
    const stale = factory.create('message.part.delta', 'msg-1', {
      messageId: 'msg-1',
      partId: 'part-1',
      baseRevision: 5,
      nextRevision: 6,
      append: '!',
    })

    expect(reduceEvent(state, stale)).toMatchObject({
      ok: false,
      code: 'revision-mismatch',
    })
  })

  it('requires deltas to advance exactly one revision', () => {
    const state = seed()
    const skip = factory.create('message.part.delta', 'msg-1', {
      messageId: 'msg-1',
      partId: 'part-1',
      baseRevision: 1,
      nextRevision: 3,
      append: '!',
    })

    expect(reduceEvent(state, skip)).toMatchObject({
      ok: false,
      code: 'revision-mismatch',
    })
  })

  it('refuses deltas after a terminal message', () => {
    const state = seed()
    const completed = factory.create('message.completed', 'msg-1', {
      messageId: 'msg-1',
      revision: 2,
      status: 'complete',
    })
    const afterComplete = reduceEvent(state, completed)
    if (!afterComplete.ok) throw new Error(afterComplete.message)

    const late = factory.create('message.part.delta', 'msg-1', {
      messageId: 'msg-1',
      partId: 'part-1',
      baseRevision: 1,
      nextRevision: 2,
      append: 'late',
    })

    expect(reduceEvent(afterComplete.state, late)).toMatchObject({
      ok: false,
      code: 'state-mismatch',
    })
  })

  it('enforces execution transitions and the declared from-status', () => {
    const start = factory.create('execution.started', 'exec-1', {
      execution: {
        id: 'exec-1',
        kind: 'agent',
        status: 'running',
        createdAt: '2026-01-01T00:00:00.000Z',
        revision: 1,
        activeStepIds: [],
      },
    })
    const started = reduceEvent(createInitialState(), start)
    if (!started.ok) throw new Error(started.message)

    const wrongFrom = factory.create('execution.status.changed', 'exec-1', {
      id: 'exec-1',
      from: 'queued',
      to: 'completed',
      revision: 2,
    })
    expect(reduceEvent(started.state, wrongFrom)).toMatchObject({
      ok: false,
      code: 'state-mismatch',
    })

    const completed = factory.create('execution.status.changed', 'exec-1', {
      id: 'exec-1',
      from: 'running',
      to: 'completed',
      revision: 2,
    })
    const done = reduceEvent(started.state, completed)
    if (!done.ok) throw new Error(done.message)

    const revive = factory.create('execution.status.changed', 'exec-1', {
      id: 'exec-1',
      from: 'completed',
      to: 'running',
      revision: 3,
    })
    expect(reduceEvent(done.state, revive)).toMatchObject({
      ok: false,
      code: 'illegal-transition',
    })
  })

  it('guards approval decisions with the approval state machine', () => {
    const requested = factory.create('approval.requested', 'approval-1', {
      approval: {
        id: 'approval-1',
        executionId: 'exec-1',
        title: 'run shell',
        summary: 'rm -rf dist',
        operation: { kind: 'shell', target: 'workspace:ws/dist' },
        scope: 'once',
        risk: 'high',
        status: 'pending',
        revision: 1,
      },
    })
    const first = reduceEvent(createInitialState(), requested)
    if (!first.ok) throw new Error(first.message)

    const approved = factory.create('approval.resolved', 'approval-1', {
      approvalId: 'approval-1',
      decision: 'approved',
      revision: 2,
    })
    const second = reduceEvent(first.state, approved)
    if (!second.ok) throw new Error(second.message)
    expect(second.state.approvals['approval-1'].status).toBe('approved')

    const rejectAfterApprove = factory.create(
      'approval.resolved',
      'approval-1',
      {
        approvalId: 'approval-1',
        decision: 'rejected',
        revision: 3,
      },
    )
    expect(reduceEvent(second.state, rejectAfterApprove)).toMatchObject({
      ok: false,
      code: 'illegal-transition',
    })
  })

  it('keeps older revisions from overwriting newer facts', () => {
    const state = seed()
    const staleConversation = factory.create(
      'conversation.upserted',
      'conv-1',
      {
        conversation: { id: 'conv-1', title: 'older', revision: 0 },
      },
    )

    expect(reduceEvent(state, staleConversation)).toMatchObject({
      ok: false,
      code: 'revision-mismatch',
    })
  })
})
