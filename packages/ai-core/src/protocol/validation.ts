/**
 * Event envelope validation (AI2-106).
 *
 * Unknown schema versions and unknown event types are quarantined, not thrown:
 * a client must keep the stream cursor honest while it reports the problem.
 * Structural damage inside a known event is a hard rejection.
 *
 * Validation is structural, not just "the key exists": a reducer must never
 * see `{ message: null }` or a part without an id. The envelope `entity.id`
 * is bound to the payload entity, so an event addressed to one entity cannot
 * rewrite another (threat T5-2), and change-set paths must be plain relative
 * paths (threat T2-3).
 */

import type { AnyDomainEvent, DomainEventType } from './events'

import { isRecord } from '../internal/stable'
import {
  DOMAIN_EVENT_SCHEMA_VERSION,
  ENTITY_KIND_BY_EVENT_TYPE,
  isDomainEntityKind,
  isDomainEventType,
} from './events'

export type EventValidationCode =
  | 'not-an-object'
  | 'unsupported-schema-version'
  | 'unknown-event-type'
  | 'unknown-entity-kind'
  | 'entity-kind-mismatch'
  | 'entity-id-mismatch'
  | 'invalid-envelope'
  | 'invalid-payload'

export type EventValidationResult =
  | { ok: true; event: AnyDomainEvent }
  | {
      ok: false
      code: EventValidationCode
      message: string
      quarantined: boolean
      field?: string
    }

const REQUIRED_PAYLOAD_FIELDS: Readonly<
  Record<DomainEventType, readonly string[]>
> = {
  'conversation.upserted': ['conversation'],
  'message.created': ['message'],
  'message.part.delta': ['messageId', 'partId', 'baseRevision', 'nextRevision'],
  'message.completed': ['messageId', 'revision', 'status'],
  'execution.started': ['execution'],
  'execution.status.changed': ['id', 'from', 'to', 'revision'],
  'step.upserted': ['step'],
  'tool.upserted': ['tool'],
  'approval.requested': ['approval'],
  'approval.resolved': ['approvalId', 'decision', 'revision'],
  'artifact.published': ['artifact'],
  'changeset.updated': ['changeset'],
  'snapshot.available': ['uri', 'version'],
}

function reject(
  code: EventValidationCode,
  message: string,
  quarantined: boolean,
  field?: string,
): EventValidationResult {
  return { ok: false, code, message, quarantined, field }
}

// ---------------------------------------------------------------------------
// Payload shape validation
// ---------------------------------------------------------------------------

interface PayloadIssue {
  field: string
  message: string
}

type Check = (value: unknown, field: string) => PayloadIssue | null

const MESSAGE_AUTHORS = ['user', 'assistant', 'system', 'tool'] as const
const MESSAGE_STATUSES = [
  'pending',
  'streaming',
  'complete',
  'failed',
  'cancelled',
] as const
const EXECUTION_KINDS = ['generation', 'agent'] as const
const EXECUTION_STATUSES = [
  'queued',
  'running',
  'awaiting-approval',
  'paused',
  'completed',
  'failed',
  'cancelled',
] as const
const STEP_KINDS = [
  'plan',
  'tool',
  'reasoning-summary',
  'test',
  'output',
  'custom',
] as const
const STEP_STATUSES = [
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled',
] as const
const TOOL_STATUSES = [
  'requested',
  'running',
  'succeeded',
  'failed',
  'cancelled',
] as const
const APPROVAL_STATUSES = [
  'pending',
  'submitted',
  'approved',
  'rejected',
  'expired',
  'revoked',
] as const
const APPROVAL_DECISIONS = [
  'approved',
  'rejected',
  'expired',
  'revoked',
] as const
const APPROVAL_SCOPES = ['once', 'session', 'workspace'] as const
const APPROVAL_RISKS = ['low', 'medium', 'high'] as const
const ARTIFACT_KINDS = [
  'document',
  'code',
  'table',
  'chart',
  'image',
  'file',
  'custom',
] as const
const CHANGESET_STATUSES = [
  'draft',
  'ready',
  'applying',
  'applied',
  'rejected',
  'conflicted',
] as const
const CHANGED_FILE_STATUSES = [
  'added',
  'modified',
  'deleted',
  'renamed',
] as const
const TEXT_FORMATS = ['plain', 'markdown'] as const

function issue(field: string, message: string): PayloadIssue {
  return { field, message }
}

const id: Check = (value, field) =>
  typeof value === 'string' && value.length > 0
    ? null
    : issue(field, 'must be a non-empty string')

const text: Check = (value, field) =>
  typeof value === 'string' ? null : issue(field, 'must be a string')

const revision: Check = (value, field) =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? null
    : issue(field, 'must be a non-negative integer')

function oneOf(values: readonly string[]): Check {
  return (value, field) =>
    typeof value === 'string' && values.includes(value)
      ? null
      : issue(field, `must be one of ${values.join(', ')}`)
}

function optional(check: Check): Check {
  return (value, field) => (value === undefined ? null : check(value, field))
}

const safePath: Check = (value, field) =>
  typeof value === 'string' && isSafeRelativePath(value)
    ? null
    : issue(
        field,
        'must be a relative path without "..", "~" or control characters',
      )

function shape(fields: Readonly<Record<string, Check>>): Check {
  return (value, field) => {
    if (!isRecord(value)) return issue(field, 'must be an object')

    for (const key of Object.keys(fields)) {
      const result = fields[key](value[key], `${field}.${key}`)
      if (result) return result
    }

    return null
  }
}

function arrayOf(check: Check): Check {
  return (value, field) => {
    if (!Array.isArray(value)) return issue(field, 'must be an array')

    for (let index = 0; index < value.length; index += 1) {
      const result = check(value[index], `${field}[${index}]`)
      if (result) return result
    }

    return null
  }
}

// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/

/**
 * A change-set path is display data and a host-side apply target. It must be
 * relative to the workspace root and must not climb out of it. The host still
 * re-validates against the real filesystem; this only keeps obviously hostile
 * paths out of canonical state (threat T2-3).
 */
export function isSafeRelativePath(path: string): boolean {
  if (path.length === 0 || path.length > 4096) return false
  if (CONTROL_CHARACTERS.test(path)) return false
  if (/^[/\\~]/.test(path)) return false
  if (/^[a-z]:/i.test(path)) return false

  return path.split(/[/\\]/).every(segment => segment !== '..')
}

const assetRef = shape({
  id,
  mimeType: id,
  size: optional(revision),
  uri: optional(text),
  checksum: optional(text),
})

const contentPart: Check = (value, field) => {
  const base = shape({ id, kind: id })(value, field)
  if (base) return base

  const part = value as Record<string, unknown>

  switch (part.kind) {
    case 'text':
      return shape({ revision, text, format: oneOf(TEXT_FORMATS) })(
        value,
        field,
      )
    case 'image':
      return shape({ asset: assetRef, alt: optional(text) })(value, field)
    case 'file':
      return shape({ asset: assetRef, name: text })(value, field)
    case 'reference':
      return shape({ sourceId: id, label: optional(text) })(value, field)
    case 'artifact-ref':
      return shape({ artifactId: id })(value, field)
    case 'structured':
      return shape({ schema: id })(value, field)
    default:
      return issue(
        `${field}.kind`,
        `unknown content part kind ${String(part.kind)}`,
      )
  }
}

const messageParts: Check = (value, field) => {
  const result = arrayOf(contentPart)(value, field)
  if (result) return result

  const seen = new Set<string>()

  for (const part of value as Array<{ id: string }>) {
    if (seen.has(part.id)) return issue(field, `repeats part id ${part.id}`)
    seen.add(part.id)
  }

  return null
}

const conversation = shape({
  id,
  projectId: optional(id),
  title: text,
  selectedLeafMessageId: optional(id),
  revision,
})

const message = shape({
  id,
  conversationId: id,
  parentMessageId: optional(id),
  author: oneOf(MESSAGE_AUTHORS),
  parts: messageParts,
  executionId: optional(id),
  status: oneOf(MESSAGE_STATUSES),
  revision,
  createdAt: text,
})

const execution = shape({
  id,
  kind: oneOf(EXECUTION_KINDS),
  conversationId: optional(id),
  workspaceId: optional(id),
  status: oneOf(EXECUTION_STATUSES),
  createdAt: text,
  revision,
  activeStepIds: arrayOf(id),
  outcome: optional(
    shape({ summary: optional(text), artifactIds: optional(arrayOf(id)) }),
  ),
})

const step = shape({
  id,
  executionId: id,
  parentStepId: optional(id),
  kind: oneOf(STEP_KINDS),
  status: oneOf(STEP_STATUSES),
  label: text,
  startedAt: optional(text),
  completedAt: optional(text),
  toolInvocationId: optional(id),
})

const tool = shape({
  id,
  executionId: id,
  stepId: optional(id),
  toolName: id,
  summary: text,
  resultAssetId: optional(id),
  status: oneOf(TOOL_STATUSES),
})

const approval = shape({
  id,
  executionId: id,
  toolInvocationId: optional(id),
  title: text,
  summary: text,
  operation: shape({ kind: id, target: id }),
  scope: oneOf(APPROVAL_SCOPES),
  risk: oneOf(APPROVAL_RISKS),
  expiresAt: optional(text),
  status: oneOf(APPROVAL_STATUSES),
  revision,
})

const artifact = shape({
  id,
  executionId: optional(id),
  kind: oneOf(ARTIFACT_KINDS),
  title: text,
  asset: assetRef,
  rendererHint: optional(text),
  revision,
})

const changedFile: Check = (value, field) => {
  const result = shape({
    path: safePath,
    status: oneOf(CHANGED_FILE_STATUSES),
    oldPath: optional(safePath),
    diffAsset: optional(assetRef),
    stats: optional(shape({ additions: revision, deletions: revision })),
  })(value, field)

  if (result) return result

  const file = value as Record<string, unknown>

  if (file.status === 'renamed' && file.oldPath === undefined) {
    return issue(`${field}.oldPath`, 'is required for renamed files')
  }

  return null
}

const changeset = shape({
  id,
  executionId: id,
  workspaceId: id,
  baseRevision: id,
  files: arrayOf(changedFile),
  status: oneOf(CHANGESET_STATUSES),
  revision,
})

/** Canonical entity collections whose members share the event payload shape. */
export type CanonicalEntityCollection =
  | 'conversations'
  | 'messages'
  | 'executions'
  | 'steps'
  | 'toolInvocations'
  | 'approvals'
  | 'artifacts'
  | 'changeSets'

const ENTITY_CHECKS: Readonly<Record<CanonicalEntityCollection, Check>> = {
  conversations: conversation,
  messages: message,
  executions: execution,
  steps: step,
  toolInvocations: tool,
  approvals: approval,
  artifacts: artifact,
  changeSets: changeset,
}

export const CANONICAL_ENTITY_COLLECTIONS = Object.keys(
  ENTITY_CHECKS,
) as readonly CanonicalEntityCollection[]

/**
 * Structural check for one entity outside an event (snapshot restore). Same
 * rules as the event payloads, so a snapshot cannot smuggle in an entity an
 * event could never carry. Returns a readable issue, or null when valid.
 */
export function validateCanonicalEntity(
  collection: CanonicalEntityCollection,
  value: unknown,
  field: string,
): string | null {
  const result = ENTITY_CHECKS[collection](value, field)

  return result ? `${result.field} ${result.message}` : null
}

function payloadOf(fields: Readonly<Record<string, Check>>) {
  return (payload: Record<string, unknown>): PayloadIssue | null => {
    for (const key of Object.keys(fields)) {
      const result = fields[key](payload[key], key)
      if (result) return result
    }

    return null
  }
}

const PAYLOAD_VALIDATORS: Readonly<
  Record<
    DomainEventType,
    (payload: Record<string, unknown>) => PayloadIssue | null
  >
> = {
  'conversation.upserted': payloadOf({ conversation }),
  'message.created': payloadOf({ message }),
  'message.part.delta': payload => {
    const result = payloadOf({
      messageId: id,
      partId: id,
      baseRevision: revision,
      nextRevision: revision,
      append: optional(text),
      replace: optional(text),
    })(payload)

    if (result) return result

    if ((payload.append === undefined) === (payload.replace === undefined)) {
      return issue('append', 'exactly one of append or replace is required')
    }

    return null
  },
  'message.completed': payloadOf({
    messageId: id,
    revision,
    status: oneOf(MESSAGE_STATUSES),
  }),
  'execution.started': payloadOf({ execution }),
  'execution.status.changed': payloadOf({
    id,
    from: oneOf(EXECUTION_STATUSES),
    to: oneOf(EXECUTION_STATUSES),
    revision,
  }),
  'step.upserted': payloadOf({ step }),
  'tool.upserted': payloadOf({ tool }),
  'approval.requested': payloadOf({ approval }),
  'approval.resolved': payloadOf({
    approvalId: id,
    decision: oneOf(APPROVAL_DECISIONS),
    revision,
  }),
  'artifact.published': payloadOf({ artifact }),
  'changeset.updated': payloadOf({ changeset }),
  'snapshot.available': payloadOf({
    uri: id,
    version: revision,
    checksum: optional(text),
  }),
}

/** Which payload field names the entity the envelope claims to target. */
const PAYLOAD_ENTITY_ID: Readonly<
  Partial<
    Record<DomainEventType, (payload: Record<string, unknown>) => unknown>
  >
> = {
  'conversation.upserted': payload =>
    (payload.conversation as Record<string, unknown>).id,
  'message.created': payload => (payload.message as Record<string, unknown>).id,
  'message.part.delta': payload => payload.messageId,
  'message.completed': payload => payload.messageId,
  'execution.started': payload =>
    (payload.execution as Record<string, unknown>).id,
  'execution.status.changed': payload => payload.id,
  'step.upserted': payload => (payload.step as Record<string, unknown>).id,
  'tool.upserted': payload => (payload.tool as Record<string, unknown>).id,
  'approval.requested': payload =>
    (payload.approval as Record<string, unknown>).id,
  'approval.resolved': payload => payload.approvalId,
  'artifact.published': payload =>
    (payload.artifact as Record<string, unknown>).id,
  'changeset.updated': payload =>
    (payload.changeset as Record<string, unknown>).id,
}

export function validateDomainEvent(input: unknown): EventValidationResult {
  if (!isRecord(input)) {
    return reject('not-an-object', 'event must be an object', false)
  }

  if (input.schemaVersion !== DOMAIN_EVENT_SCHEMA_VERSION) {
    return reject(
      'unsupported-schema-version',
      `unsupported schemaVersion ${String(input.schemaVersion)}; expected ${DOMAIN_EVENT_SCHEMA_VERSION}`,
      true,
      'schemaVersion',
    )
  }

  if (!isDomainEventType(input.type)) {
    return reject(
      'unknown-event-type',
      `unknown event type ${String(input.type)}`,
      true,
      'type',
    )
  }

  const type = input.type

  if (typeof input.eventId !== 'string' || input.eventId.length === 0) {
    return reject('invalid-envelope', 'eventId is required', false, 'eventId')
  }

  if (typeof input.streamId !== 'string' || input.streamId.length === 0) {
    return reject('invalid-envelope', 'streamId is required', false, 'streamId')
  }

  if (
    typeof input.seq !== 'number' ||
    !Number.isInteger(input.seq) ||
    input.seq < 1
  ) {
    return reject(
      'invalid-envelope',
      'seq must be a positive integer',
      false,
      'seq',
    )
  }

  if (typeof input.occurredAt !== 'string' || input.occurredAt.length === 0) {
    return reject(
      'invalid-envelope',
      'occurredAt is required',
      false,
      'occurredAt',
    )
  }

  if (!isRecord(input.entity)) {
    return reject('invalid-envelope', 'entity is required', false, 'entity')
  }

  if (!isDomainEntityKind(input.entity.kind)) {
    return reject(
      'unknown-entity-kind',
      `unknown entity kind ${String(input.entity.kind)}`,
      true,
      'entity.kind',
    )
  }

  if (typeof input.entity.id !== 'string' || input.entity.id.length === 0) {
    return reject(
      'invalid-envelope',
      'entity.id is required',
      false,
      'entity.id',
    )
  }

  if (input.entity.kind !== ENTITY_KIND_BY_EVENT_TYPE[type]) {
    return reject(
      'entity-kind-mismatch',
      `${type} must target ${ENTITY_KIND_BY_EVENT_TYPE[type]} but targeted ${input.entity.kind}`,
      false,
      'entity.kind',
    )
  }

  if (!isRecord(input.payload)) {
    return reject(
      'invalid-payload',
      'payload must be an object',
      false,
      'payload',
    )
  }

  for (const field of REQUIRED_PAYLOAD_FIELDS[type]) {
    if (!(field in input.payload)) {
      return reject(
        'invalid-payload',
        `${type} requires payload.${field}`,
        false,
        `payload.${field}`,
      )
    }
  }

  const issue = PAYLOAD_VALIDATORS[type](input.payload)

  if (issue) {
    return reject(
      'invalid-payload',
      `${type} payload.${issue.field} ${issue.message}`,
      false,
      `payload.${issue.field}`,
    )
  }

  const boundId = PAYLOAD_ENTITY_ID[type]?.(input.payload)

  if (boundId !== undefined && boundId !== input.entity.id) {
    return reject(
      'entity-id-mismatch',
      `${type} envelope targets ${input.entity.kind} ${input.entity.id} but the payload carries ${boundId}`,
      false,
      'entity.id',
    )
  }

  return { ok: true, event: input as unknown as AnyDomainEvent }
}
