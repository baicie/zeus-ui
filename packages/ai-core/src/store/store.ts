/**
 * Canonical store with seq ordering and recovery (AI2-107 / AI2-108).
 *
 * Responsibilities:
 * - validate and apply host events through the canonical reducers;
 * - deduplicate by `seq`, buffer out-of-order events and surface gaps;
 * - quarantine unsupported schema versions / unknown event types instead of
 *   silently applying them;
 * - expose selector subscriptions whose listeners only run when their slice
 *   actually changed;
 * - import/export checksummed snapshots.
 */

import type { Timestamp } from '../domain/types'
import type { AnyDomainEvent } from '../protocol/events'
import type { ReduceErrorCode } from './reducers'
import type { AiSnapshot, SnapshotValidationResult } from './snapshot'

import type { AiState } from './state'
import { validateDomainEvent } from '../protocol/validation'
import { reduceEvent } from './reducers'
import { createSnapshot, validateSnapshot } from './snapshot'
import { createInitialState } from './state'

export type AiStoreDiagnosticCode =
  | 'gap-detected'
  | 'quarantined-event'
  | 'rejected-event'
  | 'snapshot-available'
  | 'snapshot-loaded'

export interface AiStoreDiagnostic {
  code: AiStoreDiagnosticCode
  message: string
  streamId?: string
  seq?: number
  detail?: Readonly<Record<string, unknown>>
}

export interface AiStoreOptions {
  streamId: string
  onDiagnostic?: (diagnostic: AiStoreDiagnostic) => void
  /** Guard against unbounded buffering when a stream never heals. */
  maxBufferedEvents?: number
}

export type IngestResult =
  | { status: 'applied'; seq: number; appliedSeqs: readonly number[] }
  | { status: 'duplicate'; seq: number }
  | {
      status: 'gap'
      expectedSeq: number
      receivedSeq: number
      buffered: number
    }
  | {
      status: 'buffered'
      expectedSeq: number
      receivedSeq: number
      buffered: number
    }
  | { status: 'quarantined'; code: string; message: string }
  | { status: 'rejected'; code: string | ReduceErrorCode; message: string }

export type Unsubscribe = () => void

export type Selector<T> = (state: Readonly<AiState>) => T

export interface AiStore {
  getState: () => Readonly<AiState>
  ingest: (event: unknown) => IngestResult
  subscribe: <T>(
    selector: Selector<T>,
    listener: (value: T) => void,
    equal?: (previous: T, next: T) => boolean,
  ) => Unsubscribe
  getCursor: (streamId?: string) => number
  pendingSeqs: () => readonly number[]
  exportSnapshot: (takenAt: Timestamp) => AiSnapshot
  loadSnapshot: (input: unknown) => SnapshotValidationResult
}

interface Subscription {
  selector: Selector<unknown>
  listener: (value: unknown) => void
  equal: (previous: unknown, next: unknown) => boolean
  last: unknown
  hasValue: boolean
}

export function createAiStore(options: AiStoreOptions): AiStore {
  const streamId = options.streamId
  const maxBufferedEvents = options.maxBufferedEvents ?? 512
  const diagnostic = options.onDiagnostic ?? ((): void => {})

  let state: AiState = createInitialState()
  const pending = new Map<number, AnyDomainEvent>()
  const subscriptions = new Set<Subscription>()

  let gapOpen = false

  function commit(next: AiState): void {
    state = next

    for (const subscription of subscriptions) {
      const value = subscription.selector(state)

      if (!subscription.hasValue) {
        subscription.hasValue = true
        subscription.last = value
        continue
      }

      if (subscription.equal(subscription.last, value)) continue

      subscription.last = value
      subscription.listener(value)
    }
  }

  function drainBuffered(base: AiState): { state: AiState; applied: number[] } {
    let nextState = base
    const applied: number[] = []
    let cursor = nextState.cursors[streamId] ?? 0

    for (;;) {
      const buffered = pending.get(cursor + 1)

      if (!buffered) break

      pending.delete(cursor + 1)

      const reduced = reduceEvent(nextState, buffered)

      if (!reduced.ok) {
        diagnostic({
          code: 'rejected-event',
          message: reduced.message,
          streamId,
          seq: buffered.seq,
          detail: { reduceCode: reduced.code },
        })
        cursor += 1
        nextState = {
          ...nextState,
          cursors: { ...nextState.cursors, [streamId]: cursor },
        }
        applied.push(buffered.seq)
        continue
      }

      nextState = {
        ...reduced.state,
        cursors: { ...reduced.state.cursors, [streamId]: buffered.seq },
      }
      cursor = buffered.seq
      applied.push(buffered.seq)
    }

    if (pending.size === 0) gapOpen = false

    return { state: nextState, applied }
  }

  return {
    getState(): Readonly<AiState> {
      return state
    },
    ingest(event: unknown): IngestResult {
      const validation = validateDomainEvent(event)

      if (!validation.ok) {
        if (validation.quarantined) {
          diagnostic({
            code: 'quarantined-event',
            message: validation.message,
            detail: { validationCode: validation.code },
          })
          return {
            status: 'quarantined',
            code: validation.code,
            message: validation.message,
          }
        }

        diagnostic({
          code: 'rejected-event',
          message: validation.message,
          detail: { validationCode: validation.code },
        })
        return {
          status: 'rejected',
          code: validation.code,
          message: validation.message,
        }
      }

      const envelope = validation.event

      if (envelope.streamId !== streamId) {
        return {
          status: 'rejected',
          code: 'stream-mismatch',
          message: `event belongs to stream ${envelope.streamId}, store owns ${streamId}`,
        }
      }

      if (envelope.type === 'snapshot.available') {
        diagnostic({
          code: 'snapshot-available',
          message: `snapshot advertised at ${envelope.payload.uri}`,
          streamId,
          seq: envelope.seq,
          detail: {
            version: envelope.payload.version,
            checksum: envelope.payload.checksum,
          },
        })
      }

      const cursor = state.cursors[streamId] ?? 0

      if (envelope.seq <= cursor) {
        return { status: 'duplicate', seq: envelope.seq }
      }

      if (envelope.seq !== cursor + 1) {
        if (!pending.has(envelope.seq)) {
          if (pending.size >= maxBufferedEvents) {
            return {
              status: 'rejected',
              code: 'buffer-overflow',
              message: `stream ${streamId} holds ${pending.size} buffered events without healing the gap`,
            }
          }

          pending.set(envelope.seq, envelope)
        }

        const expectedSeq = cursor + 1

        if (!gapOpen) {
          gapOpen = true
          diagnostic({
            code: 'gap-detected',
            message: `stream ${streamId} is missing seq ${expectedSeq} before ${envelope.seq}`,
            streamId,
            seq: envelope.seq,
            detail: { expectedSeq, receivedSeq: envelope.seq },
          })
        }

        return pending.size === 1
          ? {
              status: 'gap',
              expectedSeq,
              receivedSeq: envelope.seq,
              buffered: pending.size,
            }
          : {
              status: 'buffered',
              expectedSeq,
              receivedSeq: envelope.seq,
              buffered: pending.size,
            }
      }

      const reduced = reduceEvent(state, envelope)

      if (!reduced.ok) {
        diagnostic({
          code: 'rejected-event',
          message: reduced.message,
          streamId,
          seq: envelope.seq,
          detail: { reduceCode: reduced.code },
        })
        return {
          status: 'rejected',
          code: reduced.code,
          message: reduced.message,
        }
      }

      const committed: AiState = {
        ...reduced.state,
        cursors: { ...reduced.state.cursors, [streamId]: envelope.seq },
      }
      const drained = drainBuffered(committed)
      commit(drained.state)

      return {
        status: 'applied',
        seq: envelope.seq,
        appliedSeqs: [envelope.seq, ...drained.applied],
      }
    },
    subscribe<T>(
      selector: Selector<T>,
      listener: (value: T) => void,
      equal: (previous: T, next: T) => boolean = Object.is,
    ): Unsubscribe {
      const subscription: Subscription = {
        selector: selector as Selector<unknown>,
        listener: listener as (value: unknown) => void,
        equal: equal as (previous: unknown, next: unknown) => boolean,
        // Seed with the current slice so the first real change is delivered
        // instead of being swallowed as an initialization step.
        last: (selector as Selector<unknown>)(state),
        hasValue: true,
      }

      subscriptions.add(subscription)

      return (): void => {
        subscriptions.delete(subscription)
      }
    },
    getCursor(targetStreamId?: string): number {
      return state.cursors[targetStreamId ?? streamId] ?? 0
    },
    pendingSeqs(): readonly number[] {
      return [...pending.keys()].sort((left, right) => left - right)
    },
    exportSnapshot(takenAt: Timestamp): AiSnapshot {
      return createSnapshot(streamId, state, takenAt)
    },
    loadSnapshot(input: unknown): SnapshotValidationResult {
      const result = validateSnapshot(input, streamId)

      if (!result.ok) return result

      pending.clear()
      gapOpen = false
      commit(result.snapshot.state)
      diagnostic({
        code: 'snapshot-loaded',
        message: `snapshot ${result.snapshot.streamId}@${result.snapshot.takenAt} loaded`,
        streamId,
        detail: { checksum: result.snapshot.checksum },
      })

      return result
    },
  }
}
