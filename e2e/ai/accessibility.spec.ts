/**
 * AI2-507 · Accessibility and keyboard suite.
 *
 * axe-core over every surface in every renderer, plus DOM keyboard tests
 * for the WAI-ARIA patterns the design requires: combobox (@ / slash),
 * dialog (approval), treeview (file tree), feed (timeline) and tabs (run
 * switcher). Real screen-reader sampling is a manual step recorded in
 * docs/ai-headless-v2/quality-gates.md.
 */

import type { Framework, Mounted, Surface } from './harness'

import {
  createApprovalController,
  createComposerController,
  createConversationController,
  createExecutionController,
  createReviewController,
  createRunSwitcher,
} from '@zeus-web/ai-core'
import { createContextPicker } from '@zeus-web/ai-primitives'
import axe from 'axe-core'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createReviewWorld,
  createWorld,
  FRAMEWORKS,
  mount,
  press,
  SAMPLE_DIFF,
  T,
  typeText,
} from './harness'

const mounted: Mounted[] = []

afterEach(() => {
  for (const entry of mounted.splice(0)) entry.unmount()
  document.body.innerHTML = ''
})

async function show(framework: Framework, surface: Surface): Promise<Mounted> {
  const view = await mount(framework, surface)
  mounted.push(view)
  return view
}

async function expectNoViolations(root: HTMLElement): Promise<void> {
  const result = await axe.run(root, {
    rules: {
      // jsdom has no layout or colours; contrast is checked in the browser.
      'color-contrast': { enabled: false },
      // Fragments are mounted outside a page landmark on purpose.
      region: { enabled: false },
    },
  })
  const violations = result.violations.map(violation => ({
    id: violation.id,
    nodes: violation.nodes.map(node => node.html).slice(0, 3),
  }))
  expect(violations).toEqual([])
}

function surfaces(): Record<string, () => Promise<Surface>> {
  return {
    composer: async () => {
      const world = createWorld()
      const controller = createComposerController({
        session: world.session,
        conversationId: 'conv-1',
      })
      controller.addAttachment({ name: 'log.txt' })
      return { kind: 'composer', controller }
    },
    timeline: async () => {
      const world = createWorld()
      world.emit('conversation.upserted', 'conv-1', {
        conversation: { id: 'conv-1', title: 'c', revision: 1 },
      })
      world.emit('message.created', 'm1', {
        message: {
          id: 'm1',
          conversationId: 'conv-1',
          author: 'assistant',
          parts: [
            {
              id: 'p1',
              kind: 'text',
              revision: 0,
              text: '# Title\n\n- a\n- [link](https://example.com)\n\n```js\nx()\n```',
              format: 'markdown',
            },
          ],
          status: 'complete',
          revision: 1,
          createdAt: T,
        },
      })
      const conversation = createConversationController({
        session: world.session,
        conversationId: 'conv-1',
      })
      return { kind: 'timeline', session: world.session, conversation }
    },
    approval: async () => {
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
      world.emit('approval.requested', 'a1', {
        approval: {
          id: 'a1',
          executionId: 'e1',
          title: 'Run',
          summary: 'pnpm test',
          operation: { kind: 'shell', target: 'ws' },
          scope: 'once',
          risk: 'high',
          status: 'pending',
          revision: 1,
        },
      })
      return {
        kind: 'approval',
        controller: createApprovalController({
          session: world.session,
          approvalId: 'a1',
        }),
        confirmationPhrase: 'run',
      }
    },
    execution: async () => {
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
      return {
        kind: 'execution',
        controller: createExecutionController({
          session: world.session,
          executionId: 'e1',
          capabilities: { pause: true },
        }),
      }
    },
    runs: async () => {
      const world = createWorld()
      for (const id of ['e1', 'e2', 'e3']) {
        world.emit('execution.started', id, {
          execution: {
            id,
            kind: 'agent',
            status: 'running',
            createdAt: T,
            revision: 1,
            activeStepIds: [],
          },
        })
      }
      return {
        kind: 'runs',
        controller: createRunSwitcher({ session: world.session }),
      }
    },
    fileTree: async () => {
      const world = createReviewWorld()
      return {
        kind: 'file-tree',
        review: createReviewController({
          session: world.session,
          changeSetId: 'cs-1',
          loadDiff: async () => SAMPLE_DIFF,
        }),
      }
    },
    diff: async () => {
      const world = createReviewWorld()
      const review = createReviewController({
        session: world.session,
        changeSetId: 'cs-1',
        loadDiff: async () => SAMPLE_DIFF,
      })
      await review.selectFile('src/a.ts')
      return { kind: 'diff', review }
    },
  }
}

describe('axe: no violations', () => {
  for (const [name, build] of Object.entries(surfaces())) {
    it.each(FRAMEWORKS)(`${name} · %s`, async framework => {
      const view = await show(framework, await build())
      await expectNoViolations(view.container)
    })
  }
})

describe('keyboard patterns', () => {
  it.each(FRAMEWORKS)(
    '%s · combobox: arrows, Enter selects without sending, Escape closes',
    async framework => {
      const world = createWorld()
      const controller = createComposerController({
        session: world.session,
        conversationId: 'conv-1',
      })
      let caret = 0
      const contextPicker = createContextPicker({
        composer: controller,
        caret: () => caret,
        items: () => [
          { id: 'a', label: 'alpha.ts', kind: 'file', trigger: '@' },
          { id: 'b', label: 'beta.ts', kind: 'file', trigger: '@' },
        ],
      })
      const view = await show(framework, {
        kind: 'composer',
        controller,
        contextPicker,
      })
      const textarea = view.container.querySelector('textarea')!

      caret = 2
      typeText(textarea, '@a')
      await view.flush()
      const listbox = () =>
        view.container.ownerDocument.getElementById(
          textarea.getAttribute('aria-controls')!,
        )!
      expect(textarea.getAttribute('aria-haspopup')).toBe('listbox')
      expect(listbox().hasAttribute('hidden')).toBe(false)
      const active = textarea.getAttribute('aria-activedescendant')!
      expect(
        view.container.ownerDocument.getElementById(active)?.textContent,
      ).toBe('alpha.ts')

      press(textarea, 'Enter')
      await view.flush()
      expect(controller.getSnapshot().text).toBe('@alpha.ts ')
      expect(world.host.commands()).toHaveLength(0)
      expect(listbox().hasAttribute('hidden')).toBe(true)

      caret = 12
      typeText(textarea, '@alpha.ts @b')
      await view.flush()
      press(textarea, 'Escape')
      await view.flush()
      expect(listbox().hasAttribute('hidden')).toBe(true)
    },
  )

  it.each(FRAMEWORKS)(
    '%s · dialog: initial focus, Tab stays inside',
    async framework => {
      const view = await show(framework, await surfaces().approval())
      const doc = view.container.ownerDocument
      const dialog = view.container.querySelector('[role="alertdialog"]')!
      expect(dialog.getAttribute('aria-modal')).toBe('true')
      expect(doc.activeElement?.getAttribute('data-action')).toBe('reject')

      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled])',
        ),
      )
      const last = focusables[focusables.length - 1]
      last.focus()
      press(last, 'Tab')
      expect(doc.activeElement).toBe(focusables[0])
      press(focusables[0], 'Tab', { shiftKey: true })
      expect(doc.activeElement).toBe(last)
    },
  )

  it.each(FRAMEWORKS)(
    '%s · treeview: arrows move focus and expand',
    async framework => {
      const view = await show(framework, await surfaces().fileTree())
      const doc = view.container.ownerDocument
      const tree = view.container.querySelector('[role="tree"]')!
      const items = () =>
        Array.from(tree.querySelectorAll<HTMLElement>('[role="treeitem"]'))

      expect(items().filter(item => item.tabIndex === 0)).toHaveLength(1)
      items()[0].focus()
      press(items()[0], 'ArrowDown')
      await view.flush()
      expect(doc.activeElement).toBe(items()[1])
      expect(doc.activeElement?.getAttribute('aria-expanded')).toBe('true')
      press(doc.activeElement!, 'ArrowLeft')
      await view.flush()
      expect(items()[1].getAttribute('aria-expanded')).toBe('false')
    },
  )

  it.each(FRAMEWORKS)(
    '%s · feed: PageDown / PageUp move between messages',
    async framework => {
      const world = createWorld()
      world.emit('conversation.upserted', 'conv-1', {
        conversation: { id: 'conv-1', title: 'c', revision: 1 },
      })
      for (const [id, parent] of [
        ['m1', undefined],
        ['m2', 'm1'],
        ['m3', 'm2'],
      ] as const) {
        world.emit('message.created', id, {
          message: {
            id,
            conversationId: 'conv-1',
            parentMessageId: parent,
            author: 'assistant',
            parts: [
              { id: 'p', kind: 'text', revision: 0, text: id, format: 'plain' },
            ],
            status: 'complete',
            revision: 1,
            createdAt: T,
          },
        })
      }
      const conversation = createConversationController({
        session: world.session,
        conversationId: 'conv-1',
      })
      const view = await show(framework, {
        kind: 'timeline',
        session: world.session,
        conversation,
      })
      const articles = Array.from(
        view.container.querySelectorAll<HTMLElement>('[role="article"]'),
      )

      articles[0].focus()
      press(articles[0], 'PageDown')
      expect(view.container.ownerDocument.activeElement).toBe(articles[1])
      press(articles[1], 'End')
      expect(view.container.ownerDocument.activeElement).toBe(articles[2])
      expect(articles[2].getAttribute('aria-setsize')).toBe('3')
    },
  )

  it.each(FRAMEWORKS)(
    '%s · tabs: arrows select and focus the next run',
    async framework => {
      const view = await show(framework, await surfaces().runs())
      const doc = view.container.ownerDocument
      const tabs = () =>
        Array.from(view.container.querySelectorAll<HTMLElement>('[role="tab"]'))

      tabs()[0].focus()
      press(tabs()[0], 'ArrowRight')
      await view.flush()
      expect(tabs()[1].getAttribute('aria-selected')).toBe('true')
      expect(doc.activeElement).toBe(tabs()[1])
      press(tabs()[1], 'ArrowLeft')
      press(doc.activeElement!, 'ArrowLeft')
      await view.flush()
      expect(tabs()[2].getAttribute('aria-selected')).toBe('true')
    },
  )
})
