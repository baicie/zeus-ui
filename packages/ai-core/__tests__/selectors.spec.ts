import { describe, expect, it } from 'vitest'

import { createEventFactory } from '../src/host/event-factory'
import {
  selectConversationTimeline,
  selectMessage,
  selectPendingApprovals,
} from '../src/store/selectors'
import { createAiStore } from '../src/store/store'

const STREAM = 'stream-selectors'

function seedMessages(store: ReturnType<typeof createAiStore>): {
  factory: ReturnType<typeof createEventFactory>
} {
  const factory = createEventFactory(STREAM)

  store.ingest(
    factory.create('conversation.upserted', 'conv-1', {
      conversation: { id: 'conv-1', title: 'filters', revision: 1 },
    }),
  )

  for (const id of ['msg-1', 'msg-2']) {
    store.ingest(
      factory.create('message.created', id, {
        message: {
          id,
          conversationId: 'conv-1',
          author: 'assistant',
          parts: [
            {
              id: `${id}-text`,
              kind: 'text',
              revision: 1,
              text: 'hi',
              format: 'plain',
            },
          ],
          status: 'streaming',
          revision: 1,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      }),
    )
  }

  return { factory }
}

describe('fine-grained selectors (AI2-109)', () => {
  it('notifies only the subscription whose entity changed', () => {
    const store = createAiStore({ streamId: STREAM })
    const { factory } = seedMessages(store)

    const messageOneValues: unknown[] = []
    const messageTwoValues: unknown[] = []

    store.subscribe(
      state => selectMessage(state, 'msg-1'),
      value => {
        messageOneValues.push(value)
      },
    )
    store.subscribe(
      state => selectMessage(state, 'msg-2'),
      value => {
        messageTwoValues.push(value)
      },
    )

    store.ingest(
      factory.create('message.part.delta', 'msg-1', {
        messageId: 'msg-1',
        partId: 'msg-1-text',
        baseRevision: 1,
        nextRevision: 2,
        append: ' there',
      }),
    )

    expect(messageOneValues).toHaveLength(1)
    expect(messageTwoValues).toHaveLength(0)
  })

  it('keeps a stable timeline reference while the index is untouched', () => {
    const store = createAiStore({ streamId: STREAM })
    const { factory } = seedMessages(store)

    const first = selectConversationTimeline(store.getState(), 'conv-1')
    const second = selectConversationTimeline(store.getState(), 'conv-1')
    expect(second).toBe(first)

    store.ingest(
      factory.create('conversation.upserted', 'conv-1', {
        conversation: { id: 'conv-1', title: 'renamed', revision: 2 },
      }),
    )

    const third = selectConversationTimeline(store.getState(), 'conv-1')
    expect(third).toBe(first)

    store.ingest(
      factory.create('message.part.delta', 'msg-2', {
        messageId: 'msg-2',
        partId: 'msg-2-text',
        baseRevision: 1,
        nextRevision: 2,
        append: '!',
      }),
    )

    const fourth = selectConversationTimeline(store.getState(), 'conv-1')
    expect(fourth).not.toBe(first)
    expect(fourth[1]).not.toBe(third[1])
    expect(fourth[0]).toBe(third[0])
  })

  it('selects approvals that still need a decision', () => {
    const store = createAiStore({ streamId: STREAM })
    const factory = createEventFactory(STREAM)

    store.ingest(
      factory.create('approval.requested', 'approval-1', {
        approval: {
          id: 'approval-1',
          executionId: 'exec-1',
          title: 'run',
          summary: 'run tests',
          operation: { kind: 'shell', target: 'workspace:ws' },
          scope: 'once',
          risk: 'low',
          status: 'pending',
          revision: 1,
        },
      }),
    )
    store.ingest(
      factory.create('approval.resolved', 'approval-1', {
        approvalId: 'approval-1',
        decision: 'approved',
        revision: 2,
      }),
    )

    expect(selectPendingApprovals(store.getState())).toHaveLength(0)
  })

  it('unsubscribes without leaking listeners', () => {
    const store = createAiStore({ streamId: STREAM })
    const { factory } = seedMessages(store)
    const values: unknown[] = []

    const unsubscribe = store.subscribe(
      state => selectMessage(state, 'msg-1'),
      value => {
        values.push(value)
      },
    )

    unsubscribe()
    store.ingest(
      factory.create('message.part.delta', 'msg-1', {
        messageId: 'msg-1',
        partId: 'msg-1-text',
        baseRevision: 1,
        nextRevision: 2,
        append: ' gone',
      }),
    )

    expect(values).toHaveLength(0)
  })
})
