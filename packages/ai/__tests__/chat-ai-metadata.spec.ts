import { describe, expect, it } from 'vitest'

import { aiMetadata, validateAiMetadata } from '../src'

describe('chat advanced AI metadata', () => {
  it('passes full metadata validation', () => {
    const result = validateAiMetadata(aiMetadata)

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('registers chat in advancedComponents', () => {
    const chat = (aiMetadata.advancedComponents ?? []).find(
      component => component.name === 'chat',
    )

    expect(chat).toBeDefined()
    expect(chat?.packageName).toBe('@zeus-web/chat')
    expect(chat?.category).toBe('advanced')
  })

  it('forbids treating chat as a model request library', () => {
    const chat = (aiMetadata.advancedComponents ?? []).find(
      component => component.name === 'chat',
    )

    expect(
      chat?.doNotUseFor.some(rule => rule.includes('不要把它当作模型请求库')),
    ).toBe(true)

    expect(
      chat?.promptHints.some(rule =>
        rule.includes('业务请求逻辑应该放在应用层'),
      ),
    ).toBe(true)
  })

  it('lists all chat child components', () => {
    const chat = (aiMetadata.advancedComponents ?? []).find(
      component => component.name === 'chat',
    )

    expect(chat?.components).toEqual(
      expect.arrayContaining([
        'zw-chat',
        'zw-chat-thread',
        'zw-chat-message',
        'zw-chat-composer',
        'zw-chat-code-block',
        'zw-chat-tool-call',
        'zw-chat-artifact',
        'zw-chat-typing',
      ]),
    )
  })

  it('documents events and methods for core chat components', () => {
    const chat = (aiMetadata.advancedComponents ?? []).find(
      component => component.name === 'chat',
    )

    expect(chat?.events['zw-chat']).toEqual(
      expect.arrayContaining([
        'send',
        'abort',
        'regenerate',
        'message-action',
        'artifact-open',
      ]),
    )

    expect(chat?.methods['zw-chat']).toEqual(
      expect.arrayContaining([
        'setMessages',
        'appendMessage',
        'updateMessage',
        'appendMessagePart',
        'clear',
        'getMessages',
        'scrollToBottom',
        'emitSend',
        'emitAbort',
        'emitRegenerate',
        'emitMessageAction',
        'emitArtifactOpen',
      ]),
    )

    expect(chat?.methods['zw-chat-composer']).toEqual(
      expect.arrayContaining(['focus', 'clear', 'submit']),
    )
  })

  it('contains native and React usage examples', () => {
    const chat = (aiMetadata.advancedComponents ?? []).find(
      component => component.name === 'chat',
    )

    const code = (chat?.examples ?? []).map(example => example.code).join('\n')

    expect(code).toContain('@zeus-web/chat/wc/auto')
    expect(code).toContain('@zeus-web/chat/react')
  })
})
