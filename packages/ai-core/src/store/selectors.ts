/**
 * Fine-grained selectors (AI2-109).
 *
 * Selectors are plain functions over canonical state and return stable
 * references: calling one twice against an unchanged slice yields the same
 * array, so `store.subscribe(selector, listener)` with the default `Object.is`
 * only fires when that slice really changed.
 *
 * Memoization lives in `WeakMap`s keyed by the state's own index arrays and
 * records. Nothing is cached at module scope by id, so a long-running SSR
 * process or many short-lived stores never accumulate entries, and one
 * store's entities are never retained on behalf of another.
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
import type { EntityMap } from './entity-map'
import type { AiState } from './state'

const EMPTY: readonly never[] = Object.freeze([])

interface ListMemo {
  record: object
  values: readonly unknown[]
}

/** Cache keyed by the index array: lives exactly as long as that array. */
const listMemos = new WeakMap<readonly EntityId[], ListMemo>()

function resolveList<T>(
  ids: readonly EntityId[] | undefined,
  record: EntityMap<T>,
): readonly T[] {
  if (!ids || ids.length === 0) return EMPTY

  const memo = listMemos.get(ids)

  if (memo && memo.record === record) return memo.values as readonly T[]

  const values = ids
    .map(id => record.get(id))
    .filter((entry): entry is T => entry !== undefined)

  if (
    memo &&
    memo.values.length === values.length &&
    memo.values.every((entry, index) => entry === values[index])
  ) {
    memo.record = record
    return memo.values as readonly T[]
  }

  listMemos.set(ids, { record, values })

  return values
}

export function selectConversation(
  state: AiState,
  id: EntityId,
): Conversation | undefined {
  return state.conversations.get(id)
}

export function selectMessage(
  state: AiState,
  id: EntityId,
): Message | undefined {
  return state.messages.get(id)
}

export function selectExecution(
  state: AiState,
  id: EntityId,
): Execution | undefined {
  return state.executions.get(id)
}

export function selectStep(
  state: AiState,
  id: EntityId,
): ExecutionStep | undefined {
  return state.steps.get(id)
}

export function selectToolInvocation(
  state: AiState,
  id: EntityId,
): ToolInvocation | undefined {
  return state.toolInvocations.get(id)
}

export function selectApproval(
  state: AiState,
  id: EntityId,
): ApprovalRequest | undefined {
  return state.approvals.get(id)
}

export function selectConversationMessageIds(
  state: AiState,
  conversationId: EntityId,
): readonly EntityId[] {
  return state.conversationMessageIds[conversationId] ?? EMPTY
}

export function selectConversationTimeline(
  state: AiState,
  conversationId: EntityId,
): readonly Message[] {
  return resolveList(
    state.conversationMessageIds[conversationId],
    state.messages,
  )
}

/** Every step of an execution in host order, including finished ones. */
export function selectExecutionSteps(
  state: AiState,
  executionId: EntityId,
): readonly ExecutionStep[] {
  return resolveList(state.executionStepIds[executionId], state.steps)
}

/** Only the steps the host currently lists as active on the execution. */
export function selectActiveExecutionSteps(
  state: AiState,
  executionId: EntityId,
): readonly ExecutionStep[] {
  return resolveList(
    state.executions.get(executionId)?.activeStepIds,
    state.steps,
  )
}

const approvalQueries = new WeakMap<
  EntityMap<ApprovalRequest>,
  Map<string, readonly ApprovalRequest[]>
>()

/** Filter approvals once per approvals record; unrelated commits reuse it. */
function queryApprovals(
  state: AiState,
  key: string,
  predicate: (approval: ApprovalRequest) => boolean,
): readonly ApprovalRequest[] {
  let cache = approvalQueries.get(state.approvals)

  if (!cache) {
    cache = new Map()
    approvalQueries.set(state.approvals, cache)
  }

  const cached = cache.get(key)
  if (cached) return cached

  const values = state.approvals.values().filter(predicate)
  const result = values.length === 0 ? EMPTY : values

  cache.set(key, result)

  return result
}

export function selectApprovalsForExecution(
  state: AiState,
  executionId: EntityId,
): readonly ApprovalRequest[] {
  return queryApprovals(
    state,
    `execution:${executionId}`,
    approval => approval.executionId === executionId,
  )
}

export function selectApprovalsByStatus(
  state: AiState,
  status: ApprovalStatus,
): readonly ApprovalRequest[] {
  return queryApprovals(
    state,
    `status:${status}`,
    approval => approval.status === status,
  )
}

export function selectPendingApprovals(
  state: AiState,
): readonly ApprovalRequest[] {
  return queryApprovals(
    state,
    'pending',
    approval =>
      approval.status === 'pending' || approval.status === 'submitted',
  )
}

/**
 * Element-wise equality for list selectors. Approval queries are recomputed
 * whenever any approval changes; pass this as the `equal` argument of
 * `store.subscribe` to stay quiet when the filtered entities are unchanged.
 */
export function shallowArrayEqual<T>(
  previous: readonly T[],
  next: readonly T[],
): boolean {
  if (previous === next) return true
  if (previous.length !== next.length) return false

  return previous.every((entry, index) => entry === next[index])
}

export function selectMessageText(state: AiState, id: EntityId): string {
  const message = state.messages.get(id)

  if (!message) return ''

  return message.parts
    .map(part => (part.kind === 'text' ? part.text : ''))
    .join('')
}
