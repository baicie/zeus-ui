/**
 * Fine-grained selectors (AI2-109).
 *
 * Selectors are plain functions over canonical state. List selectors memoize on
 * the index array reference plus each entity reference, so a change to one
 * message does not invalidate an unrelated list.
 */

import type {
  ApprovalRequest,
  ApprovalStatus,
  Conversation,
  EntityId,
  Execution,
  ExecutionStep,
  Message,
  ToolInvocation,
} from '../domain/types'
import type { AiState } from './state'

type EntityRecord<T> = Readonly<Record<EntityId, T>>

function memoizeList<T>(
  readIds: (state: AiState) => readonly EntityId[] | undefined,
  readEntity: (state: AiState) => EntityRecord<T>,
): (state: AiState) => readonly T[] {
  let lastIds: readonly EntityId[] | undefined
  let lastRecord: EntityRecord<T> | undefined
  let lastValues: readonly T[] | undefined

  return (state: AiState): readonly T[] => {
    const ids = readIds(state) ?? []
    const record = readEntity(state)

    if (lastValues && ids === lastIds && record === lastRecord) {
      return lastValues
    }

    const values = ids
      .map(id => record[id])
      .filter((entry): entry is T => entry !== undefined)

    if (
      lastValues &&
      lastValues.length === values.length &&
      lastValues.every((entry, index) => entry === values[index])
    ) {
      return lastValues
    }

    lastIds = ids
    lastRecord = record
    lastValues = values

    return values
  }
}

export function selectConversation(
  state: AiState,
  id: EntityId,
): Conversation | undefined {
  return state.conversations[id]
}

export function selectMessage(
  state: AiState,
  id: EntityId,
): Message | undefined {
  return state.messages[id]
}

export function selectExecution(
  state: AiState,
  id: EntityId,
): Execution | undefined {
  return state.executions[id]
}

export function selectToolInvocation(
  state: AiState,
  id: EntityId,
): ToolInvocation | undefined {
  return state.toolInvocations[id]
}

export function selectApproval(
  state: AiState,
  id: EntityId,
): ApprovalRequest | undefined {
  return state.approvals[id]
}

export function selectConversationMessageIds(
  state: AiState,
  conversationId: EntityId,
): readonly EntityId[] {
  return state.conversationMessageIds[conversationId] ?? []
}

const timelineSelectors: Map<EntityId, (state: AiState) => readonly Message[]> =
  new Map()

export function selectConversationTimeline(
  state: AiState,
  conversationId: EntityId,
): readonly Message[] {
  let selector = timelineSelectors.get(conversationId)

  if (!selector) {
    selector = memoizeList<Message>(
      current => current.conversationMessageIds[conversationId],
      current => current.messages,
    )
    timelineSelectors.set(conversationId, selector)
  }

  return selector(state)
}

const stepSelectors: Map<
  EntityId,
  (state: AiState) => readonly ExecutionStep[]
> = new Map()

export function selectExecutionSteps(
  state: AiState,
  executionId: EntityId,
): readonly ExecutionStep[] {
  let selector = stepSelectors.get(executionId)

  if (!selector) {
    selector = memoizeList<ExecutionStep>(
      current => {
        const execution = current.executions[executionId]
        return execution ? execution.activeStepIds : undefined
      },
      current => current.steps,
    )
    stepSelectors.set(executionId, selector)
  }

  return selector(state)
}

function recordValues<T>(record: Readonly<Record<string, T>>): T[] {
  return Object.keys(record).map(key => record[key])
}

export function selectApprovalsForExecution(
  state: AiState,
  executionId: EntityId,
): readonly ApprovalRequest[] {
  return recordValues(state.approvals).filter(
    approval => approval.executionId === executionId,
  )
}

export function selectApprovalsByStatus(
  state: AiState,
  status: ApprovalStatus,
): readonly ApprovalRequest[] {
  return recordValues(state.approvals).filter(
    approval => approval.status === status,
  )
}

export function selectPendingApprovals(
  state: AiState,
): readonly ApprovalRequest[] {
  return recordValues(state.approvals).filter(
    approval =>
      approval.status === 'pending' || approval.status === 'submitted',
  )
}

export function selectMessageText(state: AiState, id: EntityId): string {
  const message = state.messages[id]

  if (!message) return ''

  return message.parts
    .map(part => (part.kind === 'text' ? part.text : ''))
    .join('')
}
