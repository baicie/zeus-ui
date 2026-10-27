/**
 * Snapshot export/validation (AI2-108).
 *
 * A snapshot is only usable when its schema version is known and its checksum
 * matches the canonical state it carries; anything else is an explicit error,
 * never a silent partial restore.
 */

import type { Timestamp } from '../domain/types'

import type { AiState } from './state'
import { createInitialState } from './state'

export const AI_SNAPSHOT_SCHEMA_VERSION = 2

export interface AiSnapshot {
  schemaVersion: typeof AI_SNAPSHOT_SCHEMA_VERSION
  streamId: string
  takenAt: Timestamp
  cursors: Readonly<Record<string, number>>
  state: AiState
  checksum: string
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null'
  }

  if (Array.isArray(value)) {
    return `[${value.map(entry => stableStringify(entry)).join(',')}]`
  }

  const record = value as Record<string, unknown>
  const keys = Object.keys(record).sort()

  return `{${keys
    .map(key => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`
}

/** FNV-1a over the stable projection of a state. Not a security primitive. */
export function checksumState(state: AiState): string {
  const text = stableStringify(state)
  let hash = 0x811c9dc5

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
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

export type SnapshotValidationResult =
  | { ok: true; snapshot: AiSnapshot }
  | {
      ok: false
      code:
        | 'not-an-object'
        | 'unsupported-schema-version'
        | 'stream-mismatch'
        | 'checksum-mismatch'
        | 'invalid-state'
      message: string
    }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function validateSnapshot(
  input: unknown,
  expectedStreamId?: string,
): SnapshotValidationResult {
  if (!isRecord(input)) {
    return {
      ok: false,
      code: 'not-an-object',
      message: 'snapshot must be an object',
    }
  }

  if (input.schemaVersion !== AI_SNAPSHOT_SCHEMA_VERSION) {
    return {
      ok: false,
      code: 'unsupported-schema-version',
      message: `unsupported snapshot schemaVersion ${String(input.schemaVersion)}`,
    }
  }

  if (typeof input.streamId !== 'string' || input.streamId.length === 0) {
    return { ok: false, code: 'invalid-state', message: 'streamId is required' }
  }

  if (expectedStreamId !== undefined && input.streamId !== expectedStreamId) {
    return {
      ok: false,
      code: 'stream-mismatch',
      message: `snapshot belongs to stream ${input.streamId}, expected ${expectedStreamId}`,
    }
  }

  if (!isRecord(input.state)) {
    return { ok: false, code: 'invalid-state', message: 'state is required' }
  }

  const state = input.state as unknown as AiState
  const expectedChecksum = checksumState(state)

  if (input.checksum !== expectedChecksum) {
    return {
      ok: false,
      code: 'checksum-mismatch',
      message: `snapshot checksum ${String(input.checksum)} does not match ${expectedChecksum}`,
    }
  }

  return {
    ok: true,
    snapshot: {
      schemaVersion: AI_SNAPSHOT_SCHEMA_VERSION,
      streamId: input.streamId,
      takenAt: typeof input.takenAt === 'string' ? input.takenAt : '',
      cursors: isRecord(input.cursors)
        ? (input.cursors as Record<string, number>)
        : state.cursors,
      state,
      checksum: expectedChecksum,
    },
  }
}

/** Empty snapshot state helper for hosts that must publish an initial baseline. */
export function createEmptySnapshotState(): AiState {
  return createInitialState()
}
