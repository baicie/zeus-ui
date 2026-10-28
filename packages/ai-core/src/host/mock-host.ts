/**
 * Mock host for V2 development and tests (AI2-110).
 *
 * Deterministic in-memory host: commands produce an acknowledgement (optionally
 * scripted) and tests append authoritative events with `emit`, which keeps
 * `seq` strictly increasing. It never touches the network.
 *
 * It behaves like a trusted host where it matters for client tests: commands
 * are validated, and an `idempotencyKey` executes at most once. Retries replay
 * the recorded ack (same `operationId`), concurrent duplicates share the
 * in-flight attempt, and reusing a key for a different command is refused.
 * `commands()` lists only attempts that actually executed.
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
import { createIdempotencyTracker, validateCommand } from '../protocol/commands'
import { checksumState } from '../store/snapshot'
import { createInitialState } from '../store/state'
import { createAcceptedAck, createRejectedAck } from './adapter'
import { createEventFactory } from './event-factory'
import { buildHostSnapshot } from './host-snapshot'

export interface MockHostOptions {
  streamId?: string
  /** Script the acknowledgement, or return undefined for the default accept. */
  onExecute?: (
    command: Command,
    host: MockHost,
  ) => CommandAck | undefined | Promise<CommandAck | undefined>
  /**
   * Override the state served by `getSnapshot`. By default the host folds its
   * own emitted events, so the snapshot cursor always matches its state.
   */
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

/** Resolve after a microtask, so callers can register the attempt first. */
const nextMicrotask = (): Promise<void> => Promise.resolve()

export function createMockHost(options: MockHostOptions = {}): MockHost {
  const streamId = options.streamId ?? 'mock-stream'
  const factory: EventFactory = createEventFactory(streamId)
  const events: AnyDomainEvent[] = []
  const commands: Command[] = []
  const waiters = new Set<Waiter>()
  const tracker = createIdempotencyTracker({ limit: 1000 })
  const inFlight = new Map<string, Promise<CommandAck>>()
  let closed = false

  function wake(): void {
    for (const waiter of waiters) waiter.resolve()
    waiters.clear()
  }

  function waitForChange(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) return Promise.resolve()

    return new Promise<void>(resolve => {
      // A long subscription waits many times on one signal; drop the abort
      // listener whichever way the wait ends so they do not pile up.
      const waiter: Waiter = {
        resolve: () => {
          signal?.removeEventListener('abort', onAbort)
          resolve()
        },
      }
      function onAbort(): void {
        waiters.delete(waiter)
        resolve()
      }

      waiters.add(waiter)
      signal?.addEventListener('abort', onAbort, { once: true })
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
      const validation = validateCommand(command)

      if (!validation.ok) {
        return {
          accepted: false,
          commandId:
            typeof (command as { commandId?: unknown })?.commandId === 'string'
              ? command.commandId
              : '',
          code: validation.code,
          message: validation.message,
        }
      }
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

      const decision = tracker.begin(command)

      if (decision.kind === 'replay' || decision.kind === 'conflict') {
        return decision.ack
      }

      if (decision.kind === 'in-flight') {
        // `begin` and `inFlight.set` happen in the same tick, so an in-flight
        // key always has a shared attempt to wait on.
        const ack = await (inFlight.get(
          command.idempotencyKey,
        ) as Promise<CommandAck>)
        return { ...ack, commandId: command.commandId }
      }

      commands.push(command)

      const operationId = `op-${commands.length}`
      // Defer the script so the attempt is registered before user code runs:
      // a script that re-enters `execute` with the same key must share it.
      const attempt = nextMicrotask().then(async () => {
        const scripted = await options.onExecute?.(command, host)
        return scripted ?? createAcceptedAck(command, operationId)
      })

      inFlight.set(command.idempotencyKey, attempt)

      try {
        const ack = await attempt
        tracker.acknowledge(command, ack)
        return ack
      } catch (error) {
        // No answer was recorded: let a retry with the same key execute.
        tracker.release(command)
        throw error
      } finally {
        inFlight.delete(command.idempotencyKey)
      }
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

      if (options.snapshotState) {
        const cursors = { [streamId]: factory.nextSeq - 1 }
        const state = {
          ...createInitialState(),
          ...options.snapshotState(),
          cursors,
        }

        return { cursors, state, checksum: checksumState(state) }
      }

      return buildHostSnapshot(streamId, events)
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
