/**
 * Client session: one host, one stream, one canonical store (AI2-201).
 *
 * The session is the only place that talks to the host on behalf of the
 * controllers:
 *
 * - `connect()` follows the stream from the store cursor, ingests every
 *   event, and when the store reports a gap it cannot heal or a desync it
 *   loads a host snapshot and resumes after the snapshot cursor;
 * - `execute()` sends a command through an idempotency tracker, so a retry
 *   with the same key replays the recorded ack and a concurrent duplicate
 *   shares the in-flight attempt;
 * - `dispose()` stops following the stream. It does not cancel anything
 *   the host accepted: stopping a run is an explicit command.
 */

import type { AiHostAdapter, SnapshotScope } from '../host/adapter'
import type { Command, CommandAck } from '../protocol/commands'
import type {
  AiStore,
  AiStoreDiagnostic,
  AiStoreScope,
  IngestResult,
} from '../store/store'
import type { Controller } from './view-store'

import { createIdempotencyTracker } from '../protocol/commands'
import { createAiStore } from '../store/store'
import { createViewStore } from './view-store'

/**
 * - `idle`: not following the stream;
 * - `connecting`: (re)opening the subscription;
 * - `live`: applying events as they arrive;
 * - `recovering`: loading a snapshot to repair a gap or desync ("replaying");
 * - `offline`: the transport failed; data may be stale until it reconnects.
 */
export type SessionConnection =
  | 'idle'
  | 'connecting'
  | 'live'
  | 'recovering'
  | 'offline'

export interface SessionView {
  connection: SessionConnection
  cursor: number
  lastError?: string
}

export interface AiSessionOptions {
  host: AiHostAdapter
  streamId: string
  /** What to ask the host for when a snapshot is needed. */
  snapshotScope: SnapshotScope
  scope?: AiStoreScope
  onDiagnostic?: (diagnostic: AiStoreDiagnostic) => void
  /** Delay between reconnect attempts after a transport failure. */
  retryDelayMs?: number
  /** Consecutive failed connects before staying offline. Default 5. */
  maxRetries?: number
}

export interface AiSession extends Controller<SessionView> {
  readonly store: AiStore
  readonly host: AiHostAdapter
  readonly streamId: string
  /** Follow the stream until `dispose()` or the returned stop function. */
  connect: () => () => void
  /** Load a host snapshot now (also used internally for recovery). */
  recover: () => Promise<void>
  execute: (command: Command, signal?: AbortSignal) => Promise<CommandAck>
}

function needsSnapshot(result: IngestResult): boolean {
  return (
    result.status === 'desynced' ||
    ((result.status === 'rejected' || result.status === 'quarantined') &&
      result.recovery === 'snapshot-required')
  )
}

export function createAiSession(options: AiSessionOptions): AiSession {
  const store = createAiStore({
    streamId: options.streamId,
    scope: options.scope,
    onDiagnostic: options.onDiagnostic,
  })
  const view = createViewStore<SessionView>({ connection: 'idle', cursor: 0 })
  const tracker = createIdempotencyTracker()
  const inFlight = new Map<string, Promise<CommandAck>>()
  const retryDelayMs = options.retryDelayMs ?? 1000
  const maxRetries = options.maxRetries ?? 5
  let controller: AbortController | undefined
  let recovering: Promise<void> | undefined

  view.onDispose(
    store.subscribe(
      state => state.cursors[options.streamId] ?? 0,
      cursor => view.update({ cursor }),
    ),
  )

  async function recover(): Promise<void> {
    if (recovering) return recovering

    recovering = (async () => {
      view.update({ connection: 'recovering' })
      const payload = await options.host.getSnapshot(options.snapshotScope)
      const result = store.loadHostSnapshot(payload, new Date().toISOString())

      if (!result.ok) {
        throw new Error(`[AI_SESSION_SNAPSHOT_REJECTED] ${result.message}`)
      }
    })()

    try {
      await recovering
    } finally {
      recovering = undefined
    }
  }

  async function follow(signal: AbortSignal): Promise<void> {
    let failures = 0

    while (!signal.aborted) {
      view.update({ connection: 'connecting' })

      try {
        let restart = false

        for await (const event of options.host.subscribe(
          options.streamId,
          store.getCursor(),
          signal,
        )) {
          if (signal.aborted) return
          view.update({ connection: 'live', lastError: undefined })
          failures = 0

          const result = store.ingest(event)

          if (result.status === 'gap' || result.status === 'buffered') {
            // Give the transport a chance to deliver the missing seq; if it
            // keeps buffering past a small window, a snapshot heals it.
            if (store.getSyncState().pendingSeqs.length > 32) {
              await recover()
              restart = true
              break
            }
            continue
          }

          if (needsSnapshot(result)) {
            await recover()
            restart = true
            break
          }
        }

        if (signal.aborted) return
        if (restart) continue
        // The host ended the stream; keep following after a pause.
      } catch (error) {
        if (signal.aborted) return
        failures += 1
        view.update({
          connection: 'offline',
          lastError: error instanceof Error ? error.message : String(error),
        })
        if (failures >= maxRetries) return
      }

      await new Promise<void>(resolve => {
        const timer = setTimeout(resolve, retryDelayMs)
        signal.addEventListener(
          'abort',
          () => {
            clearTimeout(timer)
            resolve()
          },
          { once: true },
        )
      })
    }
  }

  const session: AiSession = {
    store,
    host: options.host,
    streamId: options.streamId,
    getSnapshot: view.getSnapshot,
    subscribe: view.subscribe,
    get disposed(): boolean {
      return view.disposed
    },
    connect(): () => void {
      controller?.abort()
      const current = new AbortController()
      controller = current

      void follow(current.signal).finally(() => {
        if (controller === current && !view.disposed) {
          view.update({
            connection:
              view.getSnapshot().connection === 'offline' ? 'offline' : 'idle',
          })
        }
      })

      return () => current.abort()
    },
    recover,
    async execute(command: Command, signal?: AbortSignal): Promise<CommandAck> {
      const decision = tracker.begin(command)

      if (decision.kind === 'replay' || decision.kind === 'conflict') {
        return decision.ack
      }

      if (decision.kind === 'in-flight') {
        const shared = inFlight.get(command.idempotencyKey)
        if (shared) {
          const ack = await shared
          return { ...ack, commandId: command.commandId }
        }
      }

      const attempt = options.host.execute(command, signal)
      inFlight.set(command.idempotencyKey, attempt)

      try {
        const ack = await attempt
        tracker.acknowledge(command, ack)
        return ack
      } catch (error) {
        // No authoritative answer: a retry with the same key must execute.
        tracker.release(command)
        throw error
      } finally {
        inFlight.delete(command.idempotencyKey)
      }
    },
    dispose(): void {
      controller?.abort()
      controller = undefined
      view.dispose()
    },
  }

  return session
}
