/**
 * AI2-508 · Performance harness.
 *
 * Gates are structural (rebuild counts, rendered DOM size, leaked
 * subscriptions) so they are stable across machines; timings are recorded
 * with generous ceilings that only catch order-of-magnitude regressions.
 * Every run writes `temp/ai-headless-perf.json`; the numbers committed in
 * docs/ai-headless-v2/quality-gates.md come from that file.
 */

import type { Framework, Mounted } from './harness'

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  createAiStore,
  createConversationController,
  createEventFactory,
  createRunSwitcher,
  parseUnifiedDiff,
  selectConversationTimeline,
} from '@zeus-web/ai-core'
import { buildFileTree } from '@zeus-web/ai-primitives'
import { afterAll, afterEach, describe, expect, it } from 'vitest'
import { createWorld, FRAMEWORKS, mount, T } from './harness'

const report: Record<string, unknown> = {}
const mounted: Mounted[] = []

afterEach(() => {
  for (const entry of mounted.splice(0)) entry.unmount()
  document.body.innerHTML = ''
})

afterAll(() => {
  const dir = join(__dirname, '..', '..', 'temp')
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, 'ai-headless-perf.json'),
    `${JSON.stringify({ node: process.version, recordedAt: new Date().toISOString(), ...report }, null, 2)}\n`,
  )
})

function time<T>(run: () => T): { value: T; ms: number } {
  const started = performance.now()
  const value = run()
  return { value, ms: Math.round((performance.now() - started) * 10) / 10 }
}

function seedMessages(
  world: ReturnType<typeof createWorld>,
  count: number,
  lastStreaming = false,
): void {
  world.emit('conversation.upserted', 'conv-1', {
    conversation: { id: 'conv-1', title: 'perf', revision: 1 },
  })
  for (let index = 0; index < count; index += 1) {
    const streaming = lastStreaming && index === count - 1
    world.emit('message.created', `m${index}`, {
      message: {
        id: `m${index}`,
        conversationId: 'conv-1',
        parentMessageId: index === 0 ? undefined : `m${index - 1}`,
        author: index % 2 === 0 ? 'user' : 'assistant',
        parts: [
          {
            id: 'p',
            kind: 'text',
            revision: 0,
            text: streaming ? '' : `message ${index} with **markdown**`,
            format: 'markdown',
          },
        ],
        status: streaming ? 'streaming' : 'complete',
        revision: 1,
        createdAt: T,
      },
    })
  }
}

describe('streaming does not rebuild the timeline', () => {
  it.each(FRAMEWORKS)(
    '%s: 1000 deltas touch only the streaming message',
    async framework => {
      const world = createWorld()
      seedMessages(world, 200, true)
      const conversation = createConversationController({
        session: world.session,
        conversationId: 'conv-1',
      })
      let conversationNotifications = 0
      conversation.subscribe(
        view => view,
        () => (conversationNotifications += 1),
      )
      const view = await mount(framework, {
        kind: 'timeline',
        session: world.session,
        conversation,
      })
      mounted.push(view)

      const streamingArticle = view.container.querySelector(
        '[data-message-id="m199"]',
      )!
      let outside = 0
      const observer = new MutationObserver(records => {
        for (const record of records) {
          if (!streamingArticle.contains(record.target)) outside += 1
        }
      })
      observer.observe(view.container, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
      })

      const ingest = time(() => {
        for (let revision = 0; revision < 1000; revision += 1) {
          world.emit('message.part.delta', 'm199', {
            messageId: 'm199',
            partId: 'p',
            baseRevision: revision,
            nextRevision: revision + 1,
            append: 'tok ',
          })
        }
      })
      await view.flush()
      world.emit('message.completed', 'm199', {
        messageId: 'm199',
        revision: 1002,
        status: 'complete',
      })
      await view.flush()
      observer.disconnect()

      // The feed's aria-busy flips once when the stream completes.
      expect(outside).toBeLessThanOrEqual(2)
      expect(conversationNotifications).toBe(0)
      expect(streamingArticle.textContent).toContain('tok tok')
      expect(ingest.ms).toBeLessThan(5000)
      report[`stream-1000-deltas-${framework}`] = {
        ingestMs: ingest.ms,
        mutationsOutsideStreamingMessage: outside,
      }
    },
  )
})

describe('long conversations render a window', () => {
  it.each(FRAMEWORKS)(
    '%s: 2000 messages mount a bounded number of articles',
    async framework => {
      const world = createWorld()
      seedMessages(world, 2000)
      const conversation = createConversationController({
        session: world.session,
        conversationId: 'conv-1',
      })
      const { value: view, ms } = await (async () => {
        const started = performance.now()
        const result = await mount(framework, {
          kind: 'timeline',
          session: world.session,
          conversation,
        })
        return { value: result, ms: Math.round(performance.now() - started) }
      })()
      mounted.push(view)

      const articles = view.container.querySelectorAll('[role="article"]')
      expect(articles.length).toBeGreaterThan(0)
      expect(articles.length).toBeLessThan(60)
      expect(articles[articles.length - 1].getAttribute('aria-posinset')).toBe(
        '2000',
      )
      expect(articles[0].getAttribute('aria-setsize')).toBe('2000')
      report[`window-2000-messages-${framework}`] = {
        mountMs: ms,
        renderedArticles: articles.length,
        domNodes: view.container.querySelectorAll('*').length,
      }
    },
  )
})

describe('no leaked subscriptions', () => {
  it.each(FRAMEWORKS)(
    '%s: 30 mount / unmount cycles return to baseline',
    async (framework: Framework) => {
      const world = createWorld()
      seedMessages(world, 20)
      const conversation = createConversationController({
        session: world.session,
        conversationId: 'conv-1',
      })
      const baseline = world.session.store.subscriptionCount()

      for (let cycle = 0; cycle < 30; cycle += 1) {
        const view = await mount(framework, {
          kind: 'timeline',
          session: world.session,
          conversation,
        })
        view.unmount()
      }
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(world.session.store.subscriptionCount()).toBe(baseline)
      report[`leaks-${framework}`] = {
        baseline,
        after: world.session.store.subscriptionCount(),
      }
    },
  )
})

describe('core throughput', { timeout: 30_000 }, () => {
  it('ingests 10k messages and keeps unrelated selections stable', () => {
    const store = createAiStore({ streamId: 'perf' })
    const factory = createEventFactory('perf')
    store.ingest(
      factory.create('conversation.upserted', 'c', {
        conversation: { id: 'c', title: 'c', revision: 1 },
      }),
    )
    store.ingest(
      factory.create('conversation.upserted', 'other', {
        conversation: { id: 'other', title: 'o', revision: 1 },
      }),
    )

    const { ms } = time(() => {
      for (let index = 0; index < 10_000; index += 1) {
        store.ingest(
          factory.create('message.created', `m${index}`, {
            message: {
              id: `m${index}`,
              conversationId: 'c',
              author: 'user',
              parts: [
                {
                  id: 'p',
                  kind: 'text',
                  revision: 0,
                  text: 'x',
                  format: 'plain',
                },
              ],
              status: 'complete',
              revision: 1,
              createdAt: T,
            },
          }),
        )
      }
    })
    const before = selectConversationTimeline(store.getState(), 'c')
    store.ingest(
      factory.create('conversation.upserted', 'other', {
        conversation: { id: 'other', title: 'renamed', revision: 2 },
      }),
    )

    expect(selectConversationTimeline(store.getState(), 'c')).toBe(before)
    expect(ms).toBeLessThan(20_000)
    report['ingest-10k-messages'] = {
      ms,
      perMessageMs: Math.round((ms / 10_000) * 1000) / 1000,
    }
  })

  it('isolates 4 parallel runs with 1000 step events each', () => {
    const world = createWorld()
    for (const id of ['r1', 'r2', 'r3', 'r4']) {
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
    const switcher = createRunSwitcher({ session: world.session })

    const { ms } = time(() => {
      for (let index = 0; index < 1000; index += 1) {
        for (const run of ['r1', 'r2', 'r3', 'r4']) {
          world.emit('step.upserted', `${run}-s${index}`, {
            step: {
              id: `${run}-s${index}`,
              executionId: run,
              kind: 'tool',
              status: 'completed',
              label: `step ${index}`,
            },
          })
        }
      }
    })

    const runs = switcher.getSnapshot().runs
    expect(runs.find(run => run.executionId === 'r1')?.unread).toBe(0)
    expect(runs.find(run => run.executionId === 'r2')?.unread).toBe(1000)
    expect(ms).toBeLessThan(60_000)
    report['parallel-4x1000-steps'] = { ms }
  })

  it('parses a 10k-line diff and builds a 10k-file tree', () => {
    const lines = Array.from({ length: 10_000 }, (_, index) => `+line ${index}`)
    const diff = `--- a/big.txt\n+++ b/big.txt\n@@ -0,0 +1,10000 @@\n${lines.join('\n')}\n`
    const parse = time(() => parseUnifiedDiff(diff))
    expect(parse.value.ok).toBe(true)

    const files = Array.from({ length: 10_000 }, (_, index) => ({
      path: `src/module-${index % 100}/file-${index}.ts`,
      status: 'modified' as const,
    }))
    const tree = time(() => buildFileTree(files))
    expect(tree.value).toHaveLength(1)

    expect(parse.ms).toBeLessThan(2000)
    expect(tree.ms).toBeLessThan(2000)
    report['diff-10k-lines'] = { parseMs: parse.ms }
    report['file-tree-10k-files'] = { buildMs: tree.ms }
  })
})
