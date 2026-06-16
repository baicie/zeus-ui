import { describe, expect, it } from 'vitest'

import {
  appendAgentConsoleMessage,
  createAgentConsoleMessage,
  getAgentConsoleMessageById,
  updateAgentConsoleMessage,
} from '../src/core'

describe('message model', () => {
  it('creates a message', () => {
    expect(
      createAgentConsoleMessage({
        id: 'm1',
        role: 'assistant',
        content: 'Hello',
        createdAt: 1,
      }),
    ).toEqual({
      id: 'm1',
      role: 'assistant',
      content: 'Hello',
      status: 'complete',
      createdAt: 1,
      updatedAt: 1,
      metadata: undefined,
    })
  })

  it('appends messages', () => {
    expect(
      appendAgentConsoleMessage([], {
        id: 'm1',
        role: 'user',
        content: 'Hi',
        createdAt: 1,
      }),
    ).toHaveLength(1)
  })

  it('updates message content and metadata', () => {
    const messages = [
      createAgentConsoleMessage({
        id: 'm1',
        role: 'assistant',
        content: 'A',
        createdAt: 1,
        metadata: {
          a: 1,
        },
      }),
    ]

    expect(
      updateAgentConsoleMessage(messages, {
        id: 'm1',
        content: 'B',
        status: 'streaming',
        updatedAt: 2,
        metadata: {
          b: 2,
        },
      })[0],
    ).toMatchObject({
      id: 'm1',
      content: 'B',
      status: 'streaming',
      updatedAt: 2,
      metadata: {
        a: 1,
        b: 2,
      },
    })
  })

  it('gets message by id', () => {
    const messages = [
      createAgentConsoleMessage({
        id: 'm1',
        role: 'user',
        content: 'Hi',
      }),
    ]

    expect(getAgentConsoleMessageById(messages, 'm1')?.content).toBe('Hi')
    expect(getAgentConsoleMessageById(messages, 'missing')).toBeUndefined()
  })
})
