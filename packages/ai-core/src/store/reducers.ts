/**
 * Canonical reducers (AI2-107).
 *
 * Every handler returns a new state object that replaces only the touched
 * collection and entity; untouched entities keep their object identity so
 * fine-grained selectors stay quiet. Invalid revisions and illegal state
 * transitions are rejected with a stable code instead of being applied.
 *
 * Invariants enforced here (they hold for every event source, including a
 * replayed or snapshot-seeded stream):
 *
 * - A lifecycle only moves along its transition table. Re-sending an entity
 *   (`execution.started`, `approval.requested`, `step.upserted`, ...) can not
 *   be used to jump states or revive a terminal entity (threats T7-3/T7-4).
 * - An approval is born `pending`, and only `approval.resolved` changes its
 *   status. Its target, operation, scope and risk are immutable once
 *   requested (threats T1-4/T3-1/T3-5).
 * - Children resolve their parent inside the same aggregate: steps, tools,
 *   approvals, change sets and execution-bound artifacts need their
 *   execution; messages need their conversation and a parent message from the
 *   same conversation; a conversation's selected leaf is one of its own
 *   messages. Optional
 *   cross-aggregate links (message ↔ execution, execution ↔ conversation)
 *   stay optional, because those aggregates may live on different streams.
 */

import type {
  ApprovalRequest,
  Artifact,
  ChangeSet,
  ContentPart,
  Conversation,
  Execution,
  ExecutionStep,
  Message,
  ToolInvocation,
} from '../domain/types'
import type {
  AnyDomainEvent,
  ApprovalResolvedPayload,
  ExecutionStatusChangedPayload,
  MessageCompletedPayload,
  MessagePartDeltaPayload,
} from '../protocol/events'

import type { AiState } from './state'
import { canResolveApproval } from '../domain/approval'
import { canTransitionChangeSet } from '../domain/changeset'
import {
  canTransitionExecution,
  isStepTerminal,
  isToolTerminal,
} from '../domain/execution'
import { stableEqual } from '../internal/stable'

export type ReduceErrorCode =
  | 'entity-missing'
  | 'reference-missing'
  | 'reference-mismatch'
  | 'immutable-field'
  | 'revision-mismatch'
  | 'state-mismatch'
  | 'illegal-transition'
  | 'part-missing'
  | 'part-kind-mismatch'
  | 'invalid-delta'
  | 'invalid-terminal-status'

export type ReduceResult =
  | { ok: true; state: AiState }
  | { ok: false; code: ReduceErrorCode; message: string }

function fail(code: ReduceErrorCode, message: string): ReduceResult {
  return { ok: false, code, message }
}

function unchanged(state: AiState): ReduceResult {
  return { ok: true, state }
}

/**
 * Replace one index entry. Index tables are keyed by aggregate (few keys),
 * so a frozen shallow copy is cheap; entity collections use `EntityMap.set`.
 */
function withEntity<T>(
  record: Readonly<Record<string, T>>,
  id: string,
  entity: T,
): Readonly<Record<string, T>> {
  return Object.freeze({ ...record, [id]: entity })
}

function appendIndex(
  index: Readonly<Record<string, readonly string[]>>,
  key: string,
  id: string,
): Readonly<Record<string, readonly string[]>> {
  const current = index[key] ?? []

  if (current.includes(id)) return index

  return withEntity(index, key, Object.freeze([...current, id]))
}

function immutableFieldChanged<T extends object>(
  current: T,
  next: T,
  fields: readonly (keyof T)[],
): keyof T | undefined {
  return fields.find(field => !stableEqual(current[field], next[field]))
}

const TERMINAL_MESSAGE_STATUSES: readonly Message['status'][] = [
  'complete',
  'failed',
  'cancelled',
]

export function reduceEvent(
  state: AiState,
  event: AnyDomainEvent,
): ReduceResult {
  switch (event.type) {
    case 'conversation.upserted':
      return applyConversation(state, event.payload.conversation)
    case 'message.created':
      return applyMessageCreated(state, event.payload.message)
    case 'message.part.delta':
      return applyMessagePartDelta(state, event.payload)
    case 'message.completed':
      return applyMessageCompleted(state, event.payload)
    case 'execution.started':
      return applyExecutionStarted(state, event.payload.execution)
    case 'execution.status.changed':
      return applyExecutionStatus(state, event.payload)
    case 'step.upserted':
      return applyStep(state, event.payload.step)
    case 'tool.upserted':
      return applyTool(state, event.payload.tool)
    case 'approval.requested':
      return applyApprovalRequested(state, event.payload.approval)
    case 'approval.resolved':
      return applyApprovalResolved(state, event.payload)
    case 'artifact.published':
      return applyArtifact(state, event.payload.artifact)
    case 'changeset.updated':
      return applyChangeSet(state, event.payload.changeset)
    case 'snapshot.available':
      // Snapshots are requested by the client; the event only advertises one.
      return unchanged(state)
    default:
      return fail('state-mismatch', 'unreachable event type')
  }
}

function applyConversation(state: AiState, next: Conversation): ReduceResult {
  const current = state.conversations.get(next.id)

  if (current && next.revision < current.revision) {
    return fail(
      'revision-mismatch',
      `conversation ${next.id} revision ${next.revision} is older than ${current.revision}`,
    )
  }

  if (current && next.revision === current.revision) {
    return unchanged(state)
  }

  if (current && current.projectId !== next.projectId) {
    return fail(
      'immutable-field',
      `conversation ${next.id} cannot move from project ${String(current.projectId)} to ${String(next.projectId)}`,
    )
  }

  // The visible branch must end on one of this conversation's own messages.
  if (next.selectedLeafMessageId !== undefined) {
    const leaf = state.messages.get(next.selectedLeafMessageId)

    if (!leaf) {
      return fail(
        'reference-missing',
        `conversation ${next.id} selects unknown message ${next.selectedLeafMessageId}`,
      )
    }

    if (leaf.conversationId !== next.id) {
      return fail(
        'reference-mismatch',
        `conversation ${next.id} cannot select message ${leaf.id} of conversation ${leaf.conversationId}`,
      )
    }
  }

  return {
    ok: true,
    state: {
      ...state,
      conversations: state.conversations.set(next.id, next),
    },
  }
}

function applyMessageCreated(state: AiState, message: Message): ReduceResult {
  const current = state.messages.get(message.id)

  if (current) {
    if (current.conversationId !== message.conversationId) {
      return fail(
        'immutable-field',
        `message ${message.id} already belongs to conversation ${current.conversationId}`,
      )
    }

    return unchanged(state)
  }

  if (!state.conversations.get(message.conversationId)) {
    return fail(
      'reference-missing',
      `message ${message.id} targets unknown conversation ${message.conversationId}`,
    )
  }

  if (message.parentMessageId !== undefined) {
    const parent = state.messages.get(message.parentMessageId)

    if (!parent) {
      return fail(
        'reference-missing',
        `message ${message.id} branches from unknown message ${message.parentMessageId}`,
      )
    }

    if (parent.conversationId !== message.conversationId) {
      return fail(
        'reference-mismatch',
        `message ${message.id} cannot branch from message ${parent.id} of conversation ${parent.conversationId}`,
      )
    }
  }

  return {
    ok: true,
    state: {
      ...state,
      messages: state.messages.set(message.id, message),
      conversationMessageIds: appendIndex(
        state.conversationMessageIds,
        message.conversationId,
        message.id,
      ),
    },
  }
}

function applyMessagePartDelta(
  state: AiState,
  payload: MessagePartDeltaPayload,
): ReduceResult {
  const message = state.messages.get(payload.messageId)

  if (!message) {
    return fail(
      'entity-missing',
      `message ${payload.messageId} is not in the store`,
    )
  }

  if (TERMINAL_MESSAGE_STATUSES.includes(message.status)) {
    return fail(
      'state-mismatch',
      `message ${payload.messageId} is ${message.status} and cannot accept deltas`,
    )
  }

  const partIndex = message.parts.findIndex(part => part.id === payload.partId)

  if (partIndex < 0) {
    return fail(
      'part-missing',
      `part ${payload.partId} is not on message ${payload.messageId}`,
    )
  }

  const part = message.parts[partIndex]

  if (part.kind !== 'text') {
    return fail(
      'part-kind-mismatch',
      `part ${payload.partId} is ${part.kind}, not text`,
    )
  }

  const hasAppend = payload.append !== undefined
  const hasReplace = payload.replace !== undefined

  if (hasAppend === hasReplace) {
    return fail(
      'invalid-delta',
      'delta must carry exactly one of append or replace',
    )
  }

  if (part.revision !== payload.baseRevision) {
    return fail(
      'revision-mismatch',
      `part ${payload.partId} is at revision ${part.revision}, delta base is ${payload.baseRevision}`,
    )
  }

  if (payload.nextRevision !== payload.baseRevision + 1) {
    return fail(
      'revision-mismatch',
      `part delta must advance one revision, got ${payload.baseRevision} -> ${payload.nextRevision}`,
    )
  }

  const nextText = hasReplace
    ? (payload.replace as string)
    : `${part.text}${payload.append as string}`
  const parts = message.parts.slice()

  parts[partIndex] = Object.freeze({
    ...part,
    text: nextText,
    revision: payload.nextRevision,
  })

  const nextMessage: Message = Object.freeze({
    ...message,
    parts: Object.freeze(parts) as ContentPart[],
    status: 'streaming',
    revision: message.revision + 1,
  })

  return {
    ok: true,
    state: {
      ...state,
      messages: state.messages.set(message.id, nextMessage),
    },
  }
}

function applyMessageCompleted(
  state: AiState,
  payload: MessageCompletedPayload,
): ReduceResult {
  const message = state.messages.get(payload.messageId)

  if (!message) {
    return fail(
      'entity-missing',
      `message ${payload.messageId} is not in the store`,
    )
  }

  if (!TERMINAL_MESSAGE_STATUSES.includes(payload.status)) {
    return fail(
      'invalid-terminal-status',
      `${payload.status} is not a terminal message status`,
    )
  }

  if (message.status === payload.status) {
    if (payload.revision <= message.revision) return unchanged(state)
  } else if (TERMINAL_MESSAGE_STATUSES.includes(message.status)) {
    // A finished answer never flips to another terminal outcome.
    return fail(
      'illegal-transition',
      `message ${payload.messageId} is already ${message.status}, cannot become ${payload.status}`,
    )
  }

  if (payload.revision <= message.revision) {
    return fail(
      'revision-mismatch',
      `message ${payload.messageId} is at revision ${message.revision}, completion is ${payload.revision}`,
    )
  }

  const nextMessage: Message = Object.freeze({
    ...message,
    status: payload.status,
    revision: payload.revision,
  })

  return {
    ok: true,
    state: {
      ...state,
      messages: state.messages.set(message.id, nextMessage),
    },
  }
}

function applyExecutionStarted(
  state: AiState,
  execution: Execution,
): ReduceResult {
  const current = state.executions.get(execution.id)

  if (current) {
    if (execution.revision <= current.revision) return unchanged(state)

    const changed = immutableFieldChanged(current, execution, [
      'kind',
      'conversationId',
      'workspaceId',
    ])

    if (changed) {
      return fail(
        'immutable-field',
        `execution ${execution.id} cannot change ${String(changed)}`,
      )
    }

    // Re-announcing an execution is not a back door around the state
    // machine: a completed run must not be revived by a later "started".
    if (
      execution.status !== current.status &&
      !canTransitionExecution(current.status, execution.status)
    ) {
      return fail(
        'illegal-transition',
        `execution ${execution.id} cannot move ${current.status} -> ${execution.status}`,
      )
    }
  }

  return {
    ok: true,
    state: {
      ...state,
      executions: state.executions.set(execution.id, execution),
    },
  }
}

function applyExecutionStatus(
  state: AiState,
  payload: ExecutionStatusChangedPayload,
): ReduceResult {
  const execution = state.executions.get(payload.id)

  if (!execution) {
    return fail('entity-missing', `execution ${payload.id} is not in the store`)
  }

  if (execution.status !== payload.from) {
    return fail(
      'state-mismatch',
      `execution ${payload.id} is ${execution.status}, event claims from ${payload.from}`,
    )
  }

  if (!canTransitionExecution(payload.from, payload.to)) {
    return fail(
      'illegal-transition',
      `execution ${payload.id} cannot move ${payload.from} -> ${payload.to}`,
    )
  }

  if (payload.revision <= execution.revision) {
    return fail(
      'revision-mismatch',
      `execution ${payload.id} is at revision ${execution.revision}, event carries ${payload.revision}`,
    )
  }

  const nextExecution: Execution = Object.freeze({
    ...execution,
    status: payload.to,
    revision: payload.revision,
  })

  return {
    ok: true,
    state: {
      ...state,
      executions: state.executions.set(payload.id, nextExecution),
    },
  }
}

function requireExecution(
  state: AiState,
  kind: string,
  id: string,
  executionId: string,
): ReduceResult | undefined {
  if (state.executions.get(executionId)) return undefined

  return fail(
    'reference-missing',
    `${kind} ${id} targets unknown execution ${executionId}`,
  )
}

function applyStep(state: AiState, step: ExecutionStep): ReduceResult {
  const missing = requireExecution(state, 'step', step.id, step.executionId)
  if (missing) return missing

  const current = state.steps.get(step.id)

  if (current) {
    if (stableEqual(current, step)) return unchanged(state)

    if (current.executionId !== step.executionId) {
      return fail(
        'immutable-field',
        `step ${step.id} cannot move to execution ${step.executionId}`,
      )
    }

    if (isStepTerminal(current.status) && step.status !== current.status) {
      return fail(
        'illegal-transition',
        `step ${step.id} is already ${current.status}, cannot become ${step.status}`,
      )
    }
  }

  if (step.parentStepId !== undefined) {
    const parent = state.steps.get(step.parentStepId)

    if (!parent) {
      return fail(
        'reference-missing',
        `step ${step.id} nests under unknown step ${step.parentStepId}`,
      )
    }

    if (parent.executionId !== step.executionId) {
      return fail(
        'reference-mismatch',
        `step ${step.id} cannot nest under step ${parent.id} of execution ${parent.executionId}`,
      )
    }
  }

  return {
    ok: true,
    state: {
      ...state,
      steps: state.steps.set(step.id, step),
      executionStepIds: appendIndex(
        state.executionStepIds,
        step.executionId,
        step.id,
      ),
    },
  }
}

function applyTool(state: AiState, tool: ToolInvocation): ReduceResult {
  const missing = requireExecution(state, 'tool', tool.id, tool.executionId)
  if (missing) return missing

  const current = state.toolInvocations.get(tool.id)

  if (current) {
    if (stableEqual(current, tool)) return unchanged(state)

    const changed = immutableFieldChanged(current, tool, [
      'executionId',
      'toolName',
    ])

    if (changed) {
      return fail(
        'immutable-field',
        `tool ${tool.id} cannot change ${String(changed)}`,
      )
    }

    if (isToolTerminal(current.status) && tool.status !== current.status) {
      return fail(
        'illegal-transition',
        `tool ${tool.id} is already ${current.status}, cannot become ${tool.status}`,
      )
    }
  }

  if (tool.stepId !== undefined) {
    const step = state.steps.get(tool.stepId)

    if (!step) {
      return fail(
        'reference-missing',
        `tool ${tool.id} targets unknown step ${tool.stepId}`,
      )
    }

    if (step.executionId !== tool.executionId) {
      return fail(
        'reference-mismatch',
        `tool ${tool.id} cannot attach to step ${step.id} of execution ${step.executionId}`,
      )
    }
  }

  return {
    ok: true,
    state: {
      ...state,
      toolInvocations: state.toolInvocations.set(tool.id, tool),
    },
  }
}

/**
 * What the user is asked to authorize. `risk` is part of it: a pending request
 * re-sent as `low` would change what the prompt shows after the user started
 * reading it (threat T3-5). A host that reassesses issues a new approval.
 */
const APPROVAL_IMMUTABLE_FIELDS: readonly (keyof ApprovalRequest)[] = [
  'executionId',
  'toolInvocationId',
  'operation',
  'scope',
  'risk',
]

function applyApprovalRequested(
  state: AiState,
  approval: ApprovalRequest,
): ReduceResult {
  const missing = requireExecution(
    state,
    'approval',
    approval.id,
    approval.executionId,
  )
  if (missing) return missing

  const current = state.approvals.get(approval.id)

  if (!current) {
    // Only `approval.resolved` may record a decision. A request that arrives
    // already approved would be a fabricated authorization.
    if (approval.status !== 'pending') {
      return fail(
        'illegal-transition',
        `approval ${approval.id} must be requested as pending, got ${approval.status}`,
      )
    }

    if (approval.toolInvocationId !== undefined) {
      const tool = state.toolInvocations.get(approval.toolInvocationId)

      if (!tool) {
        return fail(
          'reference-missing',
          `approval ${approval.id} targets unknown tool ${approval.toolInvocationId}`,
        )
      }

      if (tool.executionId !== approval.executionId) {
        return fail(
          'reference-mismatch',
          `approval ${approval.id} cannot gate tool ${tool.id} of execution ${tool.executionId}`,
        )
      }
    }

    return {
      ok: true,
      state: {
        ...state,
        approvals: state.approvals.set(approval.id, approval),
      },
    }
  }

  if (approval.revision < current.revision) {
    return fail(
      'revision-mismatch',
      `approval ${approval.id} revision ${approval.revision} is older than ${current.revision}`,
    )
  }

  if (approval.revision === current.revision) {
    return unchanged(state)
  }

  if (current.status !== 'pending' && current.status !== 'submitted') {
    return fail(
      'illegal-transition',
      `approval ${approval.id} is ${current.status} and cannot be requested again`,
    )
  }

  if (approval.status !== current.status) {
    return fail(
      'illegal-transition',
      `approval ${approval.id} status changes only through approval.resolved`,
    )
  }

  const changed = immutableFieldChanged(
    current,
    approval,
    APPROVAL_IMMUTABLE_FIELDS,
  )

  if (changed) {
    return fail(
      'immutable-field',
      `approval ${approval.id} cannot change ${String(changed)} after it was requested`,
    )
  }

  return {
    ok: true,
    state: {
      ...state,
      approvals: state.approvals.set(approval.id, approval),
    },
  }
}

function applyApprovalResolved(
  state: AiState,
  payload: ApprovalResolvedPayload,
): ReduceResult {
  const approval = state.approvals.get(payload.approvalId)

  if (!approval) {
    return fail(
      'entity-missing',
      `approval ${payload.approvalId} is not in the store`,
    )
  }

  if (approval.status === payload.decision) {
    return unchanged(state)
  }

  if (!canResolveApproval(approval.status, payload.decision)) {
    return fail(
      'illegal-transition',
      `approval ${payload.approvalId} cannot move ${approval.status} -> ${payload.decision}`,
    )
  }

  if (payload.revision <= approval.revision) {
    return fail(
      'revision-mismatch',
      `approval ${payload.approvalId} is at revision ${approval.revision}, resolution carries ${payload.revision}`,
    )
  }

  const nextApproval: ApprovalRequest = Object.freeze({
    ...approval,
    status: payload.decision,
    revision: payload.revision,
  })

  return {
    ok: true,
    state: {
      ...state,
      approvals: state.approvals.set(approval.id, nextApproval),
    },
  }
}

function applyArtifact(state: AiState, artifact: Artifact): ReduceResult {
  if (artifact.executionId !== undefined) {
    const missing = requireExecution(
      state,
      'artifact',
      artifact.id,
      artifact.executionId,
    )
    if (missing) return missing
  }

  const current = state.artifacts.get(artifact.id)

  if (current) {
    if (artifact.revision < current.revision) {
      return fail(
        'revision-mismatch',
        `artifact ${artifact.id} revision ${artifact.revision} is older than ${current.revision}`,
      )
    }

    if (artifact.revision === current.revision) return unchanged(state)

    if (current.executionId !== artifact.executionId) {
      return fail(
        'immutable-field',
        `artifact ${artifact.id} cannot move to execution ${String(artifact.executionId)}`,
      )
    }
  }

  return {
    ok: true,
    state: {
      ...state,
      artifacts: state.artifacts.set(artifact.id, artifact),
    },
  }
}

function applyChangeSet(state: AiState, changeSet: ChangeSet): ReduceResult {
  const missing = requireExecution(
    state,
    'changeset',
    changeSet.id,
    changeSet.executionId,
  )
  if (missing) return missing

  const current = state.changeSets.get(changeSet.id)

  if (current) {
    if (changeSet.revision < current.revision) {
      return fail(
        'revision-mismatch',
        `changeset ${changeSet.id} revision ${changeSet.revision} is older than ${current.revision}`,
      )
    }

    if (changeSet.revision === current.revision) return unchanged(state)

    const changed = immutableFieldChanged(current, changeSet, [
      'executionId',
      'workspaceId',
    ])

    if (changed) {
      return fail(
        'immutable-field',
        `changeset ${changeSet.id} cannot change ${String(changed)}`,
      )
    }

    if (!canTransitionChangeSet(current.status, changeSet.status)) {
      return fail(
        'illegal-transition',
        `changeset ${changeSet.id} cannot move ${current.status} -> ${changeSet.status}`,
      )
    }
  }

  return {
    ok: true,
    state: {
      ...state,
      changeSets: state.changeSets.set(changeSet.id, changeSet),
    },
  }
}
