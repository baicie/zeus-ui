import { describe, expect, it } from 'vitest'

import {
  appendAgentConsoleEvent,
  createAgentConsoleEvent,
  filterAgentConsoleEventsByType,
} from '../src/core'

describe('event log model', () => {
  it('creates event', () => {
    expect(
      createAgentConsoleEvent({
        id: 'e1',
        type: 'status',
        status: 'running',
        createdAt: 1,
      }),
    ).toEqual({
      id: 'e1',
      type: 'status',
      status: 'running',
      createdAt: 1,
      message: undefined,
      toolCall: undefined,
      artifact: undefined,
      diagnostic: undefined,
      metadata: undefined,
    })
  })

  it('appends and caps events', () => {
    const events = appendAgentConsoleEvent(
      appendAgentConsoleEvent(
        appendAgentConsoleEvent([], {
          id: 'e1',
          type: 'status',
        }),
        {
          id: 'e2',
          type: 'message',
        },
      ),
      {
        id: 'e3',
        type: 'artifact',
      },
      2,
    )

    expect(events.map(event => event.id)).toEqual(['e2', 'e3'])
  })

  it('filters by type', () => {
    const events = [
      createAgentConsoleEvent({
        id: 'e1',
        type: 'message',
      }),
      createAgentConsoleEvent({
        id: 'e2',
        type: 'artifact',
      }),
    ]

    expect(filterAgentConsoleEventsByType(events, 'artifact')).toEqual([
      expect.objectContaining({
        id: 'e2',
      }),
    ])
  })
})
