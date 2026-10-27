/**
 * Execution controller (AI2-301).
 *
 * Stop / pause / resume / retry are intents, not facts (02-INTERACTION-SPEC
 * B4). Sending one puts the view into a local `*-requested` state; the
 * execution's status changes only when the host's event arrives. An action
 * is offered only when the current status allows it *and* the host declared
 * the capability — an unsupported pause is not shown as available.
 */

import type { EntityId, Execution, ExecutionStatus } from '../domain/types'
import type { CommandAck } from '../protocol/commands'
import type { AiSession } from './session'
import type { Controller, IdGenerator } from './view-store'

import { isExecutionTerminal } from '../domain/execution'
import { createCommand } from '../protocol/commands'
import { createViewStore, defaultIdGenerator, sameItems } from './view-store'

export type ExecutionAction = 'cancel' | 'pause' | 'resume' | 'retry'

export type ExecutionCapabilities = Readonly<Record<ExecutionAction, boolean>>

export const DEFAULT_EXECUTION_CAPABILITIES: ExecutionCapabilities = {
  cancel: true,
  pause: false,
  resume: false,
  retry: false,
}

export interface ExecutionViewState {
  executionId: EntityId
  status?: ExecutionStatus
  /** An intent the host accepted but has not confirmed with an event. */
  pendingAction?: ExecutionAction
  availableActions: readonly ExecutionAction[]
  lastError?: string
  lastErrorCode?: string
}

export interface ExecutionControllerOptions {
  session: Pick<AiSession, 'store' | 'execute'>
  executionId: EntityId
  /** Host-declared capabilities, fixed or per execution. */
  capabilities?:
    | Partial<ExecutionCapabilities>
    | ((execution: Execution) => Partial<ExecutionCapabilities>)
  createId?: IdGenerator
}

export interface ExecutionController extends Controller<ExecutionViewState> {
  request: (action: ExecutionAction) => Promise<CommandAck>
}

const ACTION_SOURCES: Readonly<
  Record<ExecutionAction, readonly ExecutionStatus[]>
> = {
  cancel: ['queued', 'running', 'awaiting-approval', 'paused'],
  pause: ['running'],
  resume: ['paused'],
  retry: ['failed', 'cancelled'],
}

const COMMAND_TYPES: Readonly<Record<ExecutionAction, string>> = {
  cancel: 'execution.cancel',
  pause: 'execution.pause',
  resume: 'execution.resume',
  retry: 'execution.retry',
}

export function availableExecutionActions(
  execution: Execution | undefined,
  capabilities: ExecutionCapabilities,
): ExecutionAction[] {
  if (!execution) return []

  return (Object.keys(ACTION_SOURCES) as ExecutionAction[]).filter(
    action =>
      capabilities[action] && ACTION_SOURCES[action].includes(execution.status),
  )
}

/** Whether a newly observed status settles a pending intent. */
function settles(action: ExecutionAction, status: ExecutionStatus): boolean {
  switch (action) {
    case 'cancel':
      return isExecutionTerminal(status)
    case 'pause':
      return status !== 'running'
    case 'resume':
      return status !== 'paused'
    case 'retry':
      // A retry creates a new execution; this one stays as it was.
      return true
  }
}

export function createExecutionController(
  options: ExecutionControllerOptions,
): ExecutionController {
  const { store } = options.session
  const createId = options.createId ?? defaultIdGenerator

  function capabilitiesOf(
    execution: Execution | undefined,
  ): ExecutionCapabilities {
    const declared =
      typeof options.capabilities === 'function'
        ? execution
          ? options.capabilities(execution)
          : {}
        : (options.capabilities ?? {})
    return { ...DEFAULT_EXECUTION_CAPABILITIES, ...declared }
  }

  function read(
    pendingAction: ExecutionAction | undefined,
  ): Omit<ExecutionViewState, 'lastError' | 'lastErrorCode'> {
    const execution = store.getState().executions[options.executionId]
    const available = availableExecutionActions(
      execution,
      capabilitiesOf(execution),
    )

    return {
      executionId: options.executionId,
      status: execution?.status,
      pendingAction,
      // While an intent is pending, do not offer a second one.
      availableActions: pendingAction ? [] : available,
    }
  }

  const view = createViewStore<ExecutionViewState>(read(undefined))
  const inFlight = new Map<ExecutionAction, Promise<CommandAck>>()

  function refresh(): void {
    const current = view.getSnapshot()
    let pending = current.pendingAction
    const execution = store.getState().executions[options.executionId]

    if (pending && execution && execution.status !== current.status) {
      if (settles(pending, execution.status)) pending = undefined
    }

    const next = read(pending)
    view.update({
      ...next,
      availableActions: sameItems(
        current.availableActions,
        next.availableActions,
      )
        ? current.availableActions
        : next.availableActions,
    })
  }

  view.onDispose(
    store.subscribe(state => state.executions[options.executionId], refresh),
  )

  return {
    getSnapshot: view.getSnapshot,
    subscribe: view.subscribe,
    get disposed(): boolean {
      return view.disposed
    },
    request(action): Promise<CommandAck> {
      const shared = inFlight.get(action)
      if (shared) return shared

      const execution = store.getState().executions[options.executionId]
      const current = view.getSnapshot()

      if (!execution || !current.availableActions.includes(action)) {
        return Promise.resolve({
          accepted: false,
          commandId: '',
          code: 'AI_EXECUTION_ACTION_UNAVAILABLE',
          message: `${action} is not available for execution ${options.executionId}`,
        })
      }

      view.update({
        pendingAction: action,
        availableActions: [],
        lastError: undefined,
        lastErrorCode: undefined,
      })

      const command = createCommand({
        commandId: createId('cmd'),
        // One key per action and observed revision: double clicks dedupe,
        // a later request against a newer revision is a new intent.
        idempotencyKey: `${options.executionId}:${action}:${execution.revision}`,
        type: COMMAND_TYPES[action],
        target: { kind: 'execution', id: options.executionId },
        expectedRevision: execution.revision,
        payload:
          action === 'retry'
            ? { retryOf: options.executionId }
            : { executionId: options.executionId },
      })

      const attempt = options.session
        .execute(command)
        .then(ack => {
          if (!ack.accepted || action === 'retry') {
            view.update({
              ...read(undefined),
              ...(ack.accepted
                ? {}
                : { lastError: ack.message, lastErrorCode: ack.code }),
            })
          }
          return ack
        })
        .catch((error: unknown) => {
          view.update({
            ...read(undefined),
            lastError: error instanceof Error ? error.message : String(error),
            lastErrorCode:
              (error as { code?: string }).code ?? 'AI_COMMAND_TRANSPORT',
          })
          throw error
        })
        .finally(() => inFlight.delete(action))

      inFlight.set(action, attempt)
      return attempt
    },
    dispose(): void {
      view.dispose()
    },
  }
}
