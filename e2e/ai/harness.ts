/**
 * Cross-framework harness for the AI Headless V2 contract, security,
 * accessibility and performance suites (AI2-505 – AI2-508).
 *
 * Every scenario mounts the *same* controllers into React, Vue and Web
 * Components and drives them with real DOM events, so a difference in
 * behaviour or semantics between adapters is a test failure.
 */

import type {
  AiSession,
  ApprovalController,
  ComposerController,
  ConversationController,
  DomainEventType,
  ExecutionController,
  ReviewController,
  RunSwitcherController,
} from '@zeus-web/ai-core'
import type { ContextPicker } from '@zeus-web/ai-primitives'

import {
  createAiSession,
  createEventFactory,
  createMockHost,
} from '@zeus-web/ai-core'
import {
  AiApprovalPrompt as ReactApproval,
  AiComposer as ReactComposer,
  AiDiffViewer as ReactDiff,
  AiExecutionStatus as ReactExecution,
  AiFileChangeTree as ReactFileTree,
  AiRunSwitcher as ReactRuns,
  AiMessageTimeline as ReactTimeline,
} from '@zeus-web/ai-react'
import {
  AiApprovalPrompt as VueApproval,
  AiComposer as VueComposer,
  AiDiffViewer as VueDiff,
  AiExecutionStatus as VueExecution,
  AiFileChangeTree as VueFileTree,
  AiRunSwitcher as VueRuns,
  AiMessageTimeline as VueTimeline,
} from '@zeus-web/ai-vue'
import { defineAiElements } from '@zeus-web/ai-wc'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { createApp, h, nextTick } from 'vue'

;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

export const FRAMEWORKS = ['react', 'vue', 'wc'] as const
export type Framework = (typeof FRAMEWORKS)[number]

export const T = '2026-01-01T00:00:00.000Z'

export interface Mounted {
  container: HTMLElement
  /** Let microtasks, frames and framework schedulers settle. */
  flush: () => Promise<void>
  unmount: () => void
}

export type Surface =
  | {
      kind: 'composer'
      controller: ComposerController
      contextPicker?: ContextPicker
    }
  | {
      kind: 'timeline'
      session: AiSession
      conversation: ConversationController
    }
  | {
      kind: 'approval'
      controller: ApprovalController
      confirmationPhrase?: string
    }
  | { kind: 'execution'; controller: ExecutionController }
  | { kind: 'runs'; controller: RunSwitcherController }
  | { kind: 'file-tree'; review: ReviewController }
  | { kind: 'diff'; review: ReviewController }

function settle(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 40))
}

function mountReact(surface: Surface, container: HTMLElement): Mounted {
  const root = createRoot(container)
  const element = (() => {
    switch (surface.kind) {
      case 'composer':
        return createElement(ReactComposer, {
          controller: surface.controller,
          contextPicker: surface.contextPicker,
          label: 'Message',
        })
      case 'timeline':
        return createElement(ReactTimeline, {
          session: surface.session,
          conversation: surface.conversation,
          label: 'Conversation',
        })
      case 'approval':
        return createElement(ReactApproval, {
          controller: surface.controller,
          confirmationPhrase: surface.confirmationPhrase,
        })
      case 'execution':
        return createElement(ReactExecution, { controller: surface.controller })
      case 'runs':
        return createElement(ReactRuns, { controller: surface.controller })
      case 'file-tree':
        return createElement(ReactFileTree, { review: surface.review })
      case 'diff':
        return createElement(ReactDiff, { review: surface.review })
    }
  })()
  act(() => root.render(element))
  return {
    container,
    flush: async () => {
      await act(async () => {
        await settle()
      })
    },
    unmount: () => act(() => root.unmount()),
  }
}

function mountVue(surface: Surface, container: HTMLElement): Mounted {
  const render = () => {
    switch (surface.kind) {
      case 'composer':
        return h(VueComposer, {
          controller: surface.controller,
          contextPicker: surface.contextPicker,
          label: 'Message',
        })
      case 'timeline':
        return h(VueTimeline, {
          session: surface.session,
          conversation: surface.conversation,
          label: 'Conversation',
        })
      case 'approval':
        return h(VueApproval, {
          controller: surface.controller,
          confirmationPhrase: surface.confirmationPhrase,
        })
      case 'execution':
        return h(VueExecution, { controller: surface.controller })
      case 'runs':
        return h(VueRuns, { controller: surface.controller })
      case 'file-tree':
        return h(VueFileTree, { review: surface.review })
      case 'diff':
        return h(VueDiff, { review: surface.review })
    }
  }
  const app = createApp({ render })
  app.mount(container)
  return {
    container,
    flush: async () => {
      await settle()
      await nextTick()
    },
    unmount: () => app.unmount(),
  }
}

const WC_TAGS: Record<Surface['kind'], string> = {
  composer: 'zw-ai-composer',
  timeline: 'zw-ai-message-timeline',
  approval: 'zw-ai-approval-prompt',
  execution: 'zw-ai-execution-status',
  runs: 'zw-ai-run-switcher',
  'file-tree': 'zw-ai-file-change-tree',
  diff: 'zw-ai-diff-viewer',
}

function mountWc(surface: Surface, container: HTMLElement): Mounted {
  defineAiElements()
  const element = document.createElement(WC_TAGS[surface.kind]) as HTMLElement &
    Record<string, unknown>
  const { kind, ...props } = surface
  void kind
  if (surface.kind === 'composer') element.setAttribute('label', 'Message')
  if (surface.kind === 'timeline') element.setAttribute('label', 'Conversation')
  if (surface.kind === 'approval' && surface.confirmationPhrase) {
    element.setAttribute('confirmation-phrase', surface.confirmationPhrase)
  }
  Object.assign(element, props)
  container.append(element)
  return {
    container,
    flush: settle,
    unmount: () => element.remove(),
  }
}

export async function mount(
  framework: Framework,
  surface: Surface,
): Promise<Mounted> {
  const container = document.createElement('div')
  container.dataset.framework = framework
  document.body.append(container)
  const mounted =
    framework === 'react'
      ? mountReact(surface, container)
      : framework === 'vue'
        ? mountVue(surface, container)
        : mountWc(surface, container)
  await mounted.flush()
  return {
    ...mounted,
    unmount: () => {
      mounted.unmount()
      container.remove()
    },
  }
}

/** A fresh session over a mock host, plus an in-order event emitter. */
export function createWorld(streamId = 'contract') {
  const host = createMockHost({ streamId })
  const session = createAiSession({
    host,
    streamId,
    snapshotScope: { kind: 'conversation', id: 'conv-1' },
  })
  const factory = createEventFactory(streamId)
  const emit = (type: DomainEventType, id: string, payload: unknown) => {
    const result = session.store.ingest(factory.create(type, id, payload))
    if (result.status !== 'applied') {
      throw new Error(`${type} ${id}: ${JSON.stringify(result)}`)
    }
  }
  return { host, session, emit }
}

// ---------------------------------------------------------------------------
// Semantic snapshot
// ---------------------------------------------------------------------------

const ID_REF_ATTRS = new Set([
  'aria-labelledby',
  'aria-describedby',
  'aria-controls',
  'aria-activedescendant',
  'for',
])

const KEPT_ATTRS = [
  'role',
  'type',
  'disabled',
  'hidden',
  'tabindex',
  'href',
  'rel',
  'data-state',
  'data-status',
  'data-action',
  'data-zw-ai',
  'data-kind',
]

function describeRef(root: HTMLElement, value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map(id => {
      const target = root.ownerDocument.getElementById(id)
      if (!target || !root.contains(target)) return '#missing'
      return `#${target.localName}${target.getAttribute('role') ? `[${target.getAttribute('role')}]` : ''}`
    })
    .join(' ')
}

export interface SemanticNode {
  tag: string
  attrs: Record<string, string>
  text?: string
}

/**
 * Framework-independent view of what assistive technology and tests can
 * observe: semantic tags, roles, ARIA (with id references resolved to their
 * targets), states and leaf text. Wrapper elements without semantics
 * (custom element hosts, slot wrappers, fragments) are ignored.
 */
export function semanticSnapshot(root: HTMLElement): SemanticNode[] {
  const nodes: SemanticNode[] = []
  const walker = root.ownerDocument.createTreeWalker(root, 1)

  for (
    let current = walker.nextNode() as HTMLElement | null;
    current;
    current = walker.nextNode() as HTMLElement | null
  ) {
    const tag = current.localName
    if (tag.startsWith('zw-ai-') || current.hasAttribute('data-slot')) continue

    const attrs: Record<string, string> = {}
    for (const attribute of Array.from(current.attributes)) {
      const name = attribute.name
      if (name.startsWith('aria-')) {
        attrs[name] = ID_REF_ATTRS.has(name)
          ? describeRef(root, attribute.value)
          : attribute.value
      } else if (name === 'for') {
        attrs[name] = describeRef(root, attribute.value)
      } else if (KEPT_ATTRS.includes(name)) {
        attrs[name] = attribute.value
      }
    }
    if (
      (current as HTMLInputElement).value !== undefined &&
      ['textarea', 'input'].includes(tag)
    ) {
      attrs.value = (current as HTMLInputElement).value
    }

    // Form controls are compared by `value`; React also mirrors a
    // textarea's value into textContent, which no reader announces.
    const leaf = current.children.length === 0 && tag !== 'textarea'
    const text = leaf
      ? current.textContent?.replace(/\s+/g, ' ').trim()
      : undefined
    if (Object.keys(attrs).length === 0 && !text) continue

    nodes.push(text ? { tag, attrs, text } : { tag, attrs })
  }

  return nodes
}

export function press(
  target: Element,
  key: string,
  init: KeyboardEventInit = {},
): void {
  target.dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
      ...init,
    }),
  )
}

export function typeText(
  target: HTMLTextAreaElement | HTMLInputElement,
  value: string,
): void {
  const prototype = Object.getPrototypeOf(target) as object
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
  setter?.call(target, value)
  target.dispatchEvent(new Event('input', { bubbles: true }))
}

/** Change set + review controller with a two-file diff, for coding surfaces. */
export function createReviewWorld() {
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
  world.emit('changeset.updated', 'cs-1', {
    changeset: {
      id: 'cs-1',
      executionId: 'e1',
      workspaceId: 'ws-1',
      baseRevision: 'abc',
      files: [
        {
          path: 'src/a.ts',
          status: 'modified',
          stats: { additions: 1, deletions: 1 },
        },
        {
          path: 'src/lib/b.ts',
          status: 'added',
          stats: { additions: 2, deletions: 0 },
        },
        {
          path: 'README.md',
          status: 'modified',
          stats: { additions: 1, deletions: 0 },
        },
      ],
      status: 'ready',
      revision: 1,
    },
  })
  return world
}

export const SAMPLE_DIFF = `--- a/src/a.ts
+++ b/src/a.ts
@@ -1,3 +1,3 @@ export function a()
 const x = 1
-const y = 2
+const y = 3
 export { x, y }
`
