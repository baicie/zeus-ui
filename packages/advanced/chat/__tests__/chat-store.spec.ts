import { describe, expect, it } from 'vitest'

import { createChatStore } from '../src/core'

describe('createChatStore', () => {
  it('initializes with normalized messages', () => {
    const store = createChatStore([
      {
        id: 'm1',
        role: 'user',
        content: 'hello',
        createdAt: 1,
      },
    ])

    expect(store.getMessages()).toMatchObject([
      {
        id: 'm1',
        role: 'user',
        status: 'idle',
        parts: [{ type: 'text', text: 'hello' }],
      },
    ])
  })

  it('sets messages', () => {
    const store = createChatStore()

    const messages = store.setMessages([
      {
        id: 'm1',
        role: 'assistant',
        content: 'hello',
        createdAt: 1,
      },
    ])

    expect(messages).toHaveLength(1)
    expect(store.getSnapshot().messages[0].id).toBe('m1')
  })

  it('appends a new message', () => {
    const store = createChatStore()

    store.appendMessage({
      id: 'm1',
      role: 'user',
      content: 'hello',
      createdAt: 1,
    })

    expect(store.getMessages()).toHaveLength(1)
  })

  it('replaces duplicate message id on append', () => {
    const store = createChatStore([
      {
        id: 'm1',
        role: 'user',
        content: 'old',
        createdAt: 1,
      },
    ])

    store.appendMessage({
      id: 'm1',
      role: 'assistant',
      content: 'new',
      createdAt: 2,
    })

    const messages = store.getMessages()

    expect(messages).toHaveLength(1)
    expect(messages[0].role).toBe('assistant')
    expect(messages[0].parts).toEqual([{ type: 'text', text: 'new' }])
  })

  it('updates a message', () => {
    const store = createChatStore([
      {
        id: 'm1',
        role: 'assistant',
        content: 'old',
        status: 'streaming',
        createdAt: 1,
      },
    ])

    store.updateMessage('m1', {
      content: 'new',
      status: 'complete',
    })

    expect(store.getMessages()[0]).toMatchObject({
      status: 'complete',
      parts: [{ type: 'text', text: 'new' }],
    })
  })

  it('appends a message part', () => {
    const store = createChatStore([
      {
        id: 'm1',
        role: 'assistant',
        content: 'hello',
        createdAt: 1,
      },
    ])

    store.appendMessagePart('m1', {
      type: 'text',
      text: ' world',
    })

    expect(store.getMessages()[0].parts).toEqual([
      { type: 'text', text: 'hello' },
      { type: 'text', text: ' world' },
    ])
  })

  it('does not expose mutable internal state', () => {
    const store = createChatStore([
      {
        id: 'm1',
        role: 'assistant',
        content: 'hello',
        createdAt: 1,
      },
    ])

    const messages = store.getMessages()
    messages[0].parts.push({ type: 'text', text: ' mutated' })

    expect(store.getMessages()[0].parts).toEqual([
      { type: 'text', text: 'hello' },
    ])
  })

  it('clears messages', () => {
    const store = createChatStore([
      {
        id: 'm1',
        role: 'user',
        content: 'hello',
        createdAt: 1,
      },
    ])

    store.clear()

    expect(store.getMessages()).toEqual([])
  })
})
