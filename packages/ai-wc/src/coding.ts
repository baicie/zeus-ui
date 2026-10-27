/**
 * Coding review elements (AI2-503): `zw-ai-workspace-picker`,
 * `zw-ai-file-change-tree`, `zw-ai-diff-viewer`, `zw-ai-test-report`,
 * `zw-ai-changeset-actions`.
 */

import type {
  ChangeSetActionsController,
  ReviewController,
  TestReportController,
  WorkspaceController,
} from '@zeus-web/ai-core'
import type { DiffLayout, TreeNode } from '@zeus-web/ai-primitives'
import type { AiElementInstance } from './element'

import {
  buildFileTree,
  changeSetActionsView,
  createTreeController,
  diffView,
  el,
  fileTreeView,
  hunkCommentsView,
  part,
  testReportView,
  workspacePickerView,
} from '@zeus-web/ai-primitives'
import { defineAiElement } from './element'
import { patchChildren } from './patch'

type Registry = CustomElementRegistry | undefined

function props(element: AiElementInstance): Record<string, unknown> {
  return element as unknown as Record<string, unknown>
}

function subscribeAll(
  element: AiElementInstance,
  controller:
    | {
        subscribe: (
          selector: (view: unknown) => unknown,
          listener: () => void,
        ) => () => void
      }
    | undefined,
): (() => void)[] {
  return controller
    ? [
        controller.subscribe(
          view => view,
          () => element.requestRender(),
        ),
      ]
    : []
}

function directories(nodes: readonly TreeNode[]): string[] {
  return nodes.flatMap(node =>
    node.children.length > 0 ? [node.id, ...directories(node.children)] : [],
  )
}

export function defineAiWorkspacePicker(registry?: Registry): void {
  defineAiElement(
    'zw-ai-workspace-picker',
    ['controller'],
    element => {
      const p = props(element)
      return {
        connect: () => subscribeAll(element, p.controller as never),
        view: () => {
          const controller = p.controller as WorkspaceController | undefined
          return controller
            ? workspacePickerView(controller.getSnapshot(), controller, {
                ids: element.ids,
              })
            : null
        },
      }
    },
    [],
    registry,
  )
}

export function defineAiFileChangeTree(registry?: Registry): void {
  defineAiElement(
    'zw-ai-file-change-tree',
    ['review'],
    element => {
      const p = props(element)
      const review = p.review as ReviewController | undefined
      const tree = createTreeController({
        initiallyExpanded: directories(
          buildFileTree(review?.getSnapshot().changeSet?.files ?? []),
        ),
        onSelect: id => {
          if (!id.startsWith('dir:')) void review?.selectFile(id)
        },
        onFocus: id =>
          element.ownerDocument
            .getElementById(element.ids.id(`node-${id}`))
            ?.focus(),
      })
      return {
        connect: () => [
          ...subscribeAll(element, review as never),
          tree.subscribe(
            view => view,
            () => element.requestRender(),
          ),
          () => tree.dispose(),
        ],
        view: () =>
          review
            ? fileTreeView(review.getSnapshot(), tree, { ids: element.ids })
            : null,
      }
    },
    [],
    registry,
  )
}

export function defineAiDiffViewer(registry?: Registry): void {
  defineAiElement(
    'zw-ai-diff-viewer',
    ['review'],
    element => {
      const p = props(element)
      const drafts = new Map<string, string>()
      return {
        connect: () => subscribeAll(element, p.review as never),
        view: () => {
          const review = p.review as ReviewController | undefined
          if (!review) return null
          const state = review.getSnapshot()
          const entry = state.selectedPath
            ? state.diffs[state.selectedPath]
            : undefined

          if (!entry || entry.status !== 'ready' || !entry.diff) {
            return el(
              'div',
              part(
                {
                  role: entry?.status === 'error' ? 'alert' : 'status',
                  'aria-busy': entry?.status === 'loading' ? 'true' : undefined,
                  'data-zw-ai': 'diff',
                },
                undefined,
                entry?.status === 'error'
                  ? entry.error
                  : entry?.status === 'loading'
                    ? 'Loading diff…'
                    : '',
              ),
            )
          }

          const layout =
            (element.getAttribute('layout') as DiffLayout | null) ?? 'unified'
          return diffView(entry.diff, layout, review, {
            ids: element.ids,
            onFocusRow: rowId =>
              element.ownerDocument
                .getElementById(element.ids.id(`row-${rowId}`))
                ?.focus(),
          })
        },
        slots: () => ({
          'hunk-actions': (wrapper, data) => {
            const review = p.review as ReviewController
            const { hunkId } = data as { hunkId: string }
            const state = review.getSnapshot()
            const node = hunkCommentsView(state.comments, hunkId, {
              ids: element.ids,
              draft: drafts.get(hunkId) ?? '',
              onDraft: value => {
                drafts.set(hunkId, value)
                element.requestRender()
              },
              onAdd: () => {
                const draft = drafts.get(hunkId) ?? ''
                if (!state.selectedPath || !draft.trim()) return
                review.addComment(state.selectedPath, hunkId, draft)
                drafts.set(hunkId, '')
              },
              onSubmit: id => void review.submitComment(id).catch(() => {}),
            })
            patchChildren(wrapper, [node])
          },
        }),
      }
    },
    ['layout'],
    registry,
  )
}

export function defineAiTestReport(registry?: Registry): void {
  defineAiElement(
    'zw-ai-test-report',
    ['controller'],
    element => {
      const p = props(element)
      return {
        connect: () => subscribeAll(element, p.controller as never),
        view: () => {
          const controller = p.controller as TestReportController | undefined
          return controller
            ? testReportView(controller.getSnapshot(), controller, {
                ids: element.ids,
              })
            : null
        },
      }
    },
    [],
    registry,
  )
}

export function defineAiChangesetActions(registry?: Registry): void {
  defineAiElement(
    'zw-ai-changeset-actions',
    ['controller'],
    element => {
      const p = props(element)
      return {
        connect: () => subscribeAll(element, p.controller as never),
        view: () => {
          const controller = p.controller as
            | ChangeSetActionsController
            | undefined
          return controller
            ? changeSetActionsView(controller.getSnapshot(), controller)
            : null
        },
      }
    },
    [],
    registry,
  )
}
