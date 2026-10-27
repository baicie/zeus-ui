/**
 * Canonical normalized state (AI2-107).
 *
 * Entity collections are persistent `EntityMap`s keyed by id: a reducer
 * replaces exactly one entity, untouched entities keep their identity, and
 * the cost of an update does not grow with the collection. Ordered
 * indexes (`conversationMessageIds`, `executionStepIds`) are maintained by the
 * reducers in authoritative arrival order. `cursors` tracks the last applied
 * `seq` per stream for gap recovery.
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

import { EntityMap } from './entity-map'

export interface AiState {
  conversations: EntityMap<Conversation>
  messages: EntityMap<Message>
  conversationMessageIds: Readonly<Record<EntityId, readonly EntityId[]>>
  executions: EntityMap<Execution>
  /** Every step of an execution, in host order (not only the active ones). */
  executionStepIds: Readonly<Record<EntityId, readonly EntityId[]>>
  steps: EntityMap<ExecutionStep>
  toolInvocations: EntityMap<ToolInvocation>
  approvals: EntityMap<ApprovalRequest>
  artifacts: EntityMap<Artifact>
  changeSets: EntityMap<ChangeSet>
  cursors: Readonly<Record<string, number>>
}

export function createInitialState(): AiState {
  return {
    conversations: EntityMap.empty(),
    messages: EntityMap.empty(),
    conversationMessageIds: {},
    executions: EntityMap.empty(),
    executionStepIds: {},
    steps: EntityMap.empty(),
    toolInvocations: EntityMap.empty(),
    approvals: EntityMap.empty(),
    artifacts: EntityMap.empty(),
    changeSets: EntityMap.empty(),
    cursors: {},
  }
}

/** Entity collections stored as `EntityMap`s. */
export const ENTITY_COLLECTION_KEYS = [
  'conversations',
  'messages',
  'executions',
  'steps',
  'toolInvocations',
  'approvals',
  'artifacts',
  'changeSets',
] as const

/** Collection keys of {@link AiState}, used for structural snapshot checks. */
export const AI_STATE_KEYS: readonly (keyof AiState)[] = [
  'conversations',
  'messages',
  'conversationMessageIds',
  'executions',
  'executionStepIds',
  'steps',
  'toolInvocations',
  'approvals',
  'artifacts',
  'changeSets',
  'cursors',
]
