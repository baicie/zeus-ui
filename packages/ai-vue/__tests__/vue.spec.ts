/**
 * Vue adapter (AI2-502) in jsdom: native rendering, scoped slots, intents.
 */

import {
  createAiSession,
  createApprovalController,
  createComposerController,
  createConversationController,
  createEventFactory,
  createMockHost,
} from '@zeus-web/ai-core'
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, createSSRApp, h, nextTick } from 'vue'
import { renderToString } from 'vue/server-renderer'
import {
  AiApprovalPrompt,
  AiComposer,
  AiMessage,
  AiMessageTimeline,
} from '../src'

const T = '2026-01-01T00:00:00.000Z'
const apps: { unmount: () => void }[] = []

afterEach(() => {
  for (const app of apps.splice(0)) app.unmount()
  document.body.innerHTML = ''
})

function mount(render: () => ReturnType<typeof h>): HTMLElement {
  const container = document.createElement('div')
  document.body.append(container)
  const app = createApp({ render })
  app.mount(container)
  apps.push(app)
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
  ) => session.store.ingest(factory.create(type, id, payload))
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

const flushFrames = () => new Promise(resolve => setTimeout(resolve, 30))

describe('vue composer', () => {
  it('types, respects IME and submits once', async () => {
    const { host, session } = setup()
    const controller = createComposerController({
      session,
      conversationId: 'conv-1',
    })
    const container = mount(() => h(AiComposer, { controller, label: 'Ask' }))
    const textarea = container.querySelector('textarea')!

    textarea.value = 'こんにちは'
    textarea.dispatchEvent(new Event('input'))
    await nextTick()
    expect(controller.getSnapshot().text).toBe('こんにちは')

    textarea.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', isComposing: true }),
    )
    expect(host.commands()).toHaveLength(0)
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    await flushFrames()
    await nextTick()

    expect(host.commands()).toHaveLength(1)
    expect(
      container
        .querySelector('[data-zw-ai="composer"]')
        ?.getAttribute('data-state'),
    ).toBe('accepted')
  })
})

describe('vue message', () => {
  it('renders untrusted markdown inertly and supports a block scoped slot', async () => {
    const { session, emit } = setup()
    emit(
      'message.created',
      'm1',
      message('m1', '<img src=x onerror=alert(1)> [x](javascript:alert(1))'),
    )
    const plain = mount(() => h(AiMessage, { session, messageId: 'm1' }))
    expect(plain.querySelectorAll('img, a, [onerror]')).toHaveLength(0)

    const slotted = mount(() =>
      h(
        AiMessage,
        { session, messageId: 'm1' },
        { block: () => h('mark', 'custom VNode') },
      ),
    )
    expect(slotted.querySelector('mark')?.textContent).toBe('custom VNode')
  })

  it('streams into one message without re-rendering its sibling', async () => {
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
    const container = mount(() =>
      h(AiMessageTimeline, { conversation, session }),
    )
    await nextTick()

    const first = container.querySelectorAll('[role="article"]')[0]
    const before = first.innerHTML
    emit('message.part.delta', 'm2', {
      messageId: 'm2',
      partId: 'p1',
      baseRevision: 0,
      nextRevision: 1,
      append: 'Hello',
    })
    emit('message.completed', 'm2', {
      messageId: 'm2',
      revision: 3,
      status: 'complete',
    })
    await nextTick()

    expect(
      container.querySelectorAll('[role="article"]')[1].textContent,
    ).toContain('Hello')
    expect(container.querySelectorAll('[role="article"]')[0]).toBe(first)
    expect(first.innerHTML).toBe(before)
  })
})

describe('vue approval', () => {
  it('focuses reject first and sends a single approval', async () => {
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
        title: 'Push',
        summary: 'git push',
        operation: { kind: 'shell', target: 'origin' },
        scope: 'session',
        risk: 'medium',
        status: 'pending',
        revision: 1,
      },
    })
    const controller = createApprovalController({ session, approvalId: 'a1' })
    const container = mount(() => h(AiApprovalPrompt, { controller }))
    await nextTick()

    expect(document.activeElement?.getAttribute('data-action')).toBe('reject')
    const approve = container.querySelector<HTMLButtonElement>(
      '[data-action="approve"]',
    )!
    approve.click()
    approve.click()
    await flushFrames()
    await nextTick()

    expect(host.commands()).toHaveLength(1)
    expect(
      container
        .querySelector('[role="alertdialog"]')
        ?.getAttribute('data-status'),
    ).toBe('submitted')
  })
})

describe('vue ssr', () => {
  it('renders on the server', async () => {
    const { session } = setup()
    const controller = createComposerController({
      session,
      conversationId: 'conv-1',
    })
    const html = await renderToString(
      createSSRApp({ render: () => h(AiComposer, { controller }) }),
    )
    expect(html).toContain('<textarea')
  })
})
