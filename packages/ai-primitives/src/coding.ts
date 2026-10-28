/**
 * Coding surface parts: `AiWorkspacePicker`, `AiFileChangeTree`,
 * `AiDiffViewer`, `AiHunkReview`, `AiTestReport`, `AiChangesetActions`
 * (AI2-401, AI2-403 – AI2-406).
 *
 * Diff lines are emitted as text with their line numbers; nothing from a
 * diff is ever interpreted as markup. Every row has a stable anchor id so a
 * comment or a "jump to line" survives re-rendering.
 */

import type {
  ChangedFile,
  ChangeSetAction,
  ChangeSetActionsController,
  ChangeSetActionsViewState,
  DiffHunk,
  DiffLine,
  FileDiff,
  ReviewController,
  TestReportController,
  TestReportViewState,
  WorkspaceController,
  WorkspaceViewState,
} from '@zeus-web/ai-core'
import type { AiLocale } from './locale'
import type { IdScope, PartProps } from './parts'
import type { TreeNode } from './tree'

import { toSideBySide } from '@zeus-web/ai-core'
import { navigateIndex } from './keyboard'
import { EN_LOCALE } from './locale'
import { ariaBool, part } from './parts'

// ---------------------------------------------------------------------------
// Workspace picker
// ---------------------------------------------------------------------------

export function getWorkspacePickerParts(
  view: Readonly<WorkspaceViewState>,
  controller: Pick<WorkspaceController, 'select'>,
  options: { ids: IdScope; locale?: AiLocale },
): { root: PartProps; options: PartProps[] } {
  const locale = options.locale ?? EN_LOCALE
  const ids = view.workspaces.map(workspace => workspace.id)

  return {
    root: part({ role: 'listbox', 'aria-label': locale.workspaceLabel }),
    options: view.workspaces.map((workspace, index) =>
      part(
        {
          id: options.ids.id(`workspace-${workspace.id}`),
          role: 'option',
          tabindex: workspace.id === view.selectedWorkspaceId ? 0 : -1,
          'aria-selected': ariaBool(workspace.id === view.selectedWorkspaceId),
          'data-kind': workspace.kind,
        },
        {
          click: () => controller.select(workspace.id),
          keydown: event => {
            const next = navigateIndex(event.key, index, ids.length)
            if (next === undefined) return
            event.preventDefault()
            controller.select(ids[next])
          },
        },
        workspace.displayName,
      ),
    ),
  }
}

// ---------------------------------------------------------------------------
// File change tree
// ---------------------------------------------------------------------------

/** Build a directory tree from change-set paths. Leaf ids are the paths. */
export function buildFileTree(files: readonly ChangedFile[]): TreeNode[] {
  interface Mutable {
    id: string
    label: string
    children: Mutable[]
  }
  const roots: Mutable[] = []
  const directories = new Map<string, Mutable>()

  for (const file of [...files].sort((left, right) =>
    left.path.localeCompare(right.path),
  )) {
    const segments = file.path.split('/')
    let siblings = roots
    let prefix = ''

    segments.forEach((segment, index) => {
      const isLeaf = index === segments.length - 1
      prefix = prefix ? `${prefix}/${segment}` : segment

      if (isLeaf) {
        siblings.push({ id: file.path, label: segment, children: [] })
        return
      }

      const key = `dir:${prefix}`
      let directory = directories.get(key)
      if (!directory) {
        directory = { id: key, label: segment, children: [] }
        directories.set(key, directory)
        siblings.push(directory)
      }
      siblings = directory.children
    })
  }

  return roots
}

export function getChangedFileParts(
  file: ChangedFile,
  options: { locale?: AiLocale } = {},
): { status: PartProps; stats?: PartProps } {
  void options
  return {
    status: part({ 'data-status': file.status }, undefined, file.status),
    stats: file.stats
      ? part(
          {
            'aria-label': `${file.stats.additions} additions, ${file.stats.deletions} deletions`,
          },
          undefined,
          `+${file.stats.additions} −${file.stats.deletions}`,
        )
      : undefined,
  }
}

// ---------------------------------------------------------------------------
// Diff viewer
// ---------------------------------------------------------------------------

export type DiffLayout = 'unified' | 'split'

export interface DiffRowCell {
  line?: DiffLine
  number?: number
  text: string
  kind: DiffLine['kind'] | 'empty'
}

export interface DiffRow {
  /** Stable anchor: hunk id + row index. */
  id: string
  hunkId: string
  type: 'hunk' | 'line'
  /** Header text for hunk rows. */
  header?: string
  cells: readonly DiffRowCell[]
}

function cell(line: DiffLine | undefined, side: 'old' | 'new'): DiffRowCell {
  if (!line) return { text: '', kind: 'empty' }
  return {
    line,
    number: side === 'old' ? line.oldLine : line.newLine,
    text: line.text,
    kind: line.kind,
  }
}

export function diffRows(diff: FileDiff, layout: DiffLayout): DiffRow[] {
  const rows: DiffRow[] = []

  for (const hunk of diff.hunks) {
    rows.push({
      id: `${hunk.id}-h`,
      hunkId: hunk.id,
      type: 'hunk',
      header: hunk.section ? `${hunk.header} ${hunk.section}` : hunk.header,
      cells: [],
    })

    if (layout === 'unified') {
      hunk.lines.forEach((line, index) => {
        rows.push({
          id: `${hunk.id}-${index}`,
          hunkId: hunk.id,
          type: 'line',
          cells: [
            { ...cell(line, 'old'), number: line.oldLine },
            { ...cell(line, 'new'), number: line.newLine },
          ],
        })
      })
    } else {
      toSideBySide(hunk).forEach((row, index) => {
        rows.push({
          id: `${hunk.id}-${index}`,
          hunkId: hunk.id,
          type: 'line',
          cells: [cell(row.left, 'old'), cell(row.right, 'new')],
        })
      })
    }
  }

  return rows
}

/** Next / previous hunk for `n` / `p` style navigation. */
export function adjacentHunk(
  hunks: readonly DiffHunk[],
  currentId: string | undefined,
  direction: 1 | -1,
): string | undefined {
  if (hunks.length === 0) return undefined
  const index = hunks.findIndex(hunk => hunk.id === currentId)
  const next =
    index < 0 ? (direction > 0 ? 0 : hunks.length - 1) : index + direction
  return hunks[Math.max(0, Math.min(hunks.length - 1, next))].id
}

export function getDiffViewerParts(
  diff: FileDiff,
  layout: DiffLayout,
  review: Pick<ReviewController, 'selectHunk'> & {
    getSnapshot: () => { selectedHunkId?: string }
  },
  options: {
    ids: IdScope
    locale?: AiLocale
    onFocusRow?: (rowId: string) => void
  },
): {
  root: PartProps
  rows: { row: DiffRow; props: PartProps }[]
  truncated?: PartProps
} {
  const locale = options.locale ?? EN_LOCALE
  const rows = diffRows(diff, layout)

  return {
    root: part(
      {
        role: 'region',
        'aria-label': locale.diffLabel(diff.path),
        'data-layout': layout,
        'data-binary': diff.binary ? '' : undefined,
      },
      {
        keydown: event => {
          if (event.key !== 'n' && event.key !== 'p') return
          event.preventDefault()
          const target = adjacentHunk(
            diff.hunks,
            review.getSnapshot().selectedHunkId,
            event.key === 'n' ? 1 : -1,
          )
          if (target) {
            review.selectHunk(target)
            options.onFocusRow?.(`${target}-h`)
          }
        },
      },
    ),
    rows: rows.map(row => ({
      row,
      props: part(
        {
          id: options.ids.id(`row-${row.id}`),
          'data-row-type': row.type,
          'data-hunk-id': row.hunkId,
          'data-selected':
            review.getSnapshot().selectedHunkId === row.hunkId ? '' : undefined,
          tabindex: row.type === 'hunk' ? 0 : undefined,
        },
        row.type === 'hunk'
          ? { click: () => review.selectHunk(row.hunkId) }
          : undefined,
        row.header,
      ),
    })),
    truncated: diff.truncated
      ? part(
          { role: 'note' },
          undefined,
          'Diff truncated; open the full file to see the rest.',
        )
      : undefined,
  }
}

export function getHunkReviewParts(
  hunkId: string,
  reviewed: boolean,
  review: Pick<ReviewController, 'markReviewed'>,
  options: { locale?: AiLocale } = {},
): { checkbox: PartProps } {
  const locale = options.locale ?? EN_LOCALE
  return {
    checkbox: part(
      {
        type: 'checkbox',
        checked: reviewed,
        'aria-label': locale.hunkReviewed,
      },
      {
        change: event =>
          review.markReviewed(hunkId, event.checked ?? !reviewed),
      },
    ),
  }
}

// ---------------------------------------------------------------------------
// Test report
// ---------------------------------------------------------------------------

export function getTestReportParts(
  view: Readonly<TestReportViewState>,
  controller: Pick<TestReportController, 'toggle'>,
  options: { ids: IdScope; locale?: AiLocale },
): {
  summary: PartProps
  cases: {
    caseId: string
    row: PartProps
    toggle?: PartProps
    output?: PartProps
    location?: PartProps
  }[]
} {
  const locale = options.locale ?? EN_LOCALE
  const { summary } = view.report
  const byId = new Map(view.report.cases.map(entry => [entry.id, entry]))

  return {
    summary: part(
      { role: 'status', 'data-failed': summary.failed > 0 ? '' : undefined },
      undefined,
      locale.testSummary(summary.passed, summary.failed, summary.skipped),
    ),
    cases: view.orderedCaseIds.map(caseId => {
      const entry = byId.get(caseId)!
      const expanded = view.expanded[caseId]
      const outputId = options.ids.id(`case-${caseId}`)
      const expandable =
        entry.output !== undefined || entry.message !== undefined

      return {
        caseId,
        row: part({ 'data-status': entry.status }, undefined, entry.name),
        toggle: expandable
          ? part(
              {
                type: 'button',
                'aria-expanded': ariaBool(expanded !== undefined),
                'aria-controls': outputId,
              },
              { click: () => void controller.toggle(caseId) },
              expanded ? locale.hideDetails : locale.showDetails,
            )
          : undefined,
        output: expanded
          ? part(
              {
                id: outputId,
                'aria-busy': ariaBool(expanded.status === 'loading'),
                'data-status': expanded.status,
              },
              undefined,
              expanded.text ?? expanded.error ?? '',
            )
          : undefined,
        location: entry.location
          ? part(
              { 'data-file': entry.location.file },
              undefined,
              `${entry.location.file}${entry.location.line ? `:${entry.location.line}` : ''}`,
            )
          : undefined,
      }
    }),
  }
}

// ---------------------------------------------------------------------------
// Change-set actions
// ---------------------------------------------------------------------------

export function getChangeSetActionsParts(
  view: Readonly<ChangeSetActionsViewState>,
  controller: Pick<ChangeSetActionsController, 'request'>,
  options: { locale?: AiLocale } = {},
): {
  status: PartProps
  actions: { action: ChangeSetAction; props: PartProps }[]
  error?: PartProps
} {
  const locale = options.locale ?? EN_LOCALE
  return {
    status: part(
      {
        role: 'status',
        'data-status': view.status,
        'data-pending': view.pendingAction,
      },
      undefined,
      view.status ? locale.changeSetStatus[view.status] : '',
    ),
    actions: view.availableActions.map(action => ({
      action,
      props: part(
        { type: 'button', 'data-action': action },
        { click: () => void controller.request(action).catch(() => {}) },
        locale.changeSetAction[action],
      ),
    })),
    error: view.lastError
      ? part({ role: 'alert' }, undefined, view.lastError)
      : undefined,
  }
}
