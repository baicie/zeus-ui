/**
 * Agent surface for Vue (AI2-502). Scoped slot `step` (`{ stepId }`) on
 * `AiStepList` renders any VNode per step.
 */

import type {
  AiSession,
  ApprovalController,
  EntityId,
  ExecutionController,
  ExecutionStep,
  RunSwitcherController,
} from '@zeus-web/ai-core'
import type { AiLocale } from '@zeus-web/ai-primitives'
import type { PropType } from 'vue'

import { selectStepTool, selectStepTree } from '@zeus-web/ai-core'
import {
  approvalPromptView,
  createTreeController,
  executionStatusView,
  runSwitcherView,
  stepRowView,
  stepTreeNodes,
  stepTreeView,
  toolInvocationView,
  trapFocus,
} from '@zeus-web/ai-primitives'
import { defineComponent, h, onMounted, ref, shallowRef } from 'vue'
import {
  focusById,
  useAiSession,
  useAiState,
  useController,
  useIds,
  useOwnedController,
} from './composables'
import { renderRoot } from './render'

const sessionProp = { type: Object as PropType<AiSession>, required: false }
const localeProp = { type: Object as PropType<AiLocale>, required: false }

export const AiExecutionStatus = defineComponent({
  name: 'AiExecutionStatus',
  props: {
    controller: {
      type: Object as PropType<ExecutionController>,
      required: true,
    },
    locale: localeProp,
  },
  setup(props) {
    const view = useController(props.controller)
    return () =>
      renderRoot(
        executionStatusView(view.value, props.controller, {
          locale: props.locale,
        }),
      )
  },
})

export const AiToolInvocation = defineComponent({
  name: 'AiToolInvocation',
  props: {
    toolId: { type: String, required: true },
    session: sessionProp,
    locale: localeProp,
    defaultExpanded: Boolean,
  },
  setup(props) {
    const session = useAiSession(props.session)
    const ids = useIds()
    const expanded = ref(props.defaultExpanded)
    const tool = useAiState(
      session.store,
      state => state.toolInvocations[props.toolId],
    )
    return () =>
      tool.value
        ? renderRoot(
            toolInvocationView(
              tool.value,
              expanded.value,
              () => (expanded.value = !expanded.value),
              {
                ids,
                locale: props.locale,
              },
            ),
          )
        : null
  },
})

export const AiStep = defineComponent({
  name: 'AiStep',
  props: {
    stepId: { type: String, required: true },
    session: sessionProp,
    locale: localeProp,
  },
  setup(props) {
    const session = useAiSession(props.session)
    const step = useAiState(session.store, state => state.steps[props.stepId])
    const tool = useAiState(session.store, state =>
      selectStepTool(state, props.stepId),
    )
    return () =>
      step.value
        ? h('div', { 'data-step-id': step.value.id }, [
            renderRoot(stepRowView(step.value, { locale: props.locale })),
            tool.value
              ? h(AiToolInvocation, {
                  session,
                  toolId: tool.value.id,
                  locale: props.locale,
                })
              : null,
          ])
        : null
  },
})

export const AiStepList = defineComponent({
  name: 'AiStepList',
  props: {
    executionId: { type: String, required: true },
    session: sessionProp,
    kinds: {
      type: Array as PropType<readonly ExecutionStep['kind'][]>,
      required: false,
    },
    label: String,
    locale: localeProp,
  },
  setup(props, { slots }) {
    const session = useAiSession(props.session)
    const ids = useIds()
    const nodes = useAiState(session.store, state =>
      selectStepTree(state, props.executionId),
    )
    const tree = useOwnedController(() =>
      createTreeController({
        initiallyExpanded: Object.keys(session.store.getState().steps),
        onFocus: id => focusById(ids.id(`node-${id}`)),
      }),
    )
    const treeView = useController(tree)

    return () => {
      void treeView.value
      return renderRoot(
        stepTreeView(stepTreeNodes(nodes.value, props.kinds), tree, {
          ids,
          label: props.label ?? 'Steps',
        }),
        {
          slots: {
            step: data => {
              const { stepId } = data as { stepId: EntityId }
              return slots.step
                ? slots.step({ stepId })
                : h(AiStep, {
                    key: stepId,
                    session,
                    stepId,
                    locale: props.locale,
                  })
            },
          },
        },
      )
    }
  },
})

export const AiPlanOutline = defineComponent({
  name: 'AiPlanOutline',
  props: {
    executionId: { type: String, required: true },
    session: sessionProp,
    label: String,
    locale: localeProp,
  },
  setup(props, { slots }) {
    return () =>
      h(
        AiStepList,
        { ...props, kinds: ['plan'], label: props.label ?? 'Plan' },
        slots,
      )
  },
})

export const AiApprovalPrompt = defineComponent({
  name: 'AiApprovalPrompt',
  props: {
    controller: {
      type: Object as PropType<ApprovalController>,
      required: true,
    },
    confirmationPhrase: String,
    presentation: {
      type: String as PropType<'dialog' | 'region'>,
      required: false,
    },
    /** Close without deciding; the approval stays pending. */
    onDismiss: { type: Function as PropType<() => void>, required: false },
    locale: localeProp,
  },
  setup(props) {
    const ids = useIds()
    const view = useController(props.controller)
    const confirmation = ref('')
    const container = shallowRef<HTMLElement | null>(null)
    const reject = shallowRef<HTMLElement | null>(null)
    const modal = (props.presentation ?? 'dialog') === 'dialog'

    onMounted(() => {
      if (modal) reject.value?.focus()
    })

    return () =>
      h(
        'div',
        {
          ref: container,
          onKeydown: (event: KeyboardEvent) => {
            if (modal && container.value) {
              trapFocus(
                container.value,
                event,
                container.value.ownerDocument.activeElement,
              )
            }
          },
        },
        [
          renderRoot(
            approvalPromptView(view.value, props.controller, {
              ids,
              locale: props.locale,
              confirmationPhrase: props.confirmationPhrase,
              confirmationInput: confirmation.value,
              onConfirmationInput: value => (confirmation.value = value),
              onDismiss: props.onDismiss,
              presentation: props.presentation,
            }),
            { refs: { reject } },
          ),
        ],
      )
  },
})

export const AiRunSwitcher = defineComponent({
  name: 'AiRunSwitcher',
  props: {
    controller: {
      type: Object as PropType<RunSwitcherController>,
      required: true,
    },
    title: {
      type: Function as PropType<(executionId: EntityId) => string>,
      required: false,
    },
    locale: localeProp,
  },
  setup(props) {
    const ids = useIds()
    const view = useController(props.controller)
    return () =>
      renderRoot(
        runSwitcherView(view.value, props.controller, {
          ids,
          locale: props.locale,
          title: props.title ?? (id => id),
          onFocusTab: id => focusById(ids.id(`run-${id}`)),
        }),
      )
  },
})
