/**
 * Canonical store with seq ordering and recovery (AI2-107 / AI2-108).
 *
 * Responsibilities:
 * - validate and apply host events through the canonical reducers;
 * - deduplicate by `seq`, buffer out-of-order events and surface gaps;
 * - quarantine unsupported schema versions / unknown event types instead of
 *   silently applying them;
 * - optionally pin the store to one conversation or execution scope and
 *   refuse events that belong elsewhere (threat T5-2);
 * - expose selector subscriptions whose listeners only run when their slice
 *   actually changed;
 * - import/export checksummed snapshots.
 *
 * Failure model: an event that occupies the next `seq` but cannot be applied
 * (reducer rejection, out-of-scope, structurally invalid, unknown version or
 * type) is never skipped and never retried forever. The stream enters
 * `desynced`: the cursor stays on the last good event, later events are only
 * buffered, and the store waits for a validated snapshot (`loadSnapshot` /
 * `loadHostSnapshot`). Replaying the same broken seq cannot heal it, so the
 * store says so instead of reporting a misleading gap. An unreadable event
 * that claims a *later* seq does not stop the events before it: the seq is
 * remembered and the stream halts only when it becomes the next one.
 *
 * Ownership: every accepted event and snapshot is deep-copied and frozen on
 * the way in, and committed state is frozen, so neither the caller that
 * handed data in nor a consumer of `getState()` can rewrite canonical state
 * without going through a reducer.
 */

import type { EntityId, Timestamp } from '../domain/types'
import type { IgnorableExtensionEvent } from '../protocol/compat'
import type { AnyDomainEvent } from '../protocol/events'
import type { ReduceErrorCode } from './reducers'
import type {
  AiSnapshot,
  HostSnapshotInput,
  SnapshotValidationResult,
} from './snapshot'
import type { AiState } from './state'

import { freezeClone, isRecord } from '../internal/stable'
import { readIgnorableExtension } from '../protocol/compat'
import { validateDomainEvent } from '../protocol/validation'
import { reduceEvent } from './reducers'
import {
  createSnapshot,
  snapshotFromHostPayload,
  validateSnapshot,
} from './snapshot'
import { AI_STATE_KEYS, createInitialState } from './state'

export type AiStoreDiagnosticCode =
  | 'gap-detected'
  | 'quarantined-event'
  | 'rejected-event'
  | 'stream-mismatch'
  | 'stream-desynced'
  | 'listener-error'
  | 'extension-ignored'
  | 'snapshot-available'
  | 'snapshot-loaded'
  | 'snapshot-rejected'

export interface AiStoreDiagnostic {
  code: AiStoreDiagnosticCode
  message: string
  streamId?: string
  seq?: number
  detail?: Readonly<Record<string, unknown>>
}

/**
 * The aggregate a store is allowed to hold. `conversation` accepts that
 * conversation, its messages and the executions linked to it; `execution`
 * accepts that execution, its children and its linked conversation.
 */
export interface AiStoreScope {
  kind: 'conversation' | 'execution'
  id: EntityId
}

export interface AiStoreOptions {
  streamId: string
  scope?: AiStoreScope
  onDiagnostic?: (diagnostic: AiStoreDiagnostic) => void
  /** Guard against unbounded buffering when a stream never heals. */
  maxBufferedEvents?: number
}

export interface StreamHalt {
  seq: number
  code: string
  message: string
}

export type AiStreamStatus = 'live' | 'gap' | 'desynced'

export interface AiStreamSyncState {
  status: AiStreamStatus
  cursor: number
  expectedSeq: number
  pendingSeqs: readonly number[]
  /** Why the stream stopped; present only while `desynced`. */
  halt?: StreamHalt
}

export type IngestResult =
  | {
      status: 'applied'
      seq: number
      appliedSeqs: readonly number[]
      /** A buffered event behind this one could not be applied. */
      halted?: StreamHalt
    }
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
  | {
      status: 'desynced'
      seq: number
      halt: StreamHalt
      buffered: number
    }
  | {
      status: 'quarantined'
      code: string
      message: string
      recovery?: 'snapshot-required'
    }
  | {
      status: 'rejected'
      code: string | ReduceErrorCode
      message: string
      recovery?: 'snapshot-required'
    }

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
  /** Live selector subscriptions; used by leak checks. */
  subscriptionCount: () => number
  getSyncState: () => AiStreamSyncState
  pendingSeqs: () => readonly number[]
  exportSnapshot: (takenAt: Timestamp) => AiSnapshot
  loadSnapshot: (input: unknown) => SnapshotValidationResult
  loadHostSnapshot: (
    payload: HostSnapshotInput,
    takenAt: Timestamp,
  ) => SnapshotValidationResult
}

interface Subscription {
  selector: Selector<unknown>
  listener: (value: unknown) => void
  equal: (previous: unknown, next: unknown) => boolean
  last: unknown
}

/**
 * What occupies one seq of the stream: a domain event, or a host-declared
 * ignorable extension that only advances the cursor (AI2-112).
 */
type StreamEntry = AnyDomainEvent | IgnorableExtensionEvent

function isExtension(entry: StreamEntry): entry is IgnorableExtensionEvent {
  return (entry as IgnorableExtensionEvent).kind === 'ignorable-extension'
}

type ApplyOutcome =
  | { ok: true; state: AiState }
  | { ok: false; code: string; message: string }

function outOfScope(message: string): ApplyOutcome {
  return { ok: false, code: 'out-of-scope', message }
}

/** Scope check for one event against the state it would be applied to. */
function checkEventScope(
  state: AiState,
  event: AnyDomainEvent,
  scope: AiStoreScope,
): ApplyOutcome | null {
  const scopedExecution =
    scope.kind === 'execution' ? state.executions.get(scope.id) : undefined
  const linkedConversationId =
    scope.kind === 'conversation' ? scope.id : scopedExecution?.conversationId

  const inConversation = (conversationId: EntityId | undefined): boolean =>
    conversationId !== undefined && conversationId === linkedConversationId

  const inExecution = (executionId: EntityId | undefined): boolean =>
    executionId !== undefined &&
    (scope.kind === 'execution'
      ? executionId === scope.id
      : state.executions.get(executionId) !== undefined)

  switch (event.type) {
    case 'conversation.upserted': {
      const id = event.payload.conversation.id
      return inConversation(id)
        ? null
        : outOfScope(`conversation ${id} is outside ${scope.kind} ${scope.id}`)
    }
    case 'message.created': {
      const { id, conversationId } = event.payload.message
      return inConversation(conversationId)
        ? null
        : outOfScope(
            `message ${id} of conversation ${conversationId} is outside ${scope.kind} ${scope.id}`,
          )
    }
    case 'execution.started': {
      const { id, conversationId } = event.payload.execution
      const allowed =
        scope.kind === 'execution'
          ? id === scope.id
          : conversationId === scope.id
      return allowed
        ? null
        : outOfScope(`execution ${id} is outside ${scope.kind} ${scope.id}`)
    }
    case 'execution.status.changed':
      return inExecution(event.payload.id)
        ? null
        : outOfScope(
            `execution ${event.payload.id} is outside ${scope.kind} ${scope.id}`,
          )
    case 'step.upserted':
    case 'tool.upserted':
    case 'approval.requested':
    case 'artifact.published':
    case 'changeset.updated': {
      const entity =
        event.type === 'step.upserted'
          ? event.payload.step
          : event.type === 'tool.upserted'
            ? event.payload.tool
            : event.type === 'approval.requested'
              ? event.payload.approval
              : event.type === 'artifact.published'
                ? event.payload.artifact
                : event.payload.changeset
      return inExecution(entity.executionId)
        ? null
        : outOfScope(
            `${event.entity.kind} ${entity.id} of execution ${String(entity.executionId)} is outside ${scope.kind} ${scope.id}`,
          )
    }
    default:
      // Deltas/completions/resolutions address entities that already passed
      // the scope check when they were created; the reducer rejects unknown ids.
      return null
  }
}

/** First entity in a snapshot state that does not belong to the scope. */
function findOutOfScopeEntity(
  state: AiState,
  scope: AiStoreScope,
): string | null {
  const executionIds = new Set(state.executions.keys())

  if (scope.kind === 'conversation') {
    for (const id of state.conversations.keys()) {
      if (id !== scope.id) return `conversation ${id}`
    }
    for (const message of state.messages.values()) {
      if (message.conversationId !== scope.id) return `message ${message.id}`
    }
    for (const execution of state.executions.values()) {
      if (execution.conversationId !== scope.id) {
        return `execution ${execution.id}`
      }
    }
  } else {
    const linked = state.executions.get(scope.id)?.conversationId

    for (const id of executionIds) {
      if (id !== scope.id) return `execution ${id}`
    }
    for (const id of state.conversations.keys()) {
      if (id !== linked) return `conversation ${id}`
    }
    for (const message of state.messages.values()) {
      if (message.conversationId !== linked) return `message ${message.id}`
    }
  }

  const children = [
    ...state.steps.values(),
    ...state.toolInvocations.values(),
    ...state.approvals.values(),
    ...state.changeSets.values(),
    ...state.artifacts.values(),
  ]

  for (const child of children) {
    if (
      child.executionId === undefined ||
      !executionIds.has(child.executionId)
    ) {
      return `${child.id} (execution ${String(child.executionId)})`
    }
  }

  return null
}

/** Freeze the state object and the collections a commit replaced. */
function freezeCommitted(next: AiState, base?: AiState): AiState {
  if (Object.isFrozen(next)) return next

  for (const key of AI_STATE_KEYS) {
    if (next[key] !== base?.[key]) Object.freeze(next[key])
  }

  return Object.freeze(next)
}

export function createAiStore(options: AiStoreOptions): AiStore {
  const streamId = options.streamId
  const scope = options.scope
  const maxBufferedEvents = options.maxBufferedEvents ?? 512
  const diagnostic = options.onDiagnostic ?? ((): void => {})

  let state: AiState = freezeCommitted(createInitialState())
  const pending = new Map<number, StreamEntry>()
  /** Future seqs whose event arrived unreadable; reaching one halts the stream. */
  const poisoned = new Map<number, StreamHalt>()
  const subscriptions = new Set<Subscription>()

  let gapOpen = false
  let halt: StreamHalt | undefined

  function cursorOf(current: AiState): number {
    return current.cursors[streamId] ?? 0
  }

  function commit(next: AiState): void {
    if (next === state) return

    state = next

    for (const subscription of [...subscriptions]) {
      if (!subscriptions.has(subscription)) continue

      try {
        const value = subscription.selector(state)

        if (subscription.equal(subscription.last, value)) continue

        subscription.last = value
        subscription.listener(value)
      } catch (error) {
        // One faulty view must not stop the others from seeing the commit.
        diagnostic({
          code: 'listener-error',
          message: error instanceof Error ? error.message : String(error),
          streamId,
        })
      }
    }
  }

  function apply(base: AiState, event: StreamEntry): ApplyOutcome {
    if (isExtension(event)) {
      diagnostic({
        code: 'extension-ignored',
        message: `ignorable ${event.type} acknowledged without changing state`,
        streamId,
        seq: event.seq,
        detail: { type: event.type },
      })

      return {
        ok: true,
        state: freezeCommitted(
          { ...base, cursors: { ...base.cursors, [streamId]: event.seq } },
          base,
        ),
      }
    }

    if (scope) {
      const scoped = checkEventScope(base, event, scope)
      if (scoped) return scoped
    }

    const reduced = reduceEvent(base, event)

    if (!reduced.ok) return reduced

    return {
      ok: true,
      state: freezeCommitted(
        {
          ...reduced.state,
          cursors: { ...reduced.state.cursors, [streamId]: event.seq },
        },
        base,
      ),
    }
  }

  function enterDesync(next: StreamHalt): void {
    halt = next
    gapOpen = false
    diagnostic({
      code: 'stream-desynced',
      message: `stream ${streamId} halted at seq ${next.seq} (${next.code}); a snapshot is required`,
      streamId,
      seq: next.seq,
      detail: { reason: next.code },
    })
  }

  function rememberPending(event: StreamEntry): boolean {
    if (pending.has(event.seq)) return true
    if (pending.size >= maxBufferedEvents) return false

    pending.set(event.seq, event)
    return true
  }

  function drainBuffered(base: AiState): {
    state: AiState
    applied: number[]
    halted?: StreamHalt
  } {
    let nextState = base
    const applied: number[] = []

    for (;;) {
      const seq = cursorOf(nextState) + 1
      const poison = poisoned.get(seq)

      if (poison) {
        enterDesync(poison)
        return { state: nextState, applied, halted: poison }
      }

      const buffered = pending.get(seq)

      if (!buffered) break

      const outcome = apply(nextState, buffered)

      if (!outcome.ok) {
        // Leave the event in the buffer: it is still the next seq and must be
        // superseded by a snapshot, never dropped.
        const stopped: StreamHalt = {
          seq,
          code: outcome.code,
          message: outcome.message,
        }
        diagnostic({
          code: 'rejected-event',
          message: outcome.message,
          streamId,
          seq,
          detail: { reduceCode: outcome.code },
        })
        enterDesync(stopped)
        return { state: nextState, applied, halted: stopped }
      }

      pending.delete(seq)
      nextState = outcome.state
      applied.push(seq)
    }

    if (pending.size === 0) gapOpen = false

    return { state: nextState, applied }
  }

  /** An unreadable event that claims a future seq of this stream. */
  function claimsFutureSeq(input: unknown): number | undefined {
    if (!isRecord(input) || input.streamId !== streamId) return undefined

    const seq = input.seq

    if (typeof seq !== 'number' || !Number.isInteger(seq)) return undefined

    return seq > cursorOf(state) ? seq : undefined
  }

  function restore(result: SnapshotValidationResult): SnapshotValidationResult {
    if (!result.ok) {
      diagnostic({
        code: 'snapshot-rejected',
        message: result.message,
        streamId,
        detail: { snapshotCode: result.code },
      })
      return result
    }

    if (scope) {
      const foreign = findOutOfScopeEntity(result.snapshot.state, scope)

      if (foreign) {
        const rejected: SnapshotValidationResult = {
          ok: false,
          code: 'scope-mismatch',
          message: `snapshot contains ${foreign}, outside ${scope.kind} ${scope.id}`,
        }
        diagnostic({
          code: 'snapshot-rejected',
          message: rejected.message,
          streamId,
          detail: { snapshotCode: rejected.code },
        })
        return rejected
      }
    }

    const nextCursor = cursorOf(result.snapshot.state)

    for (const seq of [...pending.keys()]) {
      if (seq <= nextCursor) pending.delete(seq)
    }
    for (const seq of [...poisoned.keys()]) {
      if (seq <= nextCursor) poisoned.delete(seq)
    }

    halt = undefined
    gapOpen = false

    // Events buffered beyond the snapshot cursor are still authoritative.
    const drained = drainBuffered(result.snapshot.state)
    commit(drained.state)

    diagnostic({
      code: 'snapshot-loaded',
      message: `snapshot ${result.snapshot.streamId}@${result.snapshot.takenAt} loaded`,
      streamId,
      seq: nextCursor,
      detail: {
        checksum: result.snapshot.checksum,
        drained: drained.applied.length,
      },
    })

    return result
  }

  return {
    getState(): Readonly<AiState> {
      return state
    },
    ingest(event: unknown): IngestResult {
      const extension = readIgnorableExtension(event)
      const validation = extension
        ? ({ ok: true, event: extension } as const)
        : validateDomainEvent(event)

      if (!validation.ok) {
        const futureSeq = claimsFutureSeq(event)

        diagnostic({
          code: validation.quarantined ? 'quarantined-event' : 'rejected-event',
          message: validation.message,
          streamId,
          seq: futureSeq,
          detail: { validationCode: validation.code },
        })

        if (futureSeq !== undefined) {
          const stop: StreamHalt = {
            seq: futureSeq,
            code: validation.code,
            message: validation.message,
          }

          if (!halt && futureSeq === cursorOf(state) + 1) {
            enterDesync(stop)
          } else if (
            !poisoned.has(futureSeq) &&
            poisoned.size < maxBufferedEvents
          ) {
            poisoned.set(futureSeq, stop)
          }
        }

        // The stream cannot pass this seq without a snapshot that covers it.
        const recovery =
          futureSeq !== undefined
            ? { recovery: 'snapshot-required' as const }
            : {}

        return validation.quarantined
          ? {
              status: 'quarantined',
              code: validation.code,
              message: validation.message,
              ...recovery,
            }
          : {
              status: 'rejected',
              code: validation.code,
              message: validation.message,
              ...recovery,
            }
      }

      const received = validation.event

      if (received.streamId !== streamId) {
        const message = `event belongs to stream ${received.streamId}, store owns ${streamId}`
        diagnostic({
          code: 'stream-mismatch',
          message,
          streamId,
          seq: received.seq,
          detail: { eventStreamId: received.streamId },
        })
        return { status: 'rejected', code: 'stream-mismatch', message }
      }

      const cursor = cursorOf(state)

      if (received.seq <= cursor) {
        return { status: 'duplicate', seq: received.seq }
      }

      // From here on the event may be buffered or applied: keep our own copy.
      const envelope = freezeClone(received)

      if (!isExtension(envelope) && envelope.type === 'snapshot.available') {
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

      if (halt) {
        if (envelope.seq !== halt.seq) rememberPending(envelope)

        return {
          status: 'desynced',
          seq: envelope.seq,
          halt,
          buffered: pending.size,
        }
      }

      const expectedSeq = cursor + 1

      if (envelope.seq !== expectedSeq) {
        if (!rememberPending(envelope)) {
          return {
            status: 'rejected',
            code: 'buffer-overflow',
            message: `stream ${streamId} holds ${pending.size} buffered events without healing the gap`,
          }
        }

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

        return {
          status: pending.size === 1 ? 'gap' : 'buffered',
          expectedSeq,
          receivedSeq: envelope.seq,
          buffered: pending.size,
        }
      }

      const poison = poisoned.get(envelope.seq)

      if (poison) {
        // An unreadable frame already claimed this seq; a second, different
        // frame for the same seq is not a trustworthy repair.
        enterDesync(poison)
        return {
          status: 'desynced',
          seq: envelope.seq,
          halt: poison,
          buffered: pending.size,
        }
      }

      const outcome = apply(state, envelope)

      if (!outcome.ok) {
        diagnostic({
          code: 'rejected-event',
          message: outcome.message,
          streamId,
          seq: envelope.seq,
          detail: { reduceCode: outcome.code },
        })
        enterDesync({
          seq: envelope.seq,
          code: outcome.code,
          message: outcome.message,
        })
        return {
          status: 'rejected',
          code: outcome.code,
          message: outcome.message,
          recovery: 'snapshot-required',
        }
      }

      pending.delete(envelope.seq)
      const drained = drainBuffered(outcome.state)
      commit(drained.state)

      return {
        status: 'applied',
        seq: envelope.seq,
        appliedSeqs: [envelope.seq, ...drained.applied],
        ...(drained.halted ? { halted: drained.halted } : {}),
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
      }

      subscriptions.add(subscription)

      return (): void => {
        subscriptions.delete(subscription)
      }
    },
    subscriptionCount(): number {
      return subscriptions.size
    },
    getCursor(targetStreamId?: string): number {
      return state.cursors[targetStreamId ?? streamId] ?? 0
    },
    getSyncState(): AiStreamSyncState {
      const cursor = cursorOf(state)
      const pendingSeqs = [...pending.keys()].sort(
        (left, right) => left - right,
      )

      return {
        status: halt ? 'desynced' : pending.size > 0 ? 'gap' : 'live',
        cursor,
        expectedSeq: cursor + 1,
        pendingSeqs,
        ...(halt ? { halt } : {}),
      }
    },
    pendingSeqs(): readonly number[] {
      return [...pending.keys()].sort((left, right) => left - right)
    },
    exportSnapshot(takenAt: Timestamp): AiSnapshot {
      return createSnapshot(streamId, state, takenAt)
    },
    loadSnapshot(input: unknown): SnapshotValidationResult {
      return restore(validateSnapshot(input, streamId))
    },
    loadHostSnapshot(
      payload: HostSnapshotInput,
      takenAt: Timestamp,
    ): SnapshotValidationResult {
      return restore(snapshotFromHostPayload(streamId, payload, takenAt))
    },
  }
}
