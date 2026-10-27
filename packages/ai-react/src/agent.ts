/**
 * Agent surface for React (AI2-501): `AiExecutionStatus`, `AiStepList`,
 * `AiPlanOutline`, `AiStep`, `AiToolInvocation`, `AiApprovalPrompt`,
 * `AiRunSwitcher`.
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
import type { ReactElement, ReactNode } from 'react'

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
import { createElement, useEffect, useRef, useState } from 'react'
import {
  focusById,
  useAiSession,
  useAiState,
  useController,
  useIds,
  useOwnedController,
} from './hooks'
import { renderView } from './render'

export function AiExecutionStatus(props: {
  controller: ExecutionController
  locale?: AiLocale
}): ReactElement {
  const view = useController(props.controller)
  return renderView(
    executionStatusView(view, props.controller, { locale: props.locale }),
  ) as ReactElement
}

export interface AiToolInvocationProps {
  toolId: EntityId
  session?: AiSession
  locale?: AiLocale
  defaultExpanded?: boolean
}

export function AiToolInvocation(
  props: AiToolInvocationProps,
): ReactElement | null {
  const session = useAiSession(props.session)
  const ids = useIds()
  const [expanded, setExpanded] = useState(props.defaultExpanded ?? false)
  const tool = useAiState(session.store, state =>
    state.toolInvocations.get(props.toolId),
  )
  if (!tool) return null
  return renderView(
    toolInvocationView(tool, expanded, () => setExpanded(value => !value), {
      ids,
      locale: props.locale,
    }),
  ) as ReactElement
}

export interface AiStepProps {
  stepId: EntityId
  session?: AiSession
  locale?: AiLocale
}

/** One step row; subscribes to its own step and tool only. */
export function AiStep(props: AiStepProps): ReactElement | null {
  const session = useAiSession(props.session)
  const step = useAiState(session.store, state => state.steps.get(props.stepId))
  const tool = useAiState(session.store, state =>
    selectStepTool(state, props.stepId),
  )
  if (!step) return null

  return createElement(
    'div',
    { 'data-step-id': step.id },
    renderView(stepRowView(step, { locale: props.locale })),
    tool
      ? createElement(AiToolInvocation, {
          session,
          toolId: tool.id,
          locale: props.locale,
        })
      : null,
  )
}

export interface AiStepListProps {
  executionId: EntityId
  session?: AiSession
  /** Limit to some step kinds, e.g. `['plan']` for a plan outline. */
  kinds?: readonly ExecutionStep['kind'][]
  label?: string
  locale?: AiLocale
  renderStep?: (stepId: EntityId) => ReactNode
}

export function AiStepList(props: AiStepListProps): ReactElement {
  const session = useAiSession(props.session)
  const ids = useIds()
  const nodes = useAiState(session.store, state =>
    selectStepTree(state, props.executionId),
  )
  const roots = stepTreeNodes(nodes, props.kinds)
  const tree = useOwnedController(
    () =>
      createTreeController({
        defaultExpanded: true,
        // Steps start expanded so progress is visible without clicking.
        onFocus: id => {
          focusById(ids.id(`node-${id}`))
        },
      }),
    [props.executionId],
  )
  useController(tree)

  return renderView(
    stepTreeView(roots, tree, { ids, label: props.label ?? 'Steps' }),
    {
      slots: {
        step: data => {
          const { stepId } = data as { stepId: EntityId }
          return props.renderStep
            ? props.renderStep(stepId)
            : createElement(AiStep, { session, stepId, locale: props.locale })
        },
      },
    },
  ) as ReactElement
}

export function AiPlanOutline(
  props: Omit<AiStepListProps, 'kinds'>,
): ReactElement {
  return createElement(AiStepList, {
    ...props,
    kinds: ['plan'],
    label: props.label ?? 'Plan',
  })
}

export interface AiApprovalPromptProps {
  controller: ApprovalController
  /** Host-required phrase for high-risk approvals. */
  confirmationPhrase?: string
  /** Close without deciding; the approval stays pending. */
  onDismiss?: () => void
  presentation?: 'dialog' | 'region'
  locale?: AiLocale
}

export function AiApprovalPrompt(props: AiApprovalPromptProps): ReactElement {
  const ids = useIds()
  const view = useController(props.controller)
  const [confirmation, setConfirmation] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const rejectRef = useRef<HTMLElement>(null)
  const modal = (props.presentation ?? 'dialog') === 'dialog'

  useEffect(() => {
    // Least destructive action gets initial focus (APG alertdialog).
    if (modal) rejectRef.current?.focus()
  }, [modal])

  const node = approvalPromptView(view, props.controller, {
    ids,
    locale: props.locale,
    confirmationPhrase: props.confirmationPhrase,
    confirmationInput: confirmation,
    onConfirmationInput: setConfirmation,
    onDismiss: props.onDismiss,
    presentation: props.presentation,
  })

  return createElement(
    'div',
    {
      ref: containerRef,
      onKeyDown: (event: KeyboardEvent & { preventDefault: () => void }) => {
        if (modal && containerRef.current) {
          trapFocus(
            containerRef.current,
            event,
            containerRef.current.ownerDocument.activeElement,
          )
        }
      },
    },
    renderView(node, { refs: { reject: rejectRef } }),
  )
}

export interface AiRunSwitcherProps {
  controller: RunSwitcherController
  title?: (executionId: EntityId) => string
  locale?: AiLocale
}

export function AiRunSwitcher(props: AiRunSwitcherProps): ReactElement {
  const ids = useIds()
  const view = useController(props.controller)
  return renderView(
    runSwitcherView(view, props.controller, {
      ids,
      locale: props.locale,
      title: props.title ?? (id => id),
      onFocusTab: id => {
        focusById(ids.id(`run-${id}`))
      },
    }),
  ) as ReactElement
}
