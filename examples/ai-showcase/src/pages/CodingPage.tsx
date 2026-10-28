/**
 * S3 · Coding review: browse changed files, read diffs, comment on hunks,
 * apply through the host, recover from a conflict by rebasing.
 */

import type { AiState, ChangedFile } from '@zeus-web/ai-core'

import {
  createChangeSetActions,
  createCommand,
  createReviewController,
  createTestReportController,
  parseTestReport,
} from '@zeus-web/ai-core'
import {
  AiChangesetActions,
  AiDiffViewer,
  AiFileChangeTree,
  AiTestReport,
  useAiState,
  useController,
} from '@zeus-web/ai-react'
import { useEffect, useState } from 'react'
import { TEST_REPORT } from '../demo-host'
import { host, session } from '../session'

function startCoding(): void {
  // Idempotent: the key makes repeated mounts a single host command.
  void session.execute(
    createCommand({
      commandId: 'coding-start',
      idempotencyKey: 'coding-start',
      type: 'coding.start',
      target: { kind: 'workspace', id: 'ws-demo' },
      payload: {},
    }),
  )
}

async function loadDiff(file: ChangedFile): Promise<string> {
  if (!file.diffAsset) return ''
  const content = await host.loadAsset(file.diffAsset)
  return new TextDecoder().decode(content as Uint8Array)
}

const review = createReviewController({
  session,
  changeSetId: 'cs-demo',
  loadDiff,
})
const actions = createChangeSetActions({ session, changeSetId: 'cs-demo' })
const report = parseTestReport(TEST_REPORT)
const tests = report.ok
  ? createTestReportController({
      report: report.report,
      loadOutput: async asset =>
        new TextDecoder().decode((await host.loadAsset(asset)) as Uint8Array),
    })
  : undefined

function hasChangeSet(state: AiState): boolean {
  return state.changeSets.has('cs-demo')
}

export function CodingPage() {
  const [layout, setLayout] = useState<'unified' | 'split'>('unified')
  useEffect(startCoding, [])
  const ready = useAiState(session.store, hasChangeSet)
  const progress = useController(review, view => view.progress)

  if (!ready) return <p role="status">Loading change set…</p>

  return (
    <section className="story" aria-labelledby="coding-title">
      <header className="story-header">
        <h1 id="coding-title">S3 · Coding review</h1>
        <span data-testid="review-progress">
          Reviewed {progress.reviewed} / {progress.total}
        </span>
        <button
          type="button"
          aria-pressed={layout === 'split'}
          onClick={() => setLayout(layout === 'split' ? 'unified' : 'split')}
        >
          Side by side
        </button>
      </header>
      <div className="coding">
        <AiFileChangeTree review={review} />
        <AiDiffViewer review={review} layout={layout} />
      </div>
      <AiChangesetActions controller={actions} />
      {tests && <AiTestReport controller={tests} />}
    </section>
  )
}
