/**
 * Deterministic event factory for fixtures, mock hosts and replay hosts
 * (AI2-110).
 *
 * `seq` is authoritative-host owned and starts at 1. Timestamps are synthetic
 * so a recorded stream replays to the exact same canonical state everywhere.
 */

import type {
  AnyDomainEvent,
  DomainEventType,
  EventEntityRef,
} from '../protocol/events'

import {
  DOMAIN_EVENT_SCHEMA_VERSION,
  ENTITY_KIND_BY_EVENT_TYPE,
} from '../protocol/events'

const BASE_TIME_MS = Date.UTC(2026, 0, 1, 0, 0, 0)

export interface EventFactoryOptions {
  startSeq?: number
  baseTimeMs?: number
}

export interface EventFactory {
  readonly streamId: string
  readonly nextSeq: number
  create: <TType extends DomainEventType>(
    type: TType,
    id: string,
    payload: unknown,
  ) => Extract<AnyDomainEvent, { type: TType }>
  createForEntity: <TType extends DomainEventType>(
    type: TType,
    entity: EventEntityRef,
    payload: unknown,
  ) => Extract<AnyDomainEvent, { type: TType }>
}

export function createEventFactory(
  streamId: string,
  options: EventFactoryOptions = {},
): EventFactory {
  let seq = options.startSeq ?? 1
  const baseTimeMs = options.baseTimeMs ?? BASE_TIME_MS

  function build<TType extends DomainEventType>(
    type: TType,
    entity: EventEntityRef,
    payload: unknown,
    currentSeq: number,
  ): Extract<AnyDomainEvent, { type: TType }> {
    return {
      schemaVersion: DOMAIN_EVENT_SCHEMA_VERSION,
      eventId: `evt-${streamId}-${currentSeq}`,
      streamId,
      seq: currentSeq,
      entity,
      type,
      occurredAt: new Date(baseTimeMs + currentSeq * 1000).toISOString(),
      payload,
    } as Extract<AnyDomainEvent, { type: TType }>
  }

  return {
    streamId,
    get nextSeq(): number {
      return seq
    },
    create<TType extends DomainEventType>(
      type: TType,
      id: string,
      payload: unknown,
    ): Extract<AnyDomainEvent, { type: TType }> {
      const current = seq
      seq += 1
      return build(
        type,
        { kind: ENTITY_KIND_BY_EVENT_TYPE[type], id },
        payload,
        current,
      )
    },
    createForEntity<TType extends DomainEventType>(
      type: TType,
      entity: EventEntityRef,
      payload: unknown,
    ): Extract<AnyDomainEvent, { type: TType }> {
      const current = seq
      seq += 1
      return build(type, entity, payload, current)
    },
  }
}
