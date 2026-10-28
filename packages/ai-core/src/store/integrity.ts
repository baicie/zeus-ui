/**
 * Canonical state integrity (AI2-108).
 *
 * A snapshot replaces the whole state at once, so it must satisfy the same
 * invariants the reducers hold event by event: well-formed entities stored
 * under their own id, children whose parent exists in the same aggregate,
 * and ordered indexes that list every child exactly once. A snapshot that
 * fails here would otherwise hide messages from the timeline or let an entity
 * point into another conversation, which the event path already forbids.
 *
 * Approval and lifecycle *statuses* are not re-litigated: a snapshot is the
 * host's folded history, so a resolved approval may legitimately appear.
 */

import type { EntityId } from '../domain/types'
import type { EntityMap } from './entity-map'
import type { AiState } from './state'

import {
  CANONICAL_ENTITY_COLLECTIONS,
  validateCanonicalEntity,
} from '../protocol/validation'

function checkIndex<TChild>(
  name: 'conversationMessageIds' | 'executionStepIds',
  index: Readonly<Record<EntityId, readonly EntityId[]>>,
  owners: EntityMap<unknown>,
  children: EntityMap<TChild>,
  ownerOf: (child: TChild) => EntityId,
): string | null {
  const listed = new Set<EntityId>()

  for (const ownerId of Object.keys(index)) {
    if (!owners.has(ownerId)) return `${name}.${ownerId} has no owner entity`

    for (const childId of index[ownerId]) {
      const child = children.get(childId)

      if (typeof childId !== 'string' || !child) {
        return `${name}.${ownerId} lists unknown entity ${String(childId)}`
      }
      if (ownerOf(child) !== ownerId) {
        return `${name}.${ownerId} lists ${childId}, which belongs to ${ownerOf(child)}`
      }
      if (listed.has(childId)) return `${name} lists ${childId} twice`

      listed.add(childId)
    }
  }

  for (const childId of children.keys()) {
    if (!listed.has(childId)) return `${name} does not list ${childId}`
  }

  return null
}

/** First broken invariant in a candidate state, or null when it is sound. */
export function findStateIntegrityIssue(state: AiState): string | null {
  for (const collection of CANONICAL_ENTITY_COLLECTIONS) {
    const map = state[collection] as EntityMap<unknown>

    for (const [key, value] of map.entries()) {
      const field = `state.${collection}.${key}`
      const issue = validateCanonicalEntity(collection, value, field)

      if (issue) return issue
      if ((value as { id: string }).id !== key) {
        return `${field} is stored under the wrong id`
      }
    }
  }

  const executionOf = (kind: string, id: string, executionId: string) =>
    state.executions.get(executionId)
      ? null
      : `${kind} ${id} targets unknown execution ${executionId}`

  for (const conversation of state.conversations.values()) {
    const leafId = conversation.selectedLeafMessageId

    if (
      leafId !== undefined &&
      state.messages.get(leafId)?.conversationId !== conversation.id
    ) {
      return `conversation ${conversation.id} selects message ${leafId} outside it`
    }
  }

  for (const message of state.messages.values()) {
    if (!state.conversations.get(message.conversationId)) {
      return `message ${message.id} targets unknown conversation ${message.conversationId}`
    }

    const parentId = message.parentMessageId

    if (
      parentId !== undefined &&
      state.messages.get(parentId)?.conversationId !== message.conversationId
    ) {
      return `message ${message.id} branches from message ${parentId} outside its conversation`
    }
  }

  for (const step of state.steps.values()) {
    const missing = executionOf('step', step.id, step.executionId)
    if (missing) return missing

    const parentId = step.parentStepId

    if (
      parentId !== undefined &&
      state.steps.get(parentId)?.executionId !== step.executionId
    ) {
      return `step ${step.id} nests under step ${parentId} outside its execution`
    }
  }

  for (const tool of state.toolInvocations.values()) {
    const missing = executionOf('tool', tool.id, tool.executionId)
    if (missing) return missing

    if (
      tool.stepId !== undefined &&
      state.steps.get(tool.stepId)?.executionId !== tool.executionId
    ) {
      return `tool ${tool.id} attaches to step ${tool.stepId} outside its execution`
    }
  }

  for (const approval of state.approvals.values()) {
    const missing = executionOf('approval', approval.id, approval.executionId)
    if (missing) return missing

    const toolId = approval.toolInvocationId

    if (
      toolId !== undefined &&
      state.toolInvocations.get(toolId)?.executionId !== approval.executionId
    ) {
      return `approval ${approval.id} gates tool ${toolId} outside its execution`
    }
  }

  for (const artifact of state.artifacts.values()) {
    if (artifact.executionId === undefined) continue

    const missing = executionOf('artifact', artifact.id, artifact.executionId)
    if (missing) return missing
  }

  for (const changeSet of state.changeSets.values()) {
    const missing = executionOf(
      'changeset',
      changeSet.id,
      changeSet.executionId,
    )
    if (missing) return missing
  }

  return (
    checkIndex(
      'conversationMessageIds',
      state.conversationMessageIds,
      state.conversations,
      state.messages,
      message => message.conversationId,
    ) ??
    checkIndex(
      'executionStepIds',
      state.executionStepIds,
      state.executions,
      state.steps,
      step => step.executionId,
    )
  )
}
