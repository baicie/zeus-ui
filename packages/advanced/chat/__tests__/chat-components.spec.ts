import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { analyzeFile } from '@zeus-js/component-analyzer'
import { describe, expect, it } from 'vitest'

const workspaceRoot = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../../..')

function analyzeComponent(path: string) {
  const source = readFileSync(resolve(workspaceRoot, path), 'utf-8')

  return analyzeFile({
    file: path,
    code: source,
  })
}

describe('chat advanced component protocol', () => {
  it('analyzes zw-chat', () => {
    const result = analyzeComponent(
      'packages/advanced/chat/src/components/chat.tsx',
    )

    expect(result.diagnostics).toEqual([])
    expect(result.components).toHaveLength(1)
    expect(result.components[0]).toMatchObject({
      tag: 'zw-chat',
      props: {
        loading: {
          type: 'boolean',
          default: false,
          reflect: true,
        },
        disabled: {
          type: 'boolean',
          default: false,
          reflect: true,
        },
        autoScroll: {
          type: 'boolean',
          default: true,
        },
        virtual: {
          type: 'boolean',
          default: false,
          reflect: true,
        },
      },
      events: {
        send: {
          name: 'send',
          reactName: 'onSend',
        },
        abort: {
          name: 'abort',
          reactName: 'onAbort',
        },
        regenerate: {
          name: 'regenerate',
          reactName: 'onRegenerate',
        },
        messageAction: {
          name: 'message-action',
          reactName: 'onMessageAction',
        },
        artifactOpen: {
          name: 'artifact-open',
          reactName: 'onArtifactOpen',
        },
      },
      methods: {
        appendMessage: {
          name: 'appendMessage',
          returns: 'void',
        },
        updateMessage: {
          name: 'updateMessage',
          returns: 'void',
        },
        appendMessagePart: {
          name: 'appendMessagePart',
          returns: 'void',
        },
        clear: {
          name: 'clear',
          returns: 'void',
        },
        getMessages: {
          name: 'getMessages',
          returns: 'NormalizedChatMessageData[]',
        },
        scrollToBottom: {
          name: 'scrollToBottom',
        },
      },
      slots: {
        header: { name: 'header' },
        sidebar: { name: 'sidebar' },
        thread: { name: 'thread' },
        artifact: { name: 'artifact' },
        composer: { name: 'composer' },
        empty: { name: 'empty' },
        loading: { name: 'loading' },
      },
    })

    expect(result.components[0].cssParts).toEqual(
      expect.arrayContaining([
        'artifact',
        'composer',
        'container',
        'empty',
        'header',
        'loading',
        'root',
        'sidebar',
        'thread',
      ]),
    )
  })

  it('analyzes zw-chat-thread', () => {
    const result = analyzeComponent(
      'packages/advanced/chat/src/components/chat-thread.tsx',
    )

    expect(result.diagnostics).toEqual([])
    expect(result.components[0]).toMatchObject({
      tag: 'zw-chat-thread',
      props: {
        count: {
          type: 'number',
          default: 0,
        },
        loading: {
          type: 'boolean',
          default: false,
          reflect: true,
        },
        empty: {
          type: 'boolean',
          default: false,
          reflect: true,
        },
        virtual: {
          type: 'boolean',
          default: false,
          reflect: true,
        },
      },
      methods: {
        scrollToBottom: {
          name: 'scrollToBottom',
          returns: 'void',
        },
      },
      slots: {
        default: {
          name: 'default',
        },
      },
    })

    expect(result.components[0].cssParts).toEqual(
      expect.arrayContaining(['root', 'viewport']),
    )
  })

  it('analyzes zw-chat-message', () => {
    const result = analyzeComponent(
      'packages/advanced/chat/src/components/chat-message.tsx',
    )

    expect(result.diagnostics).toEqual([])
    expect(result.components[0]).toMatchObject({
      tag: 'zw-chat-message',
      props: {
        role: {
          type: 'string',
          values: ['system', 'user', 'assistant', 'tool'],
          default: 'assistant',
          reflect: true,
        },
        status: {
          type: 'string',
          values: ['idle', 'streaming', 'complete', 'error', 'aborted'],
          default: 'idle',
          reflect: true,
        },
        selected: {
          type: 'boolean',
          default: false,
          reflect: true,
        },
        interactive: {
          type: 'boolean',
          default: false,
          reflect: true,
        },
      },
      events: {
        messageAction: {
          name: 'message-action',
          reactName: 'onMessageAction',
        },
      },
      slots: {
        default: { name: 'default' },
        avatar: { name: 'avatar' },
        header: { name: 'header' },
        footer: { name: 'footer' },
        actions: { name: 'actions' },
      },
    })

    expect(result.components[0].cssParts).toEqual(
      expect.arrayContaining([
        'actions',
        'avatar',
        'body',
        'content',
        'footer',
        'header',
        'message',
        'root',
      ]),
    )
  })

  it('analyzes zw-chat-composer', () => {
    const result = analyzeComponent(
      'packages/advanced/chat/src/components/chat-composer.tsx',
    )

    expect(result.diagnostics).toEqual([])
    expect(result.components[0]).toMatchObject({
      tag: 'zw-chat-composer',
      props: {
        value: {
          type: 'string',
          reflect: true,
        },
        disabled: {
          type: 'boolean',
          default: false,
          reflect: true,
        },
        loading: {
          type: 'boolean',
          default: false,
          reflect: true,
        },
        submitOnEnter: {
          type: 'boolean',
          default: true,
        },
        rows: {
          type: 'number',
          default: 3,
        },
      },
      events: {
        send: {
          name: 'send',
          reactName: 'onSend',
        },
        valueChange: {
          name: 'value-change',
          reactName: 'onValueChange',
        },
        attachmentChange: {
          name: 'attachment-change',
          reactName: 'onAttachmentChange',
        },
      },
      methods: {
        focus: {
          name: 'focus',
          returns: 'void',
        },
        clear: {
          name: 'clear',
          returns: 'void',
        },
        submit: {
          name: 'submit',
          returns: 'void',
        },
      },
      slots: {
        prefix: { name: 'prefix' },
        attachments: { name: 'attachments' },
        submit: { name: 'submit' },
        suffix: { name: 'suffix' },
      },
    })

    expect(result.components[0].cssParts).toEqual(
      expect.arrayContaining([
        'attachments',
        'control',
        'form',
        'prefix',
        'root',
        'submit',
        'suffix',
      ]),
    )
  })

  it('analyzes support components', () => {
    const files = [
      'packages/advanced/chat/src/components/chat-code-block.tsx',
      'packages/advanced/chat/src/components/chat-tool-call.tsx',
      'packages/advanced/chat/src/components/chat-artifact.tsx',
      'packages/advanced/chat/src/components/chat-typing.tsx',
    ]

    const tags = [
      'zw-chat-code-block',
      'zw-chat-tool-call',
      'zw-chat-artifact',
      'zw-chat-typing',
    ]

    for (let index = 0; index < files.length; index += 1) {
      const result = analyzeComponent(files[index])

      expect(result.diagnostics).toEqual([])
      expect(result.components).toHaveLength(1)
      expect(result.components[0].tag).toBe(tags[index])
      expect(result.components[0].cssParts.length).toBeGreaterThan(0)
    }
  })
})
