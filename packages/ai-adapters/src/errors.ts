/**
 * Transport errors shared by every adapter.
 *
 * A thrown {@link AiTransportError} means "no authoritative answer was
 * received". It is never a rejected command: a host refusal comes back as a
 * `CommandAck` with `accepted: false`. Callers use `retryable` to decide
 * whether retrying with the same `idempotencyKey` makes sense.
 */

export type AiTransportErrorCode =
  /** The request never reached the host or the connection dropped. */
  | 'network'
  /** The host answered with an HTTP status that carries no protocol body. */
  | 'http'
  /** The caller aborted. */
  | 'aborted'
  /** The host sent something that is not valid protocol framing. */
  | 'protocol'
  /** An event claimed a different stream than the one subscribed. */
  | 'stream-mismatch'
  /** The connection closed while a request was outstanding. */
  | 'closed'
  /** Reconnecting failed too many times in a row. */
  | 'reconnect-exhausted'
  /** The adapter cannot perform this operation (e.g. assets over WebSocket). */
  | 'unsupported'
  /** The host did not answer in time. */
  | 'timeout'

export interface AiTransportErrorOptions {
  status?: number
  retryable?: boolean
  cause?: unknown
}

export class AiTransportError extends Error {
  readonly code: AiTransportErrorCode
  readonly status?: number
  readonly retryable: boolean
  readonly cause?: unknown

  constructor(
    code: AiTransportErrorCode,
    message: string,
    options: AiTransportErrorOptions = {},
  ) {
    super(`[AI_TRANSPORT_${code.toUpperCase().replace(/-/g, '_')}] ${message}`)
    this.name = 'AiTransportError'
    this.code = code
    this.status = options.status
    this.retryable = options.retryable ?? false
    this.cause = options.cause
  }
}

export function isAiTransportError(error: unknown): error is AiTransportError {
  return error instanceof AiTransportError
}

export function abortedError(): AiTransportError {
  return new AiTransportError('aborted', 'operation was aborted')
}

/** HTTP statuses worth retrying: timeouts, throttling and server faults. */
export function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500
}
