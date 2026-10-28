/**
 * Snapshot export/validation (AI2-108).
 *
 * A snapshot is only usable when its schema version is known, every canonical
 * collection is present and well-formed, every entity passes the same shape
 * and reference rules as the event path, its cursors agree with the state it
 * carries, and its checksum matches; anything else is an explicit error,
 * never a silent partial restore. An accepted snapshot carries a frozen copy
 * of the state, detached from the caller's input.
 *
 * The checksum is an integrity check (FNV-1a), not an authorization
 * primitive: whether a caller may read a scope is decided by the host.
 */

import type { Timestamp } from '../domain/types'
import type { AiState } from './state'

import {
  freezeClone,
  isRecord,
  stableEqual,
  stableStringify,
} from '../internal/stable'
import { toEntityMap } from './entity-map'
import { findStateIntegrityIssue } from './integrity'
import {
  AI_STATE_KEYS,
  createInitialState,
  ENTITY_COLLECTION_KEYS,
} from './state'

export const AI_SNAPSHOT_SCHEMA_VERSION = 2

export interface AiSnapshot {
  schemaVersion: typeof AI_SNAPSHOT_SCHEMA_VERSION
  streamId: string
  takenAt: Timestamp
  cursors: Readonly<Record<string, number>>
  state: AiState
  checksum: string
}

/** FNV-1a over the stable projection of a state. Not a security primitive. */
export function checksumState(state: AiState): string {
  const text = stableStringify(state)
  // FNV-1a 32-bit offset basis and prime (0x811C9DC5 / 0x01000193).
  let hash = 2166136261

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619) >>> 0
  }

  return `fnv1a:${`00000000${hash.toString(16)}`.slice(-8)}`
}

export function createSnapshot(
  streamId: string,
  state: AiState,
  takenAt: Timestamp,
): AiSnapshot {
  return {
    schemaVersion: AI_SNAPSHOT_SCHEMA_VERSION,
    streamId,
    takenAt,
    cursors: state.cursors,
    state,
    checksum: checksumState(state),
  }
}

export type SnapshotValidationCode =
  | 'not-an-object'
  | 'unsupported-schema-version'
  | 'stream-mismatch'
  | 'scope-mismatch'
  | 'checksum-mismatch'
  | 'invalid-state'

export type SnapshotValidationResult =
  | { ok: true; snapshot: AiSnapshot }
  | { ok: false; code: SnapshotValidationCode; message: string }

function invalid(
  code: SnapshotValidationCode,
  message: string,
): SnapshotValidationResult {
  return { ok: false, code, message }
}

function isCursorRecord(value: unknown): value is Record<string, number> {
  if (!isRecord(value)) return false

  return Object.keys(value).every(key => {
    const cursor = value[key]
    return typeof cursor === 'number' && Number.isInteger(cursor) && cursor >= 0
  })
}

function validateStateShape(state: Record<string, unknown>): string | null {
  for (const key of AI_STATE_KEYS) {
    if (!isRecord(state[key])) return `state.${key} must be an object`
  }

  if (!isCursorRecord(state.cursors)) {
    return 'state.cursors must map stream ids to non-negative integers'
  }

  for (const indexKey of [
    'conversationMessageIds',
    'executionStepIds',
  ] as const) {
    const index = state[indexKey] as Record<string, unknown>

    for (const key of Object.keys(index)) {
      if (!Array.isArray(index[key])) {
        return `state.${indexKey}.${key} must be an array`
      }
    }
  }

  return null
}

export function validateSnapshot(
  input: unknown,
  expectedStreamId?: string,
): SnapshotValidationResult {
  if (!isRecord(input)) {
    return invalid('not-an-object', 'snapshot must be an object')
  }

  if (input.schemaVersion !== AI_SNAPSHOT_SCHEMA_VERSION) {
    return invalid(
      'unsupported-schema-version',
      `unsupported snapshot schemaVersion ${String(input.schemaVersion)}`,
    )
  }

  if (typeof input.streamId !== 'string' || input.streamId.length === 0) {
    return invalid('invalid-state', 'streamId is required')
  }

  if (expectedStreamId !== undefined && input.streamId !== expectedStreamId) {
    return invalid(
      'stream-mismatch',
      `snapshot belongs to stream ${input.streamId}, expected ${expectedStreamId}`,
    )
  }

  if (!isRecord(input.state)) {
    return invalid('invalid-state', 'state is required')
  }

  const shapeError = validateStateShape(input.state)

  if (shapeError) return invalid('invalid-state', shapeError)

  const cloned = freezeClone(input.state) as Record<string, unknown>
  const state = { ...cloned } as unknown as AiState
  // Parsed JSON carries plain records; live snapshots already hold maps.
  for (const key of ENTITY_COLLECTION_KEYS) {
    ;(state as unknown as Record<string, unknown>)[key] = toEntityMap(
      cloned[key],
    )
  }
  Object.freeze(state)
  const integrityError = findStateIntegrityIssue(state)

  if (integrityError) return invalid('invalid-state', integrityError)

  // The envelope cursors are not covered by the checksum, so they must agree
  // with the checksummed state instead of silently overriding it.
  if (
    input.cursors !== undefined &&
    !stableEqual(input.cursors, state.cursors)
  ) {
    return invalid(
      'invalid-state',
      'snapshot cursors disagree with state.cursors',
    )
  }

  const expectedChecksum = checksumState(state)

  if (input.checksum !== expectedChecksum) {
    return invalid(
      'checksum-mismatch',
      `snapshot checksum ${String(input.checksum)} does not match ${expectedChecksum}`,
    )
  }

  return {
    ok: true,
    snapshot: {
      schemaVersion: AI_SNAPSHOT_SCHEMA_VERSION,
      streamId: input.streamId,
      takenAt: typeof input.takenAt === 'string' ? input.takenAt : '',
      cursors: state.cursors,
      state,
      checksum: expectedChecksum,
    },
  }
}

export interface HostSnapshotInput {
  cursors: Readonly<Record<string, number>>
  state: Partial<AiState>
  checksum?: string
}

/**
 * Turn an `AiHostAdapter.getSnapshot()` payload into a store snapshot.
 *
 * Missing collections are filled with empty records, the host cursors become
 * the canonical `state.cursors`, and a host-provided checksum must match the
 * normalized state. The result still goes through {@link validateSnapshot}.
 */
export function snapshotFromHostPayload(
  streamId: string,
  payload: HostSnapshotInput,
  takenAt: Timestamp,
): SnapshotValidationResult {
  if (!isRecord(payload) || !isRecord(payload.state)) {
    return invalid('invalid-state', 'host snapshot must carry a state object')
  }

  if (!isCursorRecord(payload.cursors)) {
    return invalid(
      'invalid-state',
      'host snapshot cursors must map stream ids to non-negative integers',
    )
  }

  if (payload.cursors[streamId] === undefined) {
    return invalid(
      'stream-mismatch',
      `host snapshot has no cursor for stream ${streamId}`,
    )
  }

  const state = {
    ...createInitialState(),
    ...payload.state,
    cursors: { ...payload.cursors },
  } as AiState
  const checksum = checksumState(state)

  if (payload.checksum !== undefined && payload.checksum !== checksum) {
    return invalid(
      'checksum-mismatch',
      `host snapshot checksum ${payload.checksum} does not match ${checksum}`,
    )
  }

  return validateSnapshot(
    {
      schemaVersion: AI_SNAPSHOT_SCHEMA_VERSION,
      streamId,
      takenAt,
      cursors: state.cursors,
      state,
      checksum,
    },
    streamId,
  )
}

/** Empty snapshot state helper for hosts that must publish an initial baseline. */
export function createEmptySnapshotState(): AiState {
  return createInitialState()
}
