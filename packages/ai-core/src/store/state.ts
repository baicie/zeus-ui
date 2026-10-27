/**
 * Canonical normalized state (AI2-107).
 *
 * Every collection is a plain record keyed by entity id, so a reducer replaces
 * exactly one entity and leaves unrelated references untouched. `cursors`
 * tracks the last applied `seq` per stream for gap recovery.
 */

import type {
  ApprovalRequest,
  Artifact,
  ChangeSet,
  Conversation,
  EntityId,
  Execution,
  ExecutionStep,
  Message,
  ToolInvocation,
} from '../domain/types'

export interface AiState {
  conversations: Readonly<Record<EntityId, Conversation>>
  messages: Readonly<Record<EntityId, Message>>
  conversationMessageIds: Readonly<Record<EntityId, readonly EntityId[]>>
  executions: Readonly<Record<EntityId, Execution>>
  steps: Readonly<Record<EntityId, ExecutionStep>>
  toolInvocations: Readonly<Record<EntityId, ToolInvocation>>
  approvals: Readonly<Record<EntityId, ApprovalRequest>>
  artifacts: Readonly<Record<EntityId, Artifact>>
  changeSets: Readonly<Record<EntityId, ChangeSet>>
  cursors: Readonly<Record<string, number>>
}

export function createInitialState(): AiState {
  return {
    conversations: {},
    messages: {},
    conversationMessageIds: {},
    executions: {},
    steps: {},
    toolInvocations: {},
    approvals: {},
    artifacts: {},
    changeSets: {},
    cursors: {},
  }
}
