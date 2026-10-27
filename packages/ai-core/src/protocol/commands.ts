/**
 * Command envelope, acknowledgement and idempotency (AI2-105).
 *
 * `accepted: true` only means the host accepted the intent. It is never proof
 * that the side effect happened: success or failure arrives later as domain
 * events. Retries must reuse `idempotencyKey`; `commandId` is for tracing and
 * may change between attempts. Reusing a key for a *different* command is a
 * client bug and is refused instead of replaying an unrelated result.
 */

import { stableStringify } from '../internal/stable'

export const COMMAND_SCHEMA_VERSION = 2

export interface CommandTarget {
  kind: string
  id: string
}

export interface Command<TPayload = unknown> {
  schemaVersion: typeof COMMAND_SCHEMA_VERSION
  commandId: string
  idempotencyKey: string
  type: string
  target: CommandTarget
  expectedRevision?: number
  payload: TPayload
}

export type CommandAck =
  | { accepted: true; commandId: string; operationId: string }
  | { accepted: false; commandId: string; code: string; message: string }

export interface CreateCommandInput<TPayload> {
  commandId: string
  idempotencyKey: string
  type: string
  target: CommandTarget
  payload: TPayload
  expectedRevision?: number
}

export function createCommand<TPayload>(
  input: CreateCommandInput<TPayload>,
): Command<TPayload> {
  if (input.commandId.length === 0) {
    throw new Error('[AI_COMMAND_INVALID] commandId must not be empty')
  }
  if (input.idempotencyKey.length === 0) {
    throw new Error('[AI_COMMAND_INVALID] idempotencyKey must not be empty')
  }
  if (input.type.length === 0) {
    throw new Error('[AI_COMMAND_INVALID] type must not be empty')
  }
  if (input.target.kind.length === 0 || input.target.id.length === 0) {
    throw new Error('[AI_COMMAND_INVALID] target kind and id are required')
  }

  const command: Command<TPayload> = {
    schemaVersion: COMMAND_SCHEMA_VERSION,
    commandId: input.commandId,
    idempotencyKey: input.idempotencyKey,
    type: input.type,
    target: { kind: input.target.kind, id: input.target.id },
    payload: input.payload,
  }

  if (input.expectedRevision !== undefined) {
    command.expectedRevision = input.expectedRevision
  }

  return command
}

/** Retry keeps the idempotency key and only refreshes the tracing id. */
export function retryCommand<TPayload>(
  command: Command<TPayload>,
  commandId: string,
): Command<TPayload> {
  return { ...command, commandId }
}

export type CommandValidationResult =
  | { ok: true; command: Command }
  | { ok: false; code: string; message: string }

export function validateCommand(input: unknown): CommandValidationResult {
  if (typeof input !== 'object' || input === null) {
    return {
      ok: false,
      code: 'AI_COMMAND_INVALID',
      message: 'command must be an object',
    }
  }

  const value = input as Record<string, unknown>

  if (value.schemaVersion !== COMMAND_SCHEMA_VERSION) {
    return {
      ok: false,
      code: 'AI_COMMAND_UNSUPPORTED_SCHEMA',
      message: `unsupported command schemaVersion ${String(value.schemaVersion)}`,
    }
  }

  for (const field of ['commandId', 'idempotencyKey', 'type'] as const) {
    if (
      typeof value[field] !== 'string' ||
      (value[field] as string).length === 0
    ) {
      return {
        ok: false,
        code: 'AI_COMMAND_INVALID',
        message: `${field} is required`,
      }
    }
  }

  const target = value.target

  if (
    typeof target !== 'object' ||
    target === null ||
    typeof (target as Record<string, unknown>).kind !== 'string' ||
    typeof (target as Record<string, unknown>).id !== 'string' ||
    ((target as Record<string, unknown>).kind as string).length === 0 ||
    ((target as Record<string, unknown>).id as string).length === 0
  ) {
    return {
      ok: false,
      code: 'AI_COMMAND_INVALID',
      message: 'target.kind and target.id are required',
    }
  }

  const expectedRevision = value.expectedRevision

  if (
    expectedRevision !== undefined &&
    (typeof expectedRevision !== 'number' ||
      !Number.isInteger(expectedRevision) ||
      expectedRevision < 0)
  ) {
    return {
      ok: false,
      code: 'AI_COMMAND_INVALID',
      message: 'expectedRevision must be a non-negative integer',
    }
  }

  if (!('payload' in value)) {
    return {
      ok: false,
      code: 'AI_COMMAND_INVALID',
      message: 'payload is required',
    }
  }

  return { ok: true, command: value as unknown as Command }
}

export const IDEMPOTENCY_KEY_REUSED = 'AI_IDEMPOTENCY_KEY_REUSED'

export type CommandAttemptDecision =
  | { kind: 'execute' }
  | { kind: 'in-flight' }
  | { kind: 'replay'; ack: CommandAck }
  | { kind: 'conflict'; ack: CommandAck }

/**
 * What a command means, independent of the tracing id: two attempts with the
 * same key must agree on this or they are not retries of one another.
 */
export function commandFingerprint(command: Command): string {
  return stableStringify({
    type: command.type,
    target: command.target,
    expectedRevision: command.expectedRevision,
    payload: command.payload,
  })
}

interface AttemptEntry {
  fingerprint: string
  ack?: CommandAck
}

export interface IdempotencyTracker {
  /** Decide what to do with an attempt before contacting the host. */
  begin: (command: Command) => CommandAttemptDecision
  /** Record the host's answer; later attempts with the key replay it. */
  acknowledge: (command: Command, ack: CommandAck) => void
  /**
   * Forget an in-flight attempt that never got an answer (transport error,
   * abort), so a retry with the same key is executed instead of waiting on
   * an attempt that will never settle.
   */
  release: (command: Command) => void
  size: () => number
}

export interface IdempotencyTrackerOptions {
  /** Maximum settled entries kept for replay, oldest evicted first. */
  limit?: number
}

export function createIdempotencyTracker(
  options: IdempotencyTrackerOptions = {},
): IdempotencyTracker {
  const limit = Math.max(1, options.limit ?? 200)
  const entries = new Map<string, AttemptEntry>()

  /** Evict settled entries only; an in-flight key must never be forgotten. */
  function evict(): void {
    if (entries.size <= limit) return

    for (const [key, entry] of entries) {
      if (entries.size <= limit) break
      if (entry.ack) entries.delete(key)
    }
  }

  return {
    begin(command: Command): CommandAttemptDecision {
      const fingerprint = commandFingerprint(command)
      const entry = entries.get(command.idempotencyKey)

      if (!entry) {
        entries.set(command.idempotencyKey, { fingerprint })
        evict()
        return { kind: 'execute' }
      }

      if (entry.fingerprint !== fingerprint) {
        return {
          kind: 'conflict',
          ack: {
            accepted: false,
            commandId: command.commandId,
            code: IDEMPOTENCY_KEY_REUSED,
            message: `idempotencyKey ${command.idempotencyKey} was already used for a different command`,
          },
        }
      }

      if (entry.ack) {
        // Same outcome, answered under the retry's tracing id.
        return {
          kind: 'replay',
          ack: { ...entry.ack, commandId: command.commandId },
        }
      }

      return { kind: 'in-flight' }
    },
    acknowledge(command: Command, ack: CommandAck): void {
      const fingerprint = commandFingerprint(command)
      const entry = entries.get(command.idempotencyKey)

      if (entry) {
        if (entry.fingerprint === fingerprint && !entry.ack) entry.ack = ack
        return
      }

      entries.set(command.idempotencyKey, { fingerprint, ack })
      evict()
    },
    release(command: Command): void {
      const entry = entries.get(command.idempotencyKey)

      if (entry && !entry.ack) entries.delete(command.idempotencyKey)
    },
    size(): number {
      return entries.size
    },
  }
}
