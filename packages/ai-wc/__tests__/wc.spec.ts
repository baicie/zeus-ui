/**
 * Web Component adapter (AI2-503) in jsdom: on-demand registration,
 * property-only data, light-DOM projection, disconnect cleanup, focus
 * preservation across re-renders.
 */

import {
  createAiSession,
  createApprovalController,
  createComposerController,
  createConversationController,
  createEventFactory,
  createMockHost,
} from '@zeus-web/ai-core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  defineAiApprovalPrompt,
  defineAiComposer,
  defineAiElements,
  defineAiMessage,
  defineAiMessageTimeline,
} from '../src'

const T = '2026-01-01T00:00:00.000Z'
const tick = () => new Promise(resolve => setTimeout(resolve, 30))

afterEach(() => {
  document.body.innerHTML = ''
})

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

describe('registration', () => {
  it('defines elements on demand and only once', () => {
    expect(customElements.get('zw-ai-composer')).toBeUndefined()
    defineAiComposer()
    defineAiComposer()
    expect(customElements.get('zw-ai-composer')).toBeDefined()
    expect(customElements.get('zw-ai-diff-viewer')).toBeUndefined()
    defineAiElements()
    expect(customElements.get('zw-ai-diff-viewer')).toBeDefined()
  })
})

describe('zw-ai-composer', () => {
  it('takes the controller as a property, keeps focus while typing and submits once', async () => {
    defineAiComposer()
    const { host, session } = setup()
    const controller = createComposerController({
      session,
      conversationId: 'conv-1',
    })
    const element = document.createElement('zw-ai-composer') as HTMLElement & {
      controller?: unknown
    }
    element.setAttribute('controller', '[object Object]')
    element.innerHTML = '<button slot="toolbar" id="attach">Attach</button>'
    document.body.append(element)
    expect(element.querySelector('textarea')).toBeNull()

    element.controller = controller
    await tick()
    const textarea = element.querySelector('textarea')!
    expect(
      element.querySelector('#attach')?.closest('[data-part="toolbar"]'),
    ).not.toBeNull()

    textarea.focus()
    textarea.value = 'hello'
    textarea.dispatchEvent(new Event('input'))
    await tick()
    expect(controller.getSnapshot().text).toBe('hello')
    expect(element.querySelector('textarea')).toBe(textarea)
    expect(document.activeElement).toBe(textarea)

    textarea.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', isComposing: true }),
    )
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    await tick()
    expect(host.commands()).toHaveLength(1)
    expect(
      element
        .querySelector('[data-zw-ai="composer"]')
        ?.getAttribute('data-state'),
    ).toBe('accepted')
  })

  it('releases subscriptions on disconnect', async () => {
    defineAiComposer()
    const { session } = setup()
    const controller = createComposerController({
      session,
      conversationId: 'conv-1',
    })
    const unsubscribe = vi.fn()
    const subscribe = controller.subscribe
    controller.subscribe = ((...args: Parameters<typeof subscribe>) => {
      const stop = subscribe(...args)
      return () => {
        unsubscribe()
        stop()
      }
    }) as typeof subscribe
    const element = Object.assign(document.createElement('zw-ai-composer'), {
      controller,
    })
    document.body.append(element)
    await tick()

    element.remove()
    expect(unsubscribe).toHaveBeenCalled()
  })
})

describe('zw-ai-message / timeline', () => {
  it('renders markdown inertly', async () => {
    defineAiMessage()
    const { session, emit } = setup()
    emit(
      'message.created',
      'm1',
      message(
        'm1',
        '<script>alert(1)</script> [x](javascript:alert(1)) `code`',
      ),
    )
    const element = Object.assign(document.createElement('zw-ai-message'), {
      session,
      messageId: 'm1',
    })
    document.body.append(element)
    await tick()

    expect(element.querySelectorAll('script, a, [onerror]')).toHaveLength(0)
    expect(element.querySelector('code')?.textContent).toBe('code')
    expect(element.textContent).toContain('<script>alert(1)</script>')
  })

  it('streams into one message element and keeps the others untouched', async () => {
    defineAiMessageTimeline()
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
    const element = Object.assign(
      document.createElement('zw-ai-message-timeline'),
      { session, conversation },
    )
    document.body.append(element)
    await tick()

    const messages = element.querySelectorAll('zw-ai-message')
    expect(messages).toHaveLength(2)
    const first = messages[0].innerHTML

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
    await tick()

    expect(element.querySelectorAll('zw-ai-message')[1].textContent).toContain(
      'Hello',
    )
    expect(element.querySelectorAll('zw-ai-message')[0]).toBe(messages[0])
    expect(messages[0].innerHTML).toBe(first)
    expect(
      element.querySelector('[role="feed"]')?.getAttribute('aria-busy'),
    ).toBe('false')
  })
})

describe('zw-ai-approval-prompt', () => {
  it('focuses reject, sends one approval and emits dismiss without rejecting', async () => {
    defineAiApprovalPrompt()
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
        title: 'Deploy',
        summary: 'deploy to staging',
        operation: { kind: 'deploy', target: 'staging' },
        scope: 'once',
        risk: 'high',
        status: 'pending',
        revision: 1,
      },
    })
    const controller = createApprovalController({ session, approvalId: 'a1' })
    const element = Object.assign(
      document.createElement('zw-ai-approval-prompt'),
      { controller },
    )
    const dismissed = vi.fn()
    element.addEventListener('zw-ai-dismiss', dismissed)
    document.body.append(element)
    await tick()

    expect(document.activeElement?.getAttribute('data-action')).toBe('reject')
    element
      .querySelector('[role="alertdialog"]')!
      .dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      )
    expect(dismissed).toHaveBeenCalledOnce()
    expect(host.commands()).toHaveLength(0)

    const approve = element.querySelector<HTMLButtonElement>(
      '[data-action="approve"]',
    )!
    approve.click()
    approve.click()
    await tick()
    expect(host.commands()).toHaveLength(1)
    expect(
      element
        .querySelector('[role="alertdialog"]')
        ?.getAttribute('data-status'),
    ).toBe('submitted')
  })
})
