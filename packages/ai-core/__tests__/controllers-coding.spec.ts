/**
 * M4 controllers: workspace, diff parser, review, change-set actions, test
 * report, artifacts and citations (AI2-210, AI2-401 – AI2-406).
 */

import { describe, expect, it, vi } from 'vitest'
import {
  classifyPreview,
  createArtifactController,
  safeExternalUrl,
  selectMessageCitations,
} from '../src/controllers/artifacts'
import { createChangeSetActions } from '../src/controllers/changeset-actions'
import { createReviewController } from '../src/controllers/review'
import {
  createTestReportController,
  parseTestReport,
} from '../src/controllers/test-report'
import {
  createWorkspaceController,
  selectExecutionsForWorkspace,
} from '../src/controllers/workspace'
import { pageHunks, parseUnifiedDiff, toSideBySide } from '../src/diff/parser'
import { createMockHost } from '../src/host/mock-host'
import {
  changeSet,
  createFixture,
  createSessionStub,
  execution,
  message,
  sequentialIds,
} from './helpers'

const DIFF_V1 = `diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,3 +1,3 @@ export function a()
 const x = 1
-const y = 2
+const y = 3
 export { x, y }
`

const DIFF_V2 = `--- a/src/a.ts
+++ b/src/a.ts
@@ -1,3 +1,3 @@ export function a()
 const x = 1
-const y = 2
+const y = 4
 export { x, y }
`

describe('ai2-401 · workspace selection', () => {
  it('changes only what is visible, never the running executions', () => {
    const fixture = createFixture()
    fixture.emit('execution.started', 'exec-1', {
      execution: execution({ workspaceId: 'ws-1' }),
    })
    const workspaces = createWorkspaceController({
      workspaces: [
        {
          id: 'ws-1',
          kind: 'worktree',
          displayName: 'main',
          capabilities: ['apply'],
        },
        { id: 'ws-2', kind: 'local', displayName: 'scratch', capabilities: [] },
      ],
    })

    workspaces.select('ws-2')
    expect(workspaces.getSnapshot().selectedWorkspaceId).toBe('ws-2')
    expect(workspaces.can('apply')).toBe(false)
    expect(
      selectExecutionsForWorkspace(fixture.store.getState(), 'ws-1'),
    ).toHaveLength(1)
    expect(fixture.store.getState().executions.get('exec-1')!.workspaceId).toBe(
      'ws-1',
    )
  })
})

describe('ai2-402 · diff parser', () => {
  it('parses hunks with line numbers and a stable content id', () => {
    const parsed = parseUnifiedDiff(DIFF_V1)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    const [file] = parsed.files
    expect(file.path).toBe('src/a.ts')
    expect(file.hunks[0]).toMatchObject({
      section: 'export function a()',
      oldStart: 1,
      newLines: 3,
    })
    expect(
      file.hunks[0].lines.map(line => [line.kind, line.oldLine, line.newLine]),
    ).toEqual([
      ['context', 1, 1],
      ['delete', 2, undefined],
      ['add', undefined, 2],
      ['context', 3, 3],
    ])

    const again = parseUnifiedDiff(DIFF_V1)
    const changed = parseUnifiedDiff(DIFF_V2)
    if (!again.ok || !changed.ok) throw new Error('parse failed')
    expect(again.files[0].hunks[0].id).toBe(file.hunks[0].id)
    expect(changed.files[0].hunks[0].id).not.toBe(file.hunks[0].id)
  })

  it('rejects lying hunk headers and hostile paths', () => {
    expect(
      parseUnifiedDiff('--- a/x\n+++ b/x\n@@ -1,5 +1,1 @@\n-a\n'),
    ).toMatchObject({
      ok: false,
      code: 'invalid-hunk',
    })
    expect(
      parseUnifiedDiff(
        '--- a/../../etc/passwd\n+++ b/../../etc/passwd\n@@ -1 +1 @@\n-a\n+b\n',
      ),
    ).toMatchObject({
      ok: false,
      code: 'unsafe-path',
    })
  })

  it('keeps markup as text and truncates huge input', () => {
    const parsed = parseUnifiedDiff(
      '@@ -0,0 +1 @@\n+<img src=x onerror=alert(1)>\n',
      { path: 'x.html' },
    )
    if (!parsed.ok) throw new Error(parsed.message)
    expect(parsed.files[0].hunks[0].lines[0].text).toBe(
      '<img src=x onerror=alert(1)>',
    )

    const many = `@@ -0,0 +1,50 @@\n${Array.from({ length: 50 }, (_, i) => `+line ${i}`).join('\n')}\n`
    const truncated = parseUnifiedDiff(many, { path: 'big.txt', maxLines: 10 })
    if (!truncated.ok) throw new Error(truncated.message)
    expect(truncated.files[0].truncated).toBe(true)
  })

  it('pairs side-by-side rows and pages hunks', () => {
    const parsed = parseUnifiedDiff(DIFF_V1)
    if (!parsed.ok) throw new Error(parsed.message)
    const rows = toSideBySide(parsed.files[0].hunks[0])
    expect(rows[1]).toMatchObject({
      left: { kind: 'delete' },
      right: { kind: 'add' },
    })
    expect(pageHunks(parsed.files[0].hunks, 1)).toHaveLength(1)
  })
})

describe('ai2-404 · review controller', () => {
  function setup() {
    const fixture = createFixture()
    fixture.emit('execution.started', 'exec-1', { execution: execution() })
    fixture.emit('changeset.updated', 'cs-1', { changeset: changeSet() })
    const loadDiff = vi.fn(async (_file, cs: { revision: number }) =>
      cs.revision === 1 ? DIFF_V1 : DIFF_V2,
    )
    const session = createSessionStub(fixture.store)
    const review = createReviewController({
      session,
      changeSetId: 'cs-1',
      loadDiff,
      createId: sequentialIds(),
    })
    return { fixture, session, review, loadDiff }
  }

  it('loads diffs lazily and keeps review progress local', async () => {
    const { review, loadDiff, session } = setup()
    expect(loadDiff).not.toHaveBeenCalled()

    await review.selectFile('src/a.ts')
    const hunkId = review.getSnapshot().diffs['src/a.ts'].diff!.hunks[0].id
    review.markReviewed(hunkId)

    expect(review.getSnapshot().progress).toEqual({ reviewed: 1, total: 1 })
    expect(session.execute).not.toHaveBeenCalled()
    await review.selectFile('src/a.ts')
    expect(loadDiff).toHaveBeenCalledOnce()
  })

  it('marks comments outdated when a new revision changes their hunk', async () => {
    const { fixture, review } = setup()
    await review.selectFile('src/a.ts')
    const hunkId = review.getSnapshot().diffs['src/a.ts'].diff!.hunks[0].id
    const commentId = review.addComment('src/a.ts', hunkId, 'why 3?')

    fixture.emit('changeset.updated', 'cs-1', {
      changeset: changeSet({ revision: 2 }),
    })
    await vi.waitFor(() =>
      expect(review.getSnapshot().diffs['src/a.ts']?.status).toBe('ready'),
    )

    expect(review.getSnapshot().comments[0]).toMatchObject({
      id: commentId,
      outdated: true,
    })
    expect(await review.submitComment(commentId)).toMatchObject({
      code: 'AI_REVIEW_COMMENT_OUTDATED',
    })
  })

  it('submits a comment anchored to its hunk and revision', async () => {
    const { review, session } = setup()
    await review.selectFile('src/a.ts')
    const hunkId = review.getSnapshot().diffs['src/a.ts'].diff!.hunks[0].id
    const id = review.addComment('src/a.ts', hunkId, 'looks good')

    await review.submitComment(id)
    expect(session.commands()[0]).toMatchObject({
      type: 'review.comment',
      payload: { path: 'src/a.ts', hunkId, changeSetRevision: 1 },
    })
    expect(review.getSnapshot().comments[0].status).toBe('submitted')
  })
})

describe('ai2-405 · change-set actions', () => {
  it('sends apply bound to base, workspace and reviewed revision', async () => {
    const fixture = createFixture()
    fixture.emit('execution.started', 'exec-1', { execution: execution() })
    fixture.emit('changeset.updated', 'cs-1', { changeset: changeSet() })
    const session = createSessionStub(fixture.store)
    const actions = createChangeSetActions({ session, changeSetId: 'cs-1' })

    await actions.request('apply')
    expect(session.commands()[0]).toMatchObject({
      type: 'changeset.apply',
      expectedRevision: 1,
      payload: {
        changeSetId: 'cs-1',
        workspaceId: 'ws-1',
        baseRevision: 'abc123',
      },
    })
    expect(actions.getSnapshot()).toMatchObject({
      status: 'ready',
      pendingAction: 'apply',
    })

    // The host, not the UI, reports the conflict; rebase becomes the way out.
    fixture.emit('changeset.updated', 'cs-1', {
      changeset: changeSet({ status: 'applying', revision: 2 }),
    })
    fixture.emit('changeset.updated', 'cs-1', {
      changeset: changeSet({ status: 'conflicted', revision: 3 }),
    })
    expect(actions.getSnapshot()).toMatchObject({
      conflicted: true,
      pendingAction: undefined,
      availableActions: ['discard', 'rebase'],
    })
  })

  it('does not offer apply before the change set is ready', async () => {
    const fixture = createFixture()
    fixture.emit('execution.started', 'exec-1', { execution: execution() })
    fixture.emit('changeset.updated', 'cs-1', {
      changeset: changeSet({ status: 'draft' }),
    })
    const session = createSessionStub(fixture.store)
    const actions = createChangeSetActions({ session, changeSetId: 'cs-1' })

    expect(await actions.request('apply')).toMatchObject({
      code: 'AI_CHANGESET_ACTION_UNAVAILABLE',
    })
    expect(session.execute).not.toHaveBeenCalled()
  })
})

describe('ai2-406 · test report', () => {
  const report = {
    schema: 'zeus.test-report/v1',
    summary: { passed: 1, failed: 1, skipped: 0 },
    cases: [
      { id: 'ok', name: 'adds', status: 'passed' },
      {
        id: 'bad',
        name: 'subtracts',
        status: 'failed',
        location: { file: 'src/math.spec.ts', line: 12 },
        message: 'expected 1 to be 2',
        output: { id: 'out-1', mimeType: 'text/plain' },
      },
    ],
  }

  it('puts failures first and loads raw output on demand', async () => {
    const parsed = parseTestReport(report)
    if (!parsed.ok) throw new Error(parsed.message)
    const loadOutput = vi.fn(async () => 'stack trace')
    const controller = createTestReportController({
      report: parsed.report,
      loadOutput,
    })

    expect(controller.getSnapshot().orderedCaseIds).toEqual(['bad', 'ok'])
    expect(loadOutput).not.toHaveBeenCalled()

    await controller.toggle('bad')
    expect(controller.getSnapshot().expanded.bad).toEqual({
      status: 'ready',
      text: 'stack trace',
    })
    await controller.toggle('bad')
    expect(controller.getSnapshot().expanded.bad).toBeUndefined()
  })

  it('rejects reports with unsafe locations', () => {
    expect(
      parseTestReport({
        ...report,
        cases: [
          {
            id: 'x',
            name: 'x',
            status: 'failed',
            location: { file: '/etc/passwd' },
          },
        ],
      }),
    ).toMatchObject({ ok: false })
  })
})

describe('ai2-210 · artifacts and citations', () => {
  it('only previews allowlisted types inline', () => {
    expect(classifyPreview('text/markdown; charset=utf-8')).toBe('text')
    expect(classifyPreview('image/png')).toBe('image')
    expect(classifyPreview('text/html')).toBe('sandboxed')
    expect(classifyPreview('image/svg+xml')).toBe('sandboxed')
    expect(classifyPreview('application/x-msdownload')).toBe('download-only')
  })

  it('blocks scriptable previews without a sandbox and loads text ones', async () => {
    const fixture = createFixture()
    fixture.emit('execution.started', 'exec-1', { execution: execution() })
    for (const [id, mimeType] of [
      ['report', 'text/plain'],
      ['page', 'text/html'],
    ]) {
      fixture.emit('artifact.published', id, {
        artifact: {
          id,
          executionId: 'exec-1',
          kind: 'document',
          title: id,
          asset: { id: `${id}-asset`, mimeType },
          revision: 1,
        },
      })
    }
    const host = createMockHost()
    host.loadAsset = async () => new TextEncoder().encode('hello')
    const controller = createArtifactController({
      session: { store: fixture.store, host },
    })

    await controller.select('page')
    expect(controller.getSnapshot().preview).toMatchObject({
      kind: 'sandboxed',
      status: 'blocked',
    })
    await controller.select('report')
    expect(controller.getSnapshot().preview).toMatchObject({
      status: 'ready',
      text: 'hello',
    })
  })

  it('degrades missing sources and drops non-http links', () => {
    const fixture = createFixture()
    fixture.emit('conversation.upserted', 'conv-1', {
      conversation: { id: 'conv-1', title: 'c', revision: 1 },
    })
    fixture.emit('message.created', 'msg-1', {
      message: message({
        parts: [
          {
            id: 'r1',
            kind: 'reference',
            sourceId: 'doc-1',
            label: 'Design doc',
          },
          { id: 'r2', kind: 'reference', sourceId: 'evil' },
        ],
      }),
    })

    const citations = selectMessageCitations(
      fixture.store.getState(),
      'msg-1',
      id =>
        id === 'evil'
          ? { title: 'Click me', url: 'javascript:alert(1)' }
          : undefined,
    )

    expect(citations).toEqual([
      {
        partId: 'r1',
        sourceId: 'doc-1',
        label: 'Design doc',
        url: undefined,
        missing: true,
      },
      {
        partId: 'r2',
        sourceId: 'evil',
        label: 'Click me',
        url: undefined,
        missing: false,
      },
    ])
    expect(safeExternalUrl('https://example.com/a')).toBe(
      'https://example.com/a',
    )
  })
})
