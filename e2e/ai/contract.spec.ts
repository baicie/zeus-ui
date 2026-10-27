/**
 * AI2-505 · WC / React / Vue contract suite.
 *
 * One fixture, three renderers: the semantic snapshot (roles, ARIA, states,
 * text) must be identical, and the same user actions must produce the same
 * commands against the host.
 */

import type { Framework, Mounted } from './harness'

import {
  createApprovalController,
  createComposerController,
  createConversationController,
  createExecutionController,
} from '@zeus-web/ai-core'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createWorld,
  FRAMEWORKS,
  mount,
  press,
  semanticSnapshot,
  T,
  typeText,
} from './harness'

const mounted: Mounted[] = []

afterEach(() => {
  for (const entry of mounted.splice(0)) entry.unmount()
  document.body.innerHTML = ''
})

async function track(promise: Promise<Mounted>): Promise<Mounted> {
  const entry = await promise
  mounted.push(entry)
  return entry
}

function seedConversation(world: ReturnType<typeof createWorld>) {
  world.emit('conversation.upserted', 'conv-1', {
    conversation: { id: 'conv-1', title: 'Contract', revision: 1 },
  })
  world.emit('message.created', 'u1', {
    message: {
      id: 'u1',
      conversationId: 'conv-1',
      author: 'user',
      parts: [
        {
          id: 'p1',
          kind: 'text',
          revision: 0,
          text: 'Explain **diffs**',
          format: 'markdown',
        },
      ],
      status: 'complete',
      revision: 1,
      createdAt: T,
    },
  })
  world.emit('message.created', 'a1', {
    message: {
      id: 'a1',
      conversationId: 'conv-1',
      parentMessageId: 'u1',
      author: 'assistant',
      parts: [
        { id: 'p1', kind: 'text', revision: 0, text: '', format: 'markdown' },
      ],
      status: 'streaming',
      revision: 1,
      createdAt: T,
    },
  })
}

function seedApproval(world: ReturnType<typeof createWorld>) {
  world.emit('execution.started', 'e1', {
    execution: {
      id: 'e1',
      kind: 'agent',
      status: 'running',
      createdAt: T,
      revision: 1,
      activeStepIds: [],
    },
  })
  world.emit('approval.requested', 'a1', {
    approval: {
      id: 'a1',
      executionId: 'e1',
      title: 'Run tests',
      summary: 'pnpm test in ws-1',
      operation: { kind: 'shell', target: 'ws-1: pnpm test' },
      scope: 'once',
      risk: 'medium',
      expiresAt: '2099-01-01T00:00:00.000Z',
      status: 'pending',
      revision: 1,
    },
  })
}

describe('composer contract', () => {
  const results: Record<string, unknown> = {}

  it.each(FRAMEWORKS)('%s: type, IME guard, submit once', async framework => {
    const world = createWorld()
    const controller = createComposerController({
      session: world.session,
      conversationId: 'conv-1',
    })
    const view = await track(mount(framework, { kind: 'composer', controller }))
    const textarea = view.container.querySelector('textarea')!

    typeText(textarea, 'Hello world')
    await view.flush()
    press(textarea, 'Enter', { isComposing: true })
    await view.flush()
    const beforeSubmit = semanticSnapshot(view.container)
    press(textarea, 'Enter')
    press(textarea, 'Enter')
    await view.flush()

    results[framework] = {
      beforeSubmit,
      afterSubmit: semanticSnapshot(view.container),
      commands: world.host
        .commands()
        .map(command => [command.type, command.payload]),
    }
    expect(world.host.commands()).toHaveLength(1)
  })

  it('renders identical semantics and commands in every framework', () => {
    // Guard against vacuous equality of empty snapshots.
    expect(JSON.stringify(results.react).length).toBeGreaterThan(300)
    expect(results.vue).toEqual(results.react)
    expect(results.wc).toEqual(results.react)
  })
})

describe('message timeline contract', () => {
  const results: Record<string, unknown> = {}

  it.each(FRAMEWORKS)(
    '%s: stream, complete and render markdown',
    async framework => {
      const world = createWorld()
      seedConversation(world)
      const conversation = createConversationController({
        session: world.session,
        conversationId: 'conv-1',
      })
      const view = await track(
        mount(framework, {
          kind: 'timeline',
          session: world.session,
          conversation,
        }),
      )

      const streaming = semanticSnapshot(view.container)
      world.emit('message.part.delta', 'a1', {
        messageId: 'a1',
        partId: 'p1',
        baseRevision: 0,
        nextRevision: 1,
        append:
          'A diff shows `-` removed and `+` added lines.\n\n```diff\n-a\n+b\n```',
      })
      world.emit('message.completed', 'a1', {
        messageId: 'a1',
        revision: 3,
        status: 'complete',
      })
      await view.flush()

      results[framework] = {
        streaming,
        complete: semanticSnapshot(view.container),
      }
      expect(view.container.querySelectorAll('[role="article"]')).toHaveLength(
        2,
      )
    },
  )

  it('renders identical semantics in every framework', () => {
    // Guard against vacuous equality of empty snapshots.
    expect(JSON.stringify(results.react).length).toBeGreaterThan(300)
    expect(results.vue).toEqual(results.react)
    expect(results.wc).toEqual(results.react)
  })
})

describe('approval contract', () => {
  const results: Record<string, unknown> = {}

  it.each(FRAMEWORKS)(
    '%s: show scope and risk, confirm, approve once',
    async framework => {
      const world = createWorld()
      seedApproval(world)
      const controller = createApprovalController({
        session: world.session,
        approvalId: 'a1',
      })
      const view = await track(
        mount(framework, {
          kind: 'approval',
          controller,
          confirmationPhrase: 'run',
        }),
      )

      const initial = semanticSnapshot(view.container)
      const approve = view.container.querySelector<HTMLButtonElement>(
        '[data-action="approve"]',
      )!
      expect(approve.disabled).toBe(true)

      typeText(
        view.container.querySelector(
          '[data-part="confirmation"] input',
        ) as HTMLInputElement,
        'run',
      )
      await view.flush()
      approve.click()
      approve.click()
      await view.flush()

      results[framework] = {
        initial,
        submitted: semanticSnapshot(view.container),
        commands: world.host
          .commands()
          .map(command => [
            command.type,
            command.idempotencyKey,
            command.payload,
          ]),
      }
      expect(world.host.commands()).toHaveLength(1)
    },
  )

  it('renders identical semantics and commands in every framework', () => {
    // Guard against vacuous equality of empty snapshots.
    expect(JSON.stringify(results.react).length).toBeGreaterThan(300)
    expect(results.vue).toEqual(results.react)
    expect(results.wc).toEqual(results.react)
  })
})

describe('execution contract', () => {
  const results: Record<string, unknown> = {}

  it.each(FRAMEWORKS)(
    '%s: stop is a request until the host confirms',
    async framework => {
      const world = createWorld()
      world.emit('execution.started', 'e1', {
        execution: {
          id: 'e1',
          kind: 'agent',
          status: 'running',
          createdAt: T,
          revision: 1,
          activeStepIds: [],
        },
      })
      const controller = createExecutionController({
        session: world.session,
        executionId: 'e1',
        capabilities: { pause: true },
      })
      const view = await track(
        mount(framework, { kind: 'execution', controller }),
      )

      const running = semanticSnapshot(view.container)
      view.container
        .querySelector<HTMLButtonElement>('[data-action="cancel"]')!
        .click()
      await view.flush()
      const requested = semanticSnapshot(view.container)
      world.emit('execution.status.changed', 'e1', {
        id: 'e1',
        from: 'running',
        to: 'cancelled',
        revision: 2,
      })
      await view.flush()

      results[framework] = {
        running,
        requested,
        cancelled: semanticSnapshot(view.container),
      }
      expect(view.container.textContent).toContain('Cancelled')
    },
  )

  it('renders identical semantics in every framework', () => {
    // Guard against vacuous equality of empty snapshots.
    expect(JSON.stringify(results.react).length).toBeGreaterThan(300)
    expect(results.vue).toEqual(results.react)
    expect(results.wc).toEqual(results.react)
  })
})

describe('framework list', () => {
  it('covers exactly WC, React and Vue', () => {
    expect([...FRAMEWORKS].sort()).toEqual([
      'react',
      'vue',
      'wc',
    ] satisfies Framework[])
  })
})
