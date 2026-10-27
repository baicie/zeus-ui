/**
 * Event envelope validation (AI2-106).
 *
 * Unknown schema versions and unknown event types are quarantined, not thrown:
 * a client must keep the stream cursor honest while it reports the problem.
 * Structural damage inside a known event is a hard rejection.
 */

import type { AnyDomainEvent, DomainEventType } from './events'

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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

  return { ok: true, event: input as unknown as AnyDomainEvent }
}
