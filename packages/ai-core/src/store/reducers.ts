/**
 * Canonical reducers (AI2-107).
 *
 * Every handler returns a new state object that replaces only the touched
 * collection and entity; untouched entities keep their object identity so
 * fine-grained selectors stay quiet. Invalid revisions and illegal state
 * transitions are rejected with a stable code instead of being applied.
 */

import type {
  ApprovalRequest,
  Artifact,
  ChangeSet,
  Conversation,
  Execution,
  ExecutionStep,
  Message,
  ToolInvocation,
} from '../domain/types'
import type {
  AnyDomainEvent,
  ApprovalResolvedPayload,
  MessagePartDeltaPayload,
} from '../protocol/events'

import type { AiState } from './state'
import { canResolveApproval } from '../domain/approval'
import { canTransitionExecution } from '../domain/execution'

export type ReduceErrorCode =
  | 'entity-missing'
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

function withEntity<T>(
  record: Readonly<Record<string, T>>,
  id: string,
  entity: T,
): Readonly<Record<string, T>> {
  return { ...record, [id]: entity }
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
      return { ok: true, state }
    default:
      return fail('state-mismatch', 'unreachable event type')
  }
}

function applyConversation(state: AiState, next: Conversation): ReduceResult {
  const current = state.conversations[next.id]

  if (current && next.revision < current.revision) {
    return fail(
      'revision-mismatch',
      `conversation ${next.id} revision ${next.revision} is older than ${current.revision}`,
    )
  }

  if (current && next.revision === current.revision) {
    return { ok: true, state }
  }

  return {
    ok: true,
    state: {
      ...state,
      conversations: withEntity(state.conversations, next.id, next),
    },
  }
}

function applyMessageCreated(state: AiState, message: Message): ReduceResult {
  if (state.messages[message.id]) {
    return { ok: true, state }
  }

  const existingIndex =
    state.conversationMessageIds[message.conversationId] ?? []

  if (existingIndex.includes(message.id)) {
    return { ok: true, state }
  }

  return {
    ok: true,
    state: {
      ...state,
      messages: withEntity(state.messages, message.id, message),
      conversationMessageIds: withEntity(
        state.conversationMessageIds,
        message.conversationId,
        [...existingIndex, message.id],
      ),
    },
  }
}

function applyMessagePartDelta(
  state: AiState,
  payload: MessagePartDeltaPayload,
): ReduceResult {
  const message = state.messages[payload.messageId]

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

  if (payload.append === undefined && payload.replace === undefined) {
    return fail('invalid-delta', 'delta must carry append or replace')
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

  const nextText = payload.replace ?? `${part.text}${payload.append ?? ''}`
  const parts = message.parts.slice()

  parts[partIndex] = { ...part, text: nextText, revision: payload.nextRevision }

  const nextMessage: Message = {
    ...message,
    parts,
    status: 'streaming',
    revision: message.revision + 1,
  }

  return {
    ok: true,
    state: {
      ...state,
      messages: withEntity(state.messages, message.id, nextMessage),
    },
  }
}

function applyMessageCompleted(
  state: AiState,
  payload: Extract<AnyDomainEvent, { type: 'message.completed' }>['payload'],
): ReduceResult {
  const message = state.messages[payload.messageId]

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

  if (
    message.status === payload.status &&
    message.revision >= payload.revision
  ) {
    return { ok: true, state }
  }

  if (
    payload.revision <= message.revision &&
    message.status !== payload.status
  ) {
    return fail(
      'revision-mismatch',
      `message ${payload.messageId} is at revision ${message.revision}, completion is ${payload.revision}`,
    )
  }

  const nextMessage: Message = {
    ...message,
    status: payload.status,
    revision: payload.revision,
  }

  return {
    ok: true,
    state: {
      ...state,
      messages: withEntity(state.messages, message.id, nextMessage),
    },
  }
}

function applyExecutionStarted(
  state: AiState,
  execution: Execution,
): ReduceResult {
  const current = state.executions[execution.id]

  if (current && execution.revision <= current.revision) {
    return { ok: true, state }
  }

  return {
    ok: true,
    state: {
      ...state,
      executions: withEntity(state.executions, execution.id, execution),
    },
  }
}

function applyExecutionStatus(
  state: AiState,
  payload: Extract<
    AnyDomainEvent,
    { type: 'execution.status.changed' }
  >['payload'],
): ReduceResult {
  const execution = state.executions[payload.id]

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

  const nextExecution: Execution = {
    ...execution,
    status: payload.to,
    revision: payload.revision,
  }

  return {
    ok: true,
    state: {
      ...state,
      executions: withEntity(state.executions, payload.id, nextExecution),
    },
  }
}

function applyStep(state: AiState, step: ExecutionStep): ReduceResult {
  return {
    ok: true,
    state: { ...state, steps: withEntity(state.steps, step.id, step) },
  }
}

function applyTool(state: AiState, tool: ToolInvocation): ReduceResult {
  return {
    ok: true,
    state: {
      ...state,
      toolInvocations: withEntity(state.toolInvocations, tool.id, tool),
    },
  }
}

function applyApprovalRequested(
  state: AiState,
  approval: ApprovalRequest,
): ReduceResult {
  const current = state.approvals[approval.id]

  if (current && approval.revision < current.revision) {
    return fail(
      'revision-mismatch',
      `approval ${approval.id} revision ${approval.revision} is older than ${current.revision}`,
    )
  }

  if (current && approval.revision === current.revision) {
    return { ok: true, state }
  }

  return {
    ok: true,
    state: {
      ...state,
      approvals: withEntity(state.approvals, approval.id, approval),
    },
  }
}

function applyApprovalResolved(
  state: AiState,
  payload: ApprovalResolvedPayload,
): ReduceResult {
  const approval = state.approvals[payload.approvalId]

  if (!approval) {
    return fail(
      'entity-missing',
      `approval ${payload.approvalId} is not in the store`,
    )
  }

  if (approval.status === payload.decision) {
    return { ok: true, state }
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

  const nextApproval: ApprovalRequest = {
    ...approval,
    status: payload.decision,
    revision: payload.revision,
  }

  return {
    ok: true,
    state: {
      ...state,
      approvals: withEntity(state.approvals, approval.id, nextApproval),
    },
  }
}

function applyArtifact(state: AiState, artifact: Artifact): ReduceResult {
  const current = state.artifacts[artifact.id]

  if (current && artifact.revision < current.revision) {
    return fail(
      'revision-mismatch',
      `artifact ${artifact.id} revision ${artifact.revision} is older than ${current.revision}`,
    )
  }

  return {
    ok: true,
    state: {
      ...state,
      artifacts: withEntity(state.artifacts, artifact.id, artifact),
    },
  }
}

function applyChangeSet(state: AiState, changeSet: ChangeSet): ReduceResult {
  const current = state.changeSets[changeSet.id]

  if (current && changeSet.revision < current.revision) {
    return fail(
      'revision-mismatch',
      `changeset ${changeSet.id} revision ${changeSet.revision} is older than ${current.revision}`,
    )
  }

  return {
    ok: true,
    state: {
      ...state,
      changeSets: withEntity(state.changeSets, changeSet.id, changeSet),
    },
  }
}
