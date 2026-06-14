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
        setMessages: {
          name: 'setMessages',
          returns: 'void',
        },
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
        emitSend: {
          name: 'emitSend',
          returns: 'void',
        },
        emitAbort: {
          name: 'emitAbort',
          returns: 'void',
        },
        emitRegenerate: {
          name: 'emitRegenerate',
          returns: 'void',
        },
        emitMessageAction: {
          name: 'emitMessageAction',
          returns: 'void',
        },
        emitArtifactOpen: {
          name: 'emitArtifactOpen',
          returns: 'void',
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
      methods: {
        emitAction: {
          name: 'emitAction',
          returns: 'void',
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

  it('analyzes zw-chat-code-block', () => {
    const result = analyzeComponent(
      'packages/advanced/chat/src/components/chat-code-block.tsx',
    )

    expect(result.diagnostics).toEqual([])
    expect(result.components[0]).toMatchObject({
      tag: 'zw-chat-code-block',
      events: {
        codeAction: {
          name: 'code-action',
          reactName: 'onCodeAction',
        },
      },
      methods: {
        emitAction: {
          name: 'emitAction',
          returns: 'void',
        },
      },
      slots: {
        default: { name: 'default' },
        filename: { name: 'filename' },
        language: { name: 'language' },
        actions: { name: 'actions' },
      },
    })

    expect(result.components[0].cssParts).toEqual(
      expect.arrayContaining([
        'actions',
        'code',
        'figure',
        'filename',
        'header',
        'language',
        'pre',
        'root',
      ]),
    )
  })

  it('analyzes zw-chat-tool-call', () => {
    const result = analyzeComponent(
      'packages/advanced/chat/src/components/chat-tool-call.tsx',
    )

    expect(result.diagnostics).toEqual([])
    expect(result.components[0]).toMatchObject({
      tag: 'zw-chat-tool-call',
      props: {
        status: {
          type: 'string',
          values: ['pending', 'running', 'success', 'error'],
          default: 'pending',
          reflect: true,
        },
      },
      slots: {
        summary: { name: 'summary' },
        input: { name: 'input' },
        output: { name: 'output' },
        error: { name: 'error' },
        actions: { name: 'actions' },
      },
    })

    expect(result.components[0].cssParts.length).toBeGreaterThan(0)
  })

  it('analyzes zw-chat-artifact', () => {
    const result = analyzeComponent(
      'packages/advanced/chat/src/components/chat-artifact.tsx',
    )

    expect(result.diagnostics).toEqual([])
    expect(result.components[0]).toMatchObject({
      tag: 'zw-chat-artifact',
      events: {
        artifactOpen: {
          name: 'artifact-open',
          reactName: 'onArtifactOpen',
        },
      },
      methods: {
        openArtifact: {
          name: 'openArtifact',
          returns: 'void',
        },
      },
      slots: {
        default: { name: 'default' },
        header: { name: 'header' },
        footer: { name: 'footer' },
        actions: { name: 'actions' },
      },
    })

    expect(result.components[0].cssParts.length).toBeGreaterThan(0)
  })

  it('analyzes zw-chat-typing', () => {
    const result = analyzeComponent(
      'packages/advanced/chat/src/components/chat-typing.tsx',
    )

    expect(result.diagnostics).toEqual([])
    expect(result.components[0]).toMatchObject({
      tag: 'zw-chat-typing',
      props: {
        active: {
          type: 'boolean',
          default: true,
          reflect: true,
        },
      },
      slots: {
        default: { name: 'default' },
      },
    })

    expect(result.components[0].cssParts.length).toBeGreaterThan(0)
  })
})

describe('chat advanced component event trigger paths', () => {
  const componentFiles: Array<{ tag: string; file: string }> = [
    { tag: 'zw-chat', file: 'packages/advanced/chat/src/components/chat.tsx' },
    {
      tag: 'zw-chat-message',
      file: 'packages/advanced/chat/src/components/chat-message.tsx',
    },
    {
      tag: 'zw-chat-code-block',
      file: 'packages/advanced/chat/src/components/chat-code-block.tsx',
    },
    {
      tag: 'zw-chat-artifact',
      file: 'packages/advanced/chat/src/components/chat-artifact.tsx',
    },
  ]

  for (const { tag, file } of componentFiles) {
    it(`${tag} declares events and has matching ctx.emit.* triggers`, () => {
      const source = readFileSync(resolve(workspaceRoot, file), 'utf-8')
      const result = analyzeFile({ file, code: source })

      expect(result.diagnostics).toEqual([])
      const component = result.components[0]
      expect(component.tag).toBe(tag)

      const declaredEvents = Object.keys(component.events ?? {})
      expect(declaredEvents.length).toBeGreaterThan(0)

      for (const eventName of declaredEvents) {
        const trigger = new RegExp(`ctx\\.emit\\.${eventName}\\b`)
        expect(
          source.match(trigger),
          `${tag} event "${eventName}" declared but has no ctx.emit.${eventName} trigger`,
        ).not.toBeNull()
      }
    })
  }

  for (const { tag, file } of componentFiles) {
    it(`${tag} emitX/openArtifact-style methods reference ctx.emit.*`, () => {
      const source = readFileSync(resolve(workspaceRoot, file), 'utf-8')
      const methodNames = Object.keys(
        analyzeFile({ file, code: source }).components[0]?.methods ?? {},
      )

      const emitMethods = methodNames.filter(
        m => /^emit[A-Z]/.test(m) || m === 'openArtifact',
      )
      expect(emitMethods.length).toBeGreaterThan(0)

      for (const method of emitMethods) {
        const methodCall = new RegExp(
          `\\b${method}\\b[\\s\\S]{0,800}ctx\\.emit\\.`,
        )
        expect(
          source.match(methodCall),
          `${tag} method "${method}" should call ctx.emit.* somewhere in its body`,
        ).not.toBeNull()
      }
    })
  }
})
