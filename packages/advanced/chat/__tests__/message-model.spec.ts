import { describe, expect, it, vi } from 'vitest'

import {
  appendMessagePart,
  getMessageText,
  normalizeChatMessage,
  normalizeChatMessages,
  patchMessage,
} from '../src/core'

describe('message model', () => {
  it('normalizes content into text parts', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000)

    const message = normalizeChatMessage({
      id: 'm1',
      role: 'assistant',
      content: 'hello',
    })

    expect(message).toEqual({
      id: 'm1',
      role: 'assistant',
      status: 'idle',
      parts: [{ type: 'text', text: 'hello' }],
      createdAt: 1000,
      metadata: undefined,
    })

    vi.restoreAllMocks()
  })

  it('keeps explicit parts', () => {
    const message = normalizeChatMessage({
      id: 'm1',
      role: 'assistant',
      status: 'streaming',
      parts: [
        { type: 'text', text: 'hello' },
        { type: 'code', language: 'ts', code: 'const a = 1' },
      ],
      createdAt: 1,
    })

    expect(message.parts).toEqual([
      { type: 'text', text: 'hello' },
      { type: 'code', language: 'ts', code: 'const a = 1' },
    ])
  })

  it('normalizes a message list', () => {
    const messages = normalizeChatMessages([
      {
        id: 'u1',
        role: 'user',
        content: 'hi',
        createdAt: 1,
      },
      {
        id: 'a1',
        role: 'assistant',
        status: 'complete',
        content: 'hello',
        createdAt: 2,
      },
    ])

    expect(messages.map(message => message.id)).toEqual(['u1', 'a1'])
    expect(messages[1].status).toBe('complete')
  })

  it('gets text from text parts only', () => {
    const message = normalizeChatMessage({
      id: 'm1',
      role: 'assistant',
      parts: [
        { type: 'text', text: 'hello ' },
        { type: 'code', code: 'ignored' },
        { type: 'text', text: 'world' },
      ],
      createdAt: 1,
    })

    expect(getMessageText(message)).toBe('hello world')
  })

  it('appends message parts immutably', () => {
    const message = normalizeChatMessage({
      id: 'm1',
      role: 'assistant',
      content: 'hello',
      createdAt: 1,
    })

    const next = appendMessagePart(message, {
      type: 'text',
      text: ' world',
    })

    expect(message.parts).toHaveLength(1)
    expect(next.parts).toHaveLength(2)
  })

  it('patches content into text parts', () => {
    const message = normalizeChatMessage({
      id: 'm1',
      role: 'assistant',
      content: 'old',
      createdAt: 1,
    })

    const next = patchMessage(message, {
      content: 'new',
      status: 'complete',
    })

    expect(next.status).toBe('complete')
    expect(next.parts).toEqual([{ type: 'text', text: 'new' }])
  })
})
