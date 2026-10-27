/**
 * Agent elements (AI2-503): `zw-ai-execution-status`, `zw-ai-step-list`,
 * `zw-ai-step`, `zw-ai-tool-invocation`, `zw-ai-approval-prompt`,
 * `zw-ai-run-switcher`.
 *
 * `zw-ai-approval-prompt` emits `zw-ai-dismiss` when the user closes it
 * (Escape); the approval stays pending. Event details never carry the
 * approval contents.
 */

import type {
  AiSession,
  ApprovalController,
  EntityId,
  ExecutionController,
  ExecutionStep,
  RunSwitcherController,
} from '@zeus-web/ai-core'
import type { AiElementInstance } from './element'

import { selectStepTool, selectStepTree } from '@zeus-web/ai-core'
import {
  approvalPromptView,
  createTreeController,
  el,
  executionStatusView,
  runSwitcherView,
  stepRowView,
  stepTreeNodes,
  stepTreeView,
  toolInvocationView,
  trapFocus,
} from '@zeus-web/ai-primitives'
import { defineAiElement, elementSlot, emit } from './element'

type Registry = CustomElementRegistry | undefined

function props(element: AiElementInstance): Record<string, unknown> {
  return element as unknown as Record<string, unknown>
}

function onEntity(
  element: AiElementInstance,
  subscribe: ((listener: () => void) => () => void) | undefined,
): (() => void)[] {
  return subscribe ? [subscribe(() => element.requestRender())] : []
}

export function defineAiExecutionStatus(registry?: Registry): void {
  defineAiElement(
    'zw-ai-execution-status',
    ['controller'],
    element => {
      const p = props(element)
      return {
        connect: () => {
          const controller = p.controller as ExecutionController | undefined
          return onEntity(
            element,
            controller &&
              (listener => controller.subscribe(view => view, listener)),
          )
        },
        view: () => {
          const controller = p.controller as ExecutionController | undefined
          return controller
            ? executionStatusView(controller.getSnapshot(), controller)
            : null
        },
      }
    },
    [],
    registry,
  )
}

export function defineAiToolInvocation(registry?: Registry): void {
  defineAiElement(
    'zw-ai-tool-invocation',
    ['session', 'toolId'],
    element => {
      const p = props(element)
      let expanded = element.hasAttribute('expanded')
      return {
        connect: () => {
          const session = p.session as AiSession | undefined
          const toolId = p.toolId as EntityId | undefined
          return onEntity(
            element,
            session && toolId
              ? listener =>
                  session.store.subscribe(
                    state => state.toolInvocations.get(toolId),
                    listener,
                  )
              : undefined,
          )
        },
        view: () => {
          const session = p.session as AiSession | undefined
          const tool = session?.store
            .getState()
            .toolInvocations.get(p.toolId as EntityId)
          if (!tool) return null
          return toolInvocationView(
            tool,
            expanded,
            () => {
              expanded = !expanded
              element.requestRender()
            },
            { ids: element.ids },
          )
        },
      }
    },
    ['expanded'],
    registry,
  )
}

export function defineAiStep(registry?: Registry): void {
  defineAiToolInvocation(registry)

  defineAiElement(
    'zw-ai-step',
    ['session', 'stepId'],
    element => {
      const p = props(element)
      return {
        connect: () => {
          const session = p.session as AiSession | undefined
          const stepId = p.stepId as EntityId | undefined
          if (!session || !stepId) return []
          return [
            session.store.subscribe(
              state => state.steps.get(stepId),
              () => element.requestRender(),
            ),
            session.store.subscribe(
              state => selectStepTool(state, stepId),
              () => element.requestRender(),
            ),
          ]
        },
        view: () => {
          const session = p.session as AiSession | undefined
          const step = session?.store.getState().steps.get(p.stepId as EntityId)
          if (!session || !step) return null
          const tool = selectStepTool(session.store.getState(), step.id)
          return el('div', { attrs: { 'data-step-id': step.id } }, [
            stepRowView(step),
            tool && { type: 'slot', name: 'tool', data: tool.id, key: tool.id },
          ])
        },
        slots: () => ({
          tool: elementSlot('zw-ai-tool-invocation', data => ({
            session: p.session,
            toolId: data as EntityId,
          })),
        }),
      }
    },
    [],
    registry,
  )
}

export function defineAiStepList(registry?: Registry): void {
  defineAiStep(registry)

  defineAiElement(
    'zw-ai-step-list',
    ['session', 'executionId', 'kinds'],
    element => {
      const p = props(element)
      const tree = createTreeController({
        initiallyExpanded: Object.keys(
          (p.session as AiSession | undefined)?.store.getState().steps ?? {},
        ),
        onFocus: id =>
          element.ownerDocument
            .getElementById(element.ids.id(`node-${id}`))
            ?.focus(),
      })
      return {
        connect: () => {
          const session = p.session as AiSession | undefined
          const executionId = p.executionId as EntityId | undefined
          if (!session || !executionId) return [() => tree.dispose()]
          return [
            session.store.subscribe(
              state => selectStepTree(state, executionId),
              () => element.requestRender(),
            ),
            tree.subscribe(
              view => view,
              () => element.requestRender(),
            ),
            () => tree.dispose(),
          ]
        },
        view: () => {
          const session = p.session as AiSession | undefined
          const executionId = p.executionId as EntityId | undefined
          if (!session || !executionId) return null
          const roots = stepTreeNodes(
            selectStepTree(session.store.getState(), executionId),
            p.kinds as readonly ExecutionStep['kind'][] | undefined,
          )
          return stepTreeView(roots, tree, {
            ids: element.ids,
            label: element.getAttribute('label') ?? 'Steps',
          })
        },
        slots: () => ({
          step: elementSlot('zw-ai-step', data => ({
            session: p.session,
            stepId: (data as { stepId: EntityId }).stepId,
          })),
        }),
      }
    },
    ['label'],
    registry,
  )
}

export function defineAiApprovalPrompt(registry?: Registry): void {
  defineAiElement(
    'zw-ai-approval-prompt',
    ['controller'],
    element => {
      const p = props(element)
      let confirmation = ''
      let focused = false
      const modal = (): boolean =>
        element.getAttribute('presentation') !== 'region'
      const onKeydown = (event: KeyboardEvent): void => {
        if (modal())
          trapFocus(element, event, element.ownerDocument.activeElement)
      }

      return {
        connect: () => {
          const controller = p.controller as ApprovalController | undefined
          element.addEventListener('keydown', onKeydown)
          return [
            ...onEntity(
              element,
              controller &&
                (listener => controller.subscribe(view => view, listener)),
            ),
            () => element.removeEventListener('keydown', onKeydown),
          ]
        },
        view: () => {
          const controller = p.controller as ApprovalController | undefined
          if (!controller) return null
          return approvalPromptView(controller.getSnapshot(), controller, {
            ids: element.ids,
            confirmationPhrase:
              element.getAttribute('confirmation-phrase') ?? undefined,
            confirmationInput: confirmation,
            onConfirmationInput: value => {
              confirmation = value
              element.requestRender()
            },
            onDismiss: () => emit(element, 'zw-ai-dismiss'),
            presentation: modal() ? 'dialog' : 'region',
          })
        },
        afterRender: () => {
          // Least destructive action gets initial focus (APG alertdialog).
          if (focused || !modal()) return
          const reject = element.querySelector<HTMLElement>(
            '[data-action="reject"]',
          )
          if (reject) {
            reject.focus()
            focused = true
          }
        },
      }
    },
    ['confirmation-phrase', 'presentation'],
    registry,
  )
}

export function defineAiRunSwitcher(registry?: Registry): void {
  defineAiElement(
    'zw-ai-run-switcher',
    ['controller', 'titleOf'],
    element => {
      const p = props(element)
      return {
        connect: () => {
          const controller = p.controller as RunSwitcherController | undefined
          return onEntity(
            element,
            controller &&
              (listener => controller.subscribe(view => view, listener)),
          )
        },
        view: () => {
          const controller = p.controller as RunSwitcherController | undefined
          if (!controller) return null
          return runSwitcherView(controller.getSnapshot(), controller, {
            ids: element.ids,
            title:
              (p.titleOf as ((id: EntityId) => string) | undefined) ??
              (id => id),
            onFocusTab: id =>
              element.ownerDocument
                .getElementById(element.ids.id(`run-${id}`))
                ?.focus(),
          })
        },
      }
    },
    [],
    registry,
  )
}
