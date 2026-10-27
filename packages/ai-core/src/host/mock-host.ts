/**
 * Mock host for V2 development and tests (AI2-110).
 *
 * Deterministic in-memory host: commands produce an acknowledgement (optionally
 * scripted) and tests append authoritative events with `emit`, which keeps
 * `seq` strictly increasing. It never touches the network.
 */

import type { AssetRef } from '../domain/types'
import type { Command, CommandAck } from '../protocol/commands'

import type {
  AnyDomainEvent,
  DomainEventType,
  EventEntityRef,
} from '../protocol/events'
import type { AiState } from '../store/state'
import type {
  AiHostAdapter,
  AssetContent,
  HostSnapshotPayload,
  SnapshotScope,
} from './adapter'
import type { EventFactory } from './event-factory'
import { createAcceptedAck, createRejectedAck } from './adapter'
import { createEventFactory } from './event-factory'

export interface MockHostOptions {
  streamId?: string
  /** Script the acknowledgement, or return undefined for the default accept. */
  onExecute?: (
    command: Command,
    host: MockHost,
  ) => CommandAck | Promise<CommandAck> | undefined
  /** Snapshot state projection used by `getSnapshot`. */
  snapshotState?: () => Partial<AiState>
}

export interface MockHost extends AiHostAdapter {
  emit: <TType extends DomainEventType>(
    type: TType,
    id: string,
    payload: unknown,
  ) => Extract<AnyDomainEvent, { type: TType }>
  emitForEntity: <TType extends DomainEventType>(
    type: TType,
    entity: EventEntityRef,
    payload: unknown,
  ) => Extract<AnyDomainEvent, { type: TType }>
  events: () => readonly AnyDomainEvent[]
  commands: () => readonly Command[]
  close: () => void
}

interface Waiter {
  resolve: () => void
}

export function createMockHost(options: MockHostOptions = {}): MockHost {
  const streamId = options.streamId ?? 'mock-stream'
  const factory: EventFactory = createEventFactory(streamId)
  const events: AnyDomainEvent[] = []
  const commands: Command[] = []
  const waiters = new Set<Waiter>()
  let closed = false

  function wake(): void {
    for (const waiter of waiters) waiter.resolve()
    waiters.clear()
  }

  function waitForChange(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) return Promise.resolve()

    return new Promise<void>(resolve => {
      const waiter: Waiter = { resolve }
      waiters.add(waiter)

      signal?.addEventListener(
        'abort',
        () => {
          waiters.delete(waiter)
          resolve()
        },
        { once: true },
      )
    })
  }

  const host: MockHost = {
    emit<TType extends DomainEventType>(
      type: TType,
      id: string,
      payload: unknown,
    ): Extract<AnyDomainEvent, { type: TType }> {
      const event = factory.create(type, id, payload)
      events.push(event)
      wake()
      return event
    },
    emitForEntity<TType extends DomainEventType>(
      type: TType,
      entity: EventEntityRef,
      payload: unknown,
    ): Extract<AnyDomainEvent, { type: TType }> {
      const event = factory.createForEntity(type, entity, payload)
      events.push(event)
      wake()
      return event
    },
    events(): readonly AnyDomainEvent[] {
      return events
    },
    commands(): readonly Command[] {
      return commands
    },
    close(): void {
      closed = true
      wake()
    },
    async execute(command: Command, signal?: AbortSignal): Promise<CommandAck> {
      if (closed) {
        return createRejectedAck(
          command,
          'AI_HOST_CLOSED',
          'mock host is closed',
        )
      }
      if (signal?.aborted) {
        return createRejectedAck(
          command,
          'AI_COMMAND_ABORTED',
          'command was aborted',
        )
      }

      commands.push(command)

      const scripted = await options.onExecute?.(command, host)

      if (scripted) return scripted

      return createAcceptedAck(command, `op-${commands.length}`)
    },
    subscribe(
      targetStreamId: string,
      afterSeq: number,
      signal?: AbortSignal,
    ): AsyncIterable<AnyDomainEvent> {
      async function* iterate(): AsyncIterable<AnyDomainEvent> {
        let cursor = 0

        for (;;) {
          if (closed || signal?.aborted) return

          const event = events[cursor]

          if (!event) {
            await waitForChange(signal)
            continue
          }

          cursor += 1

          if (event.streamId !== targetStreamId || event.seq <= afterSeq)
            continue

          yield event
        }
      }

      return iterate()
    },
    async getSnapshot(scope: SnapshotScope): Promise<HostSnapshotPayload> {
      void scope

      return {
        cursors: { [streamId]: factory.nextSeq - 1 },
        state: options.snapshotState?.() ?? {},
      }
    },
    async loadAsset(
      asset: AssetRef,
      signal?: AbortSignal,
    ): Promise<AssetContent> {
      if (signal?.aborted) throw new Error('AI_ASSET_ABORTED')
      void asset
      return new Uint8Array(0)
    },
  }

  return host
}
