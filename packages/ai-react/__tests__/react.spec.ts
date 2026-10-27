/**
 * React adapter (AI2-501) in jsdom: native rendering, intents, StrictMode.
 */

import type { ContentRenderer } from '@zeus-web/ai-primitives'
import type { ReactNode } from 'react'

import {
  createAiSession,
  createApprovalController,
  createComposerController,
  createConversationController,
  createEventFactory,
  createMockHost,
} from '@zeus-web/ai-core'
import { createRendererRegistry } from '@zeus-web/ai-primitives'
import { act, createElement, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import {
  AiApprovalPrompt,
  AiComposer,
  AiMessage,
  AiMessageTimeline,
  AiSessionProvider,
} from '../src'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const T = '2026-01-01T00:00:00.000Z'
const roots: { unmount: () => void }[] = []

afterEach(() => {
  for (const root of roots.splice(0)) act(() => root.unmount())
  document.body.innerHTML = ''
})

function mount(node: ReactNode): HTMLElement {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  roots.push(root)
  act(() => root.render(node))
  return container
}

function setup() {
  const host = createMockHost({ streamId: 's' })
  const session = createAiSession({
    host,
    streamId: 's',
    snapshotScope: { kind: 'conversation', id: 'conv-1' },
  })
  const factory = createEventFactory('s')
  const emit = (
    type: Parameters<typeof factory.create>[0],
    id: string,
    payload: unknown,
  ) =>
    act(() => {
      session.store.ingest(factory.create(type, id, payload))
    })
  emit('conversation.upserted', 'conv-1', {
    conversation: { id: 'conv-1', title: 'c', revision: 1 },
  })
  return { host, session, emit }
}

function message(
  id: string,
  text: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    message: {
      id,
      conversationId: 'conv-1',
      author: 'assistant',
      parts: [
        { id: 'p1', kind: 'text', revision: 0, text, format: 'markdown' },
      ],
      status: 'complete',
      revision: 1,
      createdAt: T,
      ...overrides,
    },
  }
}

function typeInto(textarea: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    'value',
  )!.set!
  act(() => {
    setter.call(textarea, value)
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('react composer', () => {
  it('types, respects IME and submits once through the host', async () => {
    const { host, session } = setup()
    const controller = createComposerController({
      session,
      conversationId: 'conv-1',
    })
    const container = mount(
      createElement(AiComposer, { controller, label: 'Ask' }),
    )
    const textarea = container.querySelector('textarea')!

    expect(textarea.getAttribute('aria-label')).toBe('Ask')
    typeInto(textarea, '你好')
    expect(controller.getSnapshot().text).toBe('你好')

    act(() => {
      textarea.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          isComposing: true,
        }),
      )
    })
    expect(host.commands()).toHaveLength(0)

    await act(async () => {
      textarea.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      )
    })
    expect(host.commands()).toHaveLength(1)
    expect(
      container
        .querySelector('[data-zw-ai="composer"]')
        ?.getAttribute('data-state'),
    ).toBe('accepted')
  })
})

describe('react message', () => {
  it('renders untrusted markdown as inert nodes', () => {
    const { session, emit } = setup()
    emit(
      'message.created',
      'm1',
      message(
        'm1',
        '<img src=x onerror=alert(1)> [x](javascript:alert(1)) **ok**',
      ),
    )
    const container = mount(
      createElement(AiMessage, { session, messageId: 'm1' }),
    )

    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('a')).toBeNull()
    expect(container.querySelector('strong')?.textContent).toBe('ok')
    expect(container.querySelectorAll('[onerror]')).toHaveLength(0)
    // The tag survives only as escaped, visible text.
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>')
  })

  it('renders custom ReactNode renderers and degrades when they throw', () => {
    const { session, emit } = setup()
    emit('message.created', 'm1', message('m1', 'hello'))
    const custom: ContentRenderer<ReactNode> = {
      id: 'shout',
      canRender: part => part.kind === 'text',
      render: ctx =>
        createElement(
          'mark',
          { 'data-testid': 'custom' },
          (ctx.part as { text: string }).text.toUpperCase(),
        ),
    }
    const broken: ContentRenderer<ReactNode> = {
      id: 'broken',
      canRender: () => true,
      render: () => {
        throw new Error('boom')
      },
    }

    const ok = mount(
      createElement(AiMessage, {
        session,
        messageId: 'm1',
        renderers: createRendererRegistry([custom]),
      }),
    )
    expect(ok.querySelector('mark')?.textContent).toBe('HELLO')

    const degraded = mount(
      createElement(AiMessage, {
        session,
        messageId: 'm1',
        renderers: createRendererRegistry([broken]),
      }),
    )
    expect(degraded.querySelector('p')?.textContent).toBe('hello')
  })

  it('updates only the streaming message', async () => {
    const { session, emit } = setup()
    emit('message.created', 'm1', message('m1', 'first'))
    emit(
      'message.created',
      'm2',
      message('m2', '', { status: 'streaming', parentMessageId: 'm1' }),
    )
    const conversation = createConversationController({
      session,
      conversationId: 'conv-1',
    })
    const container = mount(
      createElement(
        AiSessionProvider,
        { session },
        createElement(AiMessageTimeline, { conversation }),
      ),
    )

    const articles = container.querySelectorAll('[role="article"]')
    expect(articles).toHaveLength(2)
    const first = articles[0].innerHTML

    emit('message.part.delta', 'm2', {
      messageId: 'm2',
      partId: 'p1',
      baseRevision: 0,
      nextRevision: 1,
      append: 'Hel',
    })
    emit('message.part.delta', 'm2', {
      messageId: 'm2',
      partId: 'p1',
      baseRevision: 1,
      nextRevision: 2,
      append: 'lo',
    })
    emit('message.completed', 'm2', {
      messageId: 'm2',
      revision: 4,
      status: 'complete',
    })

    expect(
      container.querySelectorAll('[role="article"]')[1].textContent,
    ).toContain('Hello')
    expect(container.querySelectorAll('[role="article"]')[0].innerHTML).toBe(
      first,
    )
    expect(
      container.querySelector('[role="feed"]')?.getAttribute('aria-busy'),
    ).toBe('false')
  })
})

describe('react approval', () => {
  it('focuses reject first, sends one approval and waits for the host', async () => {
    const { host, session, emit } = setup()
    emit('execution.started', 'e1', {
      execution: {
        id: 'e1',
        kind: 'agent',
        status: 'running',
        createdAt: T,
        revision: 1,
        activeStepIds: [],
      },
    })
    emit('approval.requested', 'a1', {
      approval: {
        id: 'a1',
        executionId: 'e1',
        title: 'Delete branch',
        summary: 'git branch -D old',
        operation: { kind: 'shell', target: 'repo:old' },
        scope: 'once',
        risk: 'high',
        status: 'pending',
        revision: 1,
      },
    })
    const controller = createApprovalController({ session, approvalId: 'a1' })
    const container = mount(
      createElement(
        StrictMode,
        null,
        createElement(AiApprovalPrompt, { controller }),
      ),
    )

    const reject = container.querySelector<HTMLButtonElement>(
      '[data-action="reject"]',
    )!
    const approve = container.querySelector<HTMLButtonElement>(
      '[data-action="approve"]',
    )!
    expect(document.activeElement).toBe(reject)
    expect(container.querySelector('[data-detail="scope"]')?.textContent).toBe(
      'This one time only',
    )

    await act(async () => {
      approve.click()
      approve.click()
    })
    expect(host.commands()).toHaveLength(1)
    expect(
      container
        .querySelector('[role="alertdialog"]')
        ?.getAttribute('data-status'),
    ).toBe('submitted')
  })
})

describe('react ssr', () => {
  it('renders on the server without touching DOM globals during import', () => {
    const { session } = setup()
    const controller = createComposerController({
      session,
      conversationId: 'conv-1',
    })
    const html = renderToString(createElement(AiComposer, { controller }))
    expect(html).toContain('textarea')
  })
})
