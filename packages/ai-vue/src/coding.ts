/**
 * Coding review surface for Vue (AI2-502). Scoped slot `hunk-actions`
 * (`{ hunkId }`) on `AiDiffViewer` replaces the default comment controls.
 */

import type {
  ChangeSetActionsController,
  ReviewController,
  TestReportController,
  WorkspaceController,
} from '@zeus-web/ai-core'
import type { AiLocale, DiffLayout } from '@zeus-web/ai-primitives'
import type { PropType } from 'vue'

import {
  changeSetActionsView,
  createTreeController,
  diffView,
  fileTreeView,
  hunkCommentsView,
  testReportView,
  workspacePickerView,
} from '@zeus-web/ai-primitives'
import { defineComponent, h, ref } from 'vue'
import {
  focusById,
  useController,
  useIds,
  useOwnedController,
} from './composables'
import { renderRoot } from './render'

const localeProp = { type: Object as PropType<AiLocale>, required: false }

export const AiWorkspacePicker = defineComponent({
  name: 'AiWorkspacePicker',
  props: {
    controller: {
      type: Object as PropType<WorkspaceController>,
      required: true,
    },
    locale: localeProp,
  },
  setup(props) {
    const ids = useIds()
    const view = useController(props.controller)
    return () =>
      renderRoot(
        workspacePickerView(view.value, props.controller, {
          ids,
          locale: props.locale,
        }),
      )
  },
})

export const AiFileChangeTree = defineComponent({
  name: 'AiFileChangeTree',
  props: {
    review: { type: Object as PropType<ReviewController>, required: true },
    locale: localeProp,
  },
  setup(props) {
    const ids = useIds()
    const view = useController(props.review)
    const tree = useOwnedController(() =>
      createTreeController({
        defaultExpanded: true,
        onSelect: id => {
          if (!id.startsWith('dir:')) void props.review.selectFile(id)
        },
        onFocus: id => focusById(ids.id(`node-${id}`)),
      }),
    )
    const treeView = useController(tree)
    return () => {
      void treeView.value
      return renderRoot(
        fileTreeView(view.value, tree, { ids, locale: props.locale }),
      )
    }
  },
})

export const AiHunkComments = defineComponent({
  name: 'AiHunkComments',
  props: {
    review: { type: Object as PropType<ReviewController>, required: true },
    hunkId: { type: String, required: true },
    locale: localeProp,
  },
  setup(props) {
    const ids = useIds()
    const comments = useController(props.review, view => view.comments)
    const path = useController(props.review, view => view.selectedPath)
    const draft = ref('')
    return () =>
      renderRoot(
        hunkCommentsView(comments.value, props.hunkId, {
          ids,
          locale: props.locale,
          draft: draft.value,
          onDraft: value => (draft.value = value),
          onAdd: () => {
            if (!path.value || !draft.value.trim()) return
            props.review.addComment(path.value, props.hunkId, draft.value)
            draft.value = ''
          },
          onSubmit: id => void props.review.submitComment(id).catch(() => {}),
        }),
      )
  },
})

export const AiDiffViewer = defineComponent({
  name: 'AiDiffViewer',
  props: {
    review: { type: Object as PropType<ReviewController>, required: true },
    layout: { type: String as PropType<DiffLayout>, default: 'unified' },
    locale: localeProp,
  },
  setup(props, { slots }) {
    const ids = useIds()
    const view = useController(props.review)
    return () => {
      const current = view.value
      const entry = current.selectedPath
        ? current.diffs[current.selectedPath]
        : undefined
      if (!entry || entry.status !== 'ready' || !entry.diff) {
        return h(
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
      return renderRoot(
        diffView(entry.diff, props.layout, props.review, {
          ids,
          locale: props.locale,
          onFocusRow: rowId => focusById(ids.id(`row-${rowId}`)),
        }),
        {
          slots: {
            'hunk-actions': data => {
              const { hunkId } = data as { hunkId: string }
              return slots['hunk-actions']
                ? slots['hunk-actions']({ hunkId })
                : h(AiHunkComments, {
                    key: hunkId,
                    review: props.review,
                    hunkId,
                    locale: props.locale,
                  })
            },
          },
        },
      )
    }
  },
})

export const AiTestReport = defineComponent({
  name: 'AiTestReport',
  props: {
    controller: {
      type: Object as PropType<TestReportController>,
      required: true,
    },
    locale: localeProp,
  },
  setup(props) {
    const ids = useIds()
    const view = useController(props.controller)
    return () =>
      renderRoot(
        testReportView(view.value, props.controller, {
          ids,
          locale: props.locale,
        }),
      )
  },
})

export const AiChangesetActions = defineComponent({
  name: 'AiChangesetActions',
  props: {
    controller: {
      type: Object as PropType<ChangeSetActionsController>,
      required: true,
    },
    locale: localeProp,
  },
  setup(props) {
    const view = useController(props.controller)
    return () =>
      renderRoot(
        changeSetActionsView(view.value, props.controller, {
          locale: props.locale,
        }),
      )
  },
})
