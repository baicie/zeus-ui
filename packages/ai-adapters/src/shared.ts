/**
 * Pieces every transport needs: reconnect backoff, abortable sleep, seq
 * verification and Ack shape checks.
 */

import type { CommandAck, HostSnapshotPayload } from '@zeus-web/ai-core'

import { abortedError, AiTransportError } from './errors'

export interface ReconnectPolicy {
  /** Delay before the first reconnect attempt. Default 250 ms. */
  initialDelayMs?: number
  /** Upper bound for the exponential backoff. Default 10 s. */
  maxDelayMs?: number
  /** Consecutive failed attempts before giving up. Default 8. */
  maxAttempts?: number
}

export type Sleep = (ms: number, signal?: AbortSignal) => Promise<void>

export function backoffDelay(attempt: number, policy: ReconnectPolicy): number {
  const initial = policy.initialDelayMs ?? 250
  const max = policy.maxDelayMs ?? 10_000

  return Math.min(max, initial * 2 ** Math.max(0, attempt - 1))
}

export const defaultSleep: Sleep = (ms, signal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortedError())
      return
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)

    function onAbort(): void {
      clearTimeout(timer)
      reject(abortedError())
    }

    signal?.addEventListener('abort', onAbort, { once: true })
  })

export type SequenceVerdict = 'next' | 'duplicate' | 'gap'

/**
 * Seq verification for one subscription. The transport delivers events in
 * order; a duplicate is dropped, and a gap makes the adapter re-subscribe
 * from the last good seq so the host replays what is missing. The store
 * still re-checks everything — this keeps the wire honest, it does not
 * replace the store's own ordering.
 */
export interface SequenceGuard {
  readonly lastSeq: number
  check: (event: unknown) => SequenceVerdict
}

export function createSequenceGuard(
  streamId: string,
  afterSeq: number,
): SequenceGuard {
  let lastSeq = afterSeq

  return {
    get lastSeq(): number {
      return lastSeq
    },
    check(event: unknown): SequenceVerdict {
      if (typeof event !== 'object' || event === null) {
        throw new AiTransportError('protocol', 'event frame is not an object')
      }

      const { streamId: eventStream, seq } = event as Record<string, unknown>

      if (eventStream !== streamId) {
        throw new AiTransportError(
          'stream-mismatch',
          `subscribed to ${streamId} but received an event of ${String(eventStream)}`,
        )
      }

      if (typeof seq !== 'number' || !Number.isInteger(seq) || seq < 1) {
        throw new AiTransportError('protocol', 'event frame has no valid seq')
      }

      if (seq <= lastSeq) return 'duplicate'
      if (seq > lastSeq + 1) return 'gap'

      lastSeq = seq
      return 'next'
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Check an Ack read off the wire and bind it to the command that asked. */
export function readCommandAck(value: unknown, commandId: string): CommandAck {
  if (!isRecord(value) || typeof value.accepted !== 'boolean') {
    throw new AiTransportError('protocol', 'command ack is malformed')
  }

  if (value.commandId !== commandId) {
    throw new AiTransportError(
      'protocol',
      `ack answers ${String(value.commandId)}, expected ${commandId}`,
    )
  }

  if (value.accepted) {
    if (typeof value.operationId !== 'string' || !value.operationId) {
      throw new AiTransportError('protocol', 'accepted ack has no operationId')
    }

    return { accepted: true, commandId, operationId: value.operationId }
  }

  if (typeof value.code !== 'string' || typeof value.message !== 'string') {
    throw new AiTransportError('protocol', 'rejected ack has no code/message')
  }

  return {
    accepted: false,
    commandId,
    code: value.code,
    message: value.message,
  }
}

export function readSnapshotPayload(value: unknown): HostSnapshotPayload {
  if (!isRecord(value) || !isRecord(value.cursors) || !isRecord(value.state)) {
    throw new AiTransportError('protocol', 'snapshot payload is malformed')
  }

  return value as unknown as HostSnapshotPayload
}
