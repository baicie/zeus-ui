/**
 * Coding review surface for React (AI2-501): `AiWorkspacePicker`,
 * `AiFileChangeTree`, `AiDiffViewer`, `AiHunkComments`, `AiTestReport`,
 * `AiChangesetActions`.
 */

import type {
  ChangeSetActionsController,
  ReviewController,
  TestReportController,
  WorkspaceController,
} from '@zeus-web/ai-core'
import type { AiLocale, DiffLayout } from '@zeus-web/ai-primitives'
import type { ReactElement, ReactNode } from 'react'

import {
  changeSetActionsView,
  createTreeController,
  diffView,
  fileTreeView,
  hunkCommentsView,
  testReportView,
  workspacePickerView,
} from '@zeus-web/ai-primitives'
import { createElement, useState } from 'react'
import { focusById, useController, useIds, useOwnedController } from './hooks'
import { renderView } from './render'

export function AiWorkspacePicker(props: {
  controller: WorkspaceController
  locale?: AiLocale
}): ReactElement {
  const ids = useIds()
  const view = useController(props.controller)
  return renderView(
    workspacePickerView(view, props.controller, { ids, locale: props.locale }),
  ) as ReactElement
}

export function AiFileChangeTree(props: {
  review: ReviewController
  locale?: AiLocale
}): ReactElement {
  const ids = useIds()
  const view = useController(props.review)
  const tree = useOwnedController(
    () =>
      createTreeController({
        defaultExpanded: true,
        onSelect: id => {
          if (!id.startsWith('dir:')) void props.review.selectFile(id)
        },
        onFocus: id => {
          focusById(ids.id(`node-${id}`))
        },
      }),
    [props.review],
  )
  useController(tree)

  return renderView(
    fileTreeView(view, tree, { ids, locale: props.locale }),
  ) as ReactElement
}

export function AiHunkComments(props: {
  review: ReviewController
  hunkId: string
  locale?: AiLocale
}): ReactElement {
  const ids = useIds()
  const comments = useController(props.review, view => view.comments)
  const path = useController(props.review, view => view.selectedPath)
  const [draft, setDraft] = useState('')

  return renderView(
    hunkCommentsView(comments, props.hunkId, {
      ids,
      locale: props.locale,
      draft,
      onDraft: setDraft,
      onAdd: () => {
        if (!path || !draft.trim()) return
        props.review.addComment(path, props.hunkId, draft)
        setDraft('')
      },
      onSubmit: id => void props.review.submitComment(id).catch(() => {}),
    }),
  ) as ReactElement
}

export interface AiDiffViewerProps {
  review: ReviewController
  layout?: DiffLayout
  locale?: AiLocale
  /** Replace the default per-hunk review controls. */
  renderHunkActions?: (hunkId: string) => ReactNode
}

export function AiDiffViewer(props: AiDiffViewerProps): ReactElement {
  const ids = useIds()
  const view = useController(props.review)
  const entry = view.selectedPath ? view.diffs[view.selectedPath] : undefined

  if (!entry || entry.status !== 'ready' || !entry.diff) {
    return createElement(
      'div',
      {
        role: entry?.status === 'error' ? 'alert' : 'status',
        'aria-busy': entry?.status === 'loading' ? 'true' : undefined,
        'data-zw-ai': 'diff',
      },
      entry?.status === 'error'
        ? entry.error
        : entry?.status === 'loading'
          ? 'Loading diff…'
          : '',
    )
  }

  return renderView(
    diffView(entry.diff, props.layout ?? 'unified', props.review, {
      ids,
      locale: props.locale,
      onFocusRow: rowId => {
        focusById(ids.id(`row-${rowId}`))
      },
    }),
    {
      slots: {
        'hunk-actions': data => {
          const { hunkId } = data as { hunkId: string }
          return props.renderHunkActions
            ? props.renderHunkActions(hunkId)
            : createElement(AiHunkComments, {
                review: props.review,
                hunkId,
                locale: props.locale,
              })
        },
      },
    },
  ) as ReactElement
}

export function AiTestReport(props: {
  controller: TestReportController
  locale?: AiLocale
}): ReactElement {
  const ids = useIds()
  const view = useController(props.controller)
  return renderView(
    testReportView(view, props.controller, { ids, locale: props.locale }),
  ) as ReactElement
}

export function AiChangesetActions(props: {
  controller: ChangeSetActionsController
  locale?: AiLocale
}): ReactElement {
  const view = useController(props.controller)
  return renderView(
    changeSetActionsView(view, props.controller, { locale: props.locale }),
  ) as ReactElement
}
