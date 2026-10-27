/**
 * Command envelope, acknowledgement and idempotency (AI2-105).
 *
 * `accepted: true` only means the host accepted the intent. It is never proof
 * that the side effect happened: success or failure arrives later as domain
 * events. Retries must reuse `idempotencyKey`; `commandId` is for tracing and
 * may change between attempts.
 */

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
    typeof (target as Record<string, unknown>).id !== 'string'
  ) {
    return {
      ok: false,
      code: 'AI_COMMAND_INVALID',
      message: 'target.kind and target.id are required',
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

export type CommandAttemptDecision =
  | { kind: 'execute' }
  | { kind: 'in-flight' }
  | { kind: 'replay'; ack: CommandAck }

interface AttemptEntry {
  ack?: CommandAck
}

export interface IdempotencyTracker {
  begin: (command: Command) => CommandAttemptDecision
  acknowledge: (command: Command, ack: CommandAck) => void
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

  return {
    begin(command: Command): CommandAttemptDecision {
      const entry = entries.get(command.idempotencyKey)

      if (!entry) {
        entries.set(command.idempotencyKey, {})

        while (entries.size > limit) {
          const oldest = entries.keys().next()
          if (oldest.done) break
          entries.delete(oldest.value)
        }

        return { kind: 'execute' }
      }

      if (entry.ack) return { kind: 'replay', ack: entry.ack }

      return { kind: 'in-flight' }
    },
    acknowledge(command: Command, ack: CommandAck): void {
      const entry = entries.get(command.idempotencyKey)

      if (entry) {
        entry.ack = ack
        return
      }

      entries.set(command.idempotencyKey, { ack })
    },
    size(): number {
      return entries.size
    },
  }
}
