import { describe, expect, it } from 'vitest'

import { createEventFactory } from '../src/host/event-factory'
import { validateDomainEvent } from '../src/protocol/validation'

const factory = createEventFactory('stream-events')

function conversationEvent() {
  return factory.create('conversation.upserted', 'conv-1', {
    conversation: { id: 'conv-1', title: 'hi', revision: 1 },
  })
}

describe('domain event validation (AI2-106)', () => {
  it('accepts a well-formed envelope', () => {
    const result = validateDomainEvent(conversationEvent())

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.event.seq).toBe(1)
      expect(result.event.entity).toEqual({
        kind: 'conversation',
        id: 'conv-1',
      })
    }
  })

  it('quarantines unknown schema versions instead of throwing', () => {
    const event = { ...conversationEvent(), schemaVersion: 3 }
    const result = validateDomainEvent(event)

    expect(result).toMatchObject({
      ok: false,
      code: 'unsupported-schema-version',
      quarantined: true,
    })
  })

  it('quarantines unknown event types', () => {
    const result = validateDomainEvent({
      ...conversationEvent(),
      type: 'message.exploded',
    })

    expect(result).toMatchObject({
      ok: false,
      code: 'unknown-event-type',
      quarantined: true,
    })
  })

  it('quarantines unknown entity kinds', () => {
    const result = validateDomainEvent({
      ...conversationEvent(),
      entity: { kind: 'planet', id: 'x' },
    })

    expect(result).toMatchObject({
      ok: false,
      code: 'unknown-entity-kind',
      quarantined: true,
    })
  })

  it('rejects an entity kind that does not match the event type', () => {
    const result = validateDomainEvent({
      ...conversationEvent(),
      entity: { kind: 'execution', id: 'conv-1' },
    })

    expect(result).toMatchObject({
      ok: false,
      code: 'entity-kind-mismatch',
      quarantined: false,
    })
  })

  it('rejects structurally damaged envelopes', () => {
    const base = conversationEvent()

    expect(validateDomainEvent(null)).toMatchObject({
      ok: false,
      code: 'not-an-object',
    })
    expect(validateDomainEvent({ ...base, seq: 0 })).toMatchObject({
      ok: false,
      code: 'invalid-envelope',
      field: 'seq',
    })
    expect(validateDomainEvent({ ...base, eventId: '' })).toMatchObject({
      ok: false,
      code: 'invalid-envelope',
      field: 'eventId',
    })
    expect(validateDomainEvent({ ...base, payload: null })).toMatchObject({
      ok: false,
      code: 'invalid-payload',
    })
  })

  it('requires the event-specific payload fields', () => {
    const delta = {
      ...factory.create('message.part.delta', 'msg-1', {
        messageId: 'msg-1',
        partId: 'part-1',
        baseRevision: 1,
        nextRevision: 2,
        append: 'x',
      }),
    }

    const withoutPartId = {
      ...delta,
      payload: {
        messageId: 'msg-1',
        baseRevision: 1,
        nextRevision: 2,
      },
    }

    expect(validateDomainEvent(withoutPartId)).toMatchObject({
      ok: false,
      code: 'invalid-payload',
      field: 'payload.partId',
    })
  })
})
