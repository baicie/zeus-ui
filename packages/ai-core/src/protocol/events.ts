/**
 * Domain event protocol (AI2-106).
 *
 * The event names and payloads mirror the V2 architecture: a host issues
 * authoritative events on a recoverable stream (`seq` starts at 1 and is
 * server-assigned), and clients only apply them. Nothing here derives order
 * from arrival time.
 */

import type {
  ApprovalRequest,
  Artifact,
  ChangeSet,
  Conversation,
  EntityId,
  Execution,
  ExecutionStatus,
  ExecutionStep,
  Message,
  MessageStatus,
  Timestamp,
  ToolInvocation,
} from '../domain/types'

export const DOMAIN_EVENT_SCHEMA_VERSION = 2

export const DOMAIN_EVENT_TYPES = [
  'conversation.upserted',
  'message.created',
  'message.part.delta',
  'message.completed',
  'execution.started',
  'execution.status.changed',
  'step.upserted',
  'tool.upserted',
  'approval.requested',
  'approval.resolved',
  'artifact.published',
  'changeset.updated',
  'snapshot.available',
] as const

export type DomainEventType = (typeof DOMAIN_EVENT_TYPES)[number]

export const DOMAIN_ENTITY_KINDS = [
  'conversation',
  'message',
  'execution',
  'step',
  'tool',
  'approval',
  'artifact',
  'changeset',
  'snapshot',
] as const

export type DomainEntityKind = (typeof DOMAIN_ENTITY_KINDS)[number]

export interface EventEntityRef {
  kind: DomainEntityKind
  id: EntityId
}

export interface DomainEvent<TType extends DomainEventType, TPayload> {
  schemaVersion: typeof DOMAIN_EVENT_SCHEMA_VERSION
  eventId: string
  streamId: string
  seq: number
  entity: EventEntityRef
  type: TType
  occurredAt: Timestamp
  payload: TPayload
}

export interface ConversationUpsertedPayload {
  conversation: Conversation
}

export interface MessageCreatedPayload {
  message: Message
}

export interface MessagePartDeltaPayload {
  messageId: EntityId
  partId: string
  baseRevision: number
  nextRevision: number
  /** Text appended at the end of the current part text. */
  append?: string
  /** Full text replacement, only valid when baseRevision matches. */
  replace?: string
}

export interface MessageCompletedPayload {
  messageId: EntityId
  revision: number
  status: MessageStatus
}

export interface ExecutionStartedPayload {
  execution: Execution
}

export interface ExecutionStatusChangedPayload {
  id: EntityId
  from: ExecutionStatus
  to: ExecutionStatus
  revision: number
}

export interface StepUpsertedPayload {
  step: ExecutionStep
}

export interface ToolUpsertedPayload {
  tool: ToolInvocation
}

export interface ApprovalRequestedPayload {
  approval: ApprovalRequest
}

export interface ApprovalResolvedPayload {
  approvalId: EntityId
  decision: 'approved' | 'rejected' | 'expired' | 'revoked'
  revision: number
}

export interface ArtifactPublishedPayload {
  artifact: Artifact
}

export interface ChangeSetUpdatedPayload {
  changeset: ChangeSet
}

export interface SnapshotAvailablePayload {
  uri: string
  version: number
  checksum?: string
}

export type AnyDomainEvent =
  | DomainEvent<'conversation.upserted', ConversationUpsertedPayload>
  | DomainEvent<'message.created', MessageCreatedPayload>
  | DomainEvent<'message.part.delta', MessagePartDeltaPayload>
  | DomainEvent<'message.completed', MessageCompletedPayload>
  | DomainEvent<'execution.started', ExecutionStartedPayload>
  | DomainEvent<'execution.status.changed', ExecutionStatusChangedPayload>
  | DomainEvent<'step.upserted', StepUpsertedPayload>
  | DomainEvent<'tool.upserted', ToolUpsertedPayload>
  | DomainEvent<'approval.requested', ApprovalRequestedPayload>
  | DomainEvent<'approval.resolved', ApprovalResolvedPayload>
  | DomainEvent<'artifact.published', ArtifactPublishedPayload>
  | DomainEvent<'changeset.updated', ChangeSetUpdatedPayload>
  | DomainEvent<'snapshot.available', SnapshotAvailablePayload>

/** Which entity kind an event must claim at the envelope level. */
export const ENTITY_KIND_BY_EVENT_TYPE: Readonly<
  Record<DomainEventType, DomainEntityKind>
> = {
  'conversation.upserted': 'conversation',
  'message.created': 'message',
  'message.part.delta': 'message',
  'message.completed': 'message',
  'execution.started': 'execution',
  'execution.status.changed': 'execution',
  'step.upserted': 'step',
  'tool.upserted': 'tool',
  'approval.requested': 'approval',
  'approval.resolved': 'approval',
  'artifact.published': 'artifact',
  'changeset.updated': 'changeset',
  'snapshot.available': 'snapshot',
}

export function isDomainEventType(value: unknown): value is DomainEventType {
  return (
    typeof value === 'string' &&
    (DOMAIN_EVENT_TYPES as readonly string[]).includes(value)
  )
}

export function isDomainEntityKind(value: unknown): value is DomainEntityKind {
  return (
    typeof value === 'string' &&
    (DOMAIN_ENTITY_KINDS as readonly string[]).includes(value)
  )
}
