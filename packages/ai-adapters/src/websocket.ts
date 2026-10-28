/**
 * WebSocket host adapter (AI2-111).
 *
 * One socket multiplexes commands, subscriptions and snapshot requests. Every
 * client frame carries a request `id`; the host answers with the same id.
 *
 * Client → host:
 *   `{ op: 'command', id, command }`
 *   `{ op: 'subscribe', id, streamId, afterSeq }`
 *   `{ op: 'unsubscribe', id }`
 *   `{ op: 'snapshot', id, scope }`
 *
 * Host → client:
 *   `{ op: 'ack', id, ack }`
 *   `{ op: 'event', id, event }`
 *   `{ op: 'snapshot', id, payload }`
 *   `{ op: 'error', id, code, message }`
 *
 * When the socket drops, outstanding commands and snapshot requests fail with
 * a retryable `closed` error (the caller retries with the same idempotency
 * key), and live subscriptions reconnect and re-subscribe after the last
 * verified seq. Assets are binary and are not tunnelled through the socket:
 * pass `loadAsset` (for example the SSE adapter's) to support them.
 */

import type {
  AiHostAdapter,
  AnyDomainEvent,
  AssetContent,
  AssetRef,
  Command,
  CommandAck,
  HostSnapshotPayload,
  SnapshotScope,
} from '@zeus-web/ai-core'
import type { ReconnectPolicy, Sleep } from './shared'

import { abortedError, AiTransportError } from './errors'
import {
  backoffDelay,
  createSequenceGuard,
  defaultSleep,
  readCommandAck,
  readSnapshotPayload,
} from './shared'

/** The subset of the WHATWG `WebSocket` the adapter relies on. */
export interface WebSocketLike {
  readonly readyState: number
  send: (data: string) => void
  close: (code?: number, reason?: string) => void
  addEventListener: (
    type: 'open' | 'message' | 'close' | 'error',
    listener: (event: { data?: unknown }) => void,
  ) => void
}

export type WebSocketFactory = (url: string) => WebSocketLike

export interface WebSocketHostAdapterOptions {
  url: string
  /** Defaults to the global `WebSocket`, looked up on first connect. */
  createSocket?: WebSocketFactory
  reconnect?: ReconnectPolicy
  sleep?: Sleep
  /** How long a command or snapshot may wait for its answer. Default 30 s. */
  requestTimeoutMs?: number
  loadAsset?: AiHostAdapter['loadAsset']
}

export interface WebSocketHostAdapter extends AiHostAdapter {
  /** Close the socket and end every subscription. */
  close: () => void
}

const OPEN = 1

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (error: AiTransportError) => void
  timer: ReturnType<typeof setTimeout>
}

interface LiveSubscription {
  streamId: string
  guard: ReturnType<typeof createSequenceGuard>
  push: (frame: Record<string, unknown>) => void
  fail: (error: AiTransportError) => void
  /** Socket generation the subscription was last sent on. */
  generation: number
}

function defaultFactory(url: string): WebSocketLike {
  if (typeof WebSocket !== 'function') {
    throw new AiTransportError('unsupported', 'no WebSocket implementation')
  }
  return new WebSocket(url) as unknown as WebSocketLike
}

export function createWebSocketHostAdapter(
  options: WebSocketHostAdapterOptions,
): WebSocketHostAdapter {
  const createSocket = options.createSocket ?? defaultFactory
  const policy = options.reconnect ?? {}
  const sleep = options.sleep ?? defaultSleep
  const timeoutMs = options.requestTimeoutMs ?? 30_000

  let socket: WebSocketLike | undefined
  let opening: Promise<WebSocketLike> | undefined
  let generation = 0
  let nextId = 1
  let closed = false
  const requests = new Map<string, PendingRequest>()
  const subscriptions = new Map<string, LiveSubscription>()

  function failRequests(error: AiTransportError): void {
    for (const [id, request] of requests) {
      clearTimeout(request.timer)
      request.reject(error)
      requests.delete(id)
    }
  }

  function onMessage(raw: unknown): void {
    let frame: Record<string, unknown>

    try {
      frame = JSON.parse(String(raw))
    } catch {
      return
    }

    const id = String(frame.id)
    const request = requests.get(id)

    if (request) {
      requests.delete(id)
      clearTimeout(request.timer)

      if (frame.op === 'error') {
        request.reject(
          new AiTransportError(
            'protocol',
            `${String(frame.code)}: ${String(frame.message)}`,
          ),
        )
      } else {
        request.resolve(frame)
      }
      return
    }

    subscriptions.get(id)?.push(frame)
  }

  function connect(): Promise<WebSocketLike> {
    if (closed) return Promise.reject(new AiTransportError('closed', 'closed'))
    if (socket && socket.readyState === OPEN) return Promise.resolve(socket)
    if (opening) return opening

    opening = new Promise<WebSocketLike>((resolve, reject) => {
      let next: WebSocketLike

      try {
        next = createSocket(options.url)
      } catch (error) {
        opening = undefined
        reject(
          error instanceof AiTransportError
            ? error
            : new AiTransportError('network', 'cannot open socket', {
                retryable: true,
                cause: error,
              }),
        )
        return
      }

      let settled = false

      next.addEventListener('open', () => {
        settled = true
        socket = next
        opening = undefined
        generation += 1
        resolve(next)
      })
      next.addEventListener('message', event => onMessage(event.data))
      next.addEventListener('close', () => {
        if (socket === next) socket = undefined
        failRequests(
          new AiTransportError('closed', 'socket closed', { retryable: true }),
        )
        for (const subscription of subscriptions.values()) {
          subscription.push({ op: '__closed' })
        }
        if (!settled) {
          settled = true
          opening = undefined
          reject(
            new AiTransportError('network', 'socket failed to open', {
              retryable: true,
            }),
          )
        }
      })
    })

    return opening
  }

  async function call(
    frame: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<Record<string, unknown>> {
    if (signal?.aborted) throw abortedError()

    const active = await connect()
    const id = String(nextId++)

    return new Promise<Record<string, unknown>>((resolve, reject) => {
      const onAbort = (): void => {
        const request = requests.get(id)
        if (!request) return
        requests.delete(id)
        clearTimeout(request.timer)
        reject(abortedError())
      }

      requests.set(id, {
        resolve: value => {
          signal?.removeEventListener('abort', onAbort)
          resolve(value as Record<string, unknown>)
        },
        reject: error => {
          signal?.removeEventListener('abort', onAbort)
          reject(error)
        },
        timer: setTimeout(() => {
          requests.delete(id)
          reject(
            new AiTransportError(
              'timeout',
              `no answer to ${String(frame.op)}`,
              {
                retryable: true,
              },
            ),
          )
        }, timeoutMs),
      })
      signal?.addEventListener('abort', onAbort, { once: true })
      active.send(JSON.stringify({ ...frame, id }))
    })
  }

  return {
    async execute(command: Command, signal?: AbortSignal): Promise<CommandAck> {
      const answer = await call({ op: 'command', command }, signal)

      if (answer.op !== 'ack') {
        throw new AiTransportError(
          'protocol',
          `expected ack, got ${String(answer.op)}`,
        )
      }

      return readCommandAck(answer.ack, command.commandId)
    },

    subscribe(
      streamId: string,
      afterSeq: number,
      signal?: AbortSignal,
    ): AsyncIterable<AnyDomainEvent> {
      async function* iterate(): AsyncGenerator<AnyDomainEvent> {
        let id = `sub-${nextId++}`
        const queue: Record<string, unknown>[] = []
        let wake: (() => void) | undefined
        let failure: AiTransportError | undefined
        const subscription: LiveSubscription = {
          streamId,
          guard: createSequenceGuard(streamId, afterSeq),
          generation: -1,
          push(frame) {
            queue.push(frame)
            wake?.()
          },
          fail(error) {
            failure = error
            wake?.()
          },
        }
        const onAbort = (): void => wake?.()
        signal?.addEventListener('abort', onAbort, { once: true })
        subscriptions.set(id, subscription)

        let failures = 0

        async function send(): Promise<void> {
          const active = await connect()
          // A fresh id per (re)subscribe: frames still in flight for the
          // previous one must not be mistaken for this stream's next seq.
          subscriptions.delete(id)
          id = `sub-${nextId++}`
          subscriptions.set(id, subscription)
          subscription.generation = generation
          active.send(
            JSON.stringify({
              op: 'subscribe',
              id,
              streamId,
              afterSeq: subscription.guard.lastSeq,
            }),
          )
        }

        async function resubscribe(reason: unknown): Promise<void> {
          for (;;) {
            failures += 1
            if (failures > (policy.maxAttempts ?? 8)) {
              throw new AiTransportError(
                'reconnect-exhausted',
                `gave up on stream ${streamId}`,
                { cause: reason },
              )
            }
            await sleep(backoffDelay(failures, policy), signal)
            try {
              await send()
              return
            } catch (error) {
              if (error instanceof AiTransportError && !error.retryable)
                throw error
              reason = error
            }
          }
        }

        try {
          try {
            await send()
          } catch (error) {
            if (error instanceof AiTransportError && !error.retryable)
              throw error
            await resubscribe(error)
          }

          for (;;) {
            if (signal?.aborted || closed) return
            if (failure) throw failure

            const frame = queue.shift()

            if (!frame) {
              await new Promise<void>(resolve => {
                wake = resolve
              })
              wake = undefined
              continue
            }

            if (frame.op === '__closed') {
              await resubscribe(new AiTransportError('closed', 'socket closed'))
              continue
            }

            if (frame.op === 'error') {
              throw new AiTransportError(
                'protocol',
                `${String(frame.code)}: ${String(frame.message)}`,
              )
            }

            if (frame.op !== 'event') continue

            const verdict = subscription.guard.check(frame.event)

            if (verdict === 'duplicate') continue
            if (verdict === 'gap') {
              // Ask the host to replay from the last verified seq.
              queue.length = 0
              socket?.send(JSON.stringify({ op: 'unsubscribe', id }))
              await resubscribe(
                new AiTransportError('protocol', `gap on ${streamId}`),
              )
              continue
            }

            failures = 0
            yield frame.event as AnyDomainEvent
          }
        } catch (error) {
          if (signal?.aborted && (error as AiTransportError).code === 'aborted')
            return
          throw error
        } finally {
          signal?.removeEventListener('abort', onAbort)
          subscriptions.delete(id)
          if (socket && socket.readyState === OPEN) {
            socket.send(JSON.stringify({ op: 'unsubscribe', id }))
          }
        }
      }

      return iterate()
    },

    async getSnapshot(
      scope: SnapshotScope,
      signal?: AbortSignal,
    ): Promise<HostSnapshotPayload> {
      const answer = await call({ op: 'snapshot', scope }, signal)

      if (answer.op !== 'snapshot') {
        throw new AiTransportError(
          'protocol',
          `expected snapshot, got ${String(answer.op)}`,
        )
      }

      return readSnapshotPayload(answer.payload)
    },

    loadAsset(asset: AssetRef, signal?: AbortSignal): Promise<AssetContent> {
      if (options.loadAsset) return options.loadAsset(asset, signal)

      return Promise.reject(
        new AiTransportError(
          'unsupported',
          'assets are not transferred over the WebSocket adapter',
        ),
      )
    },

    close(): void {
      closed = true
      failRequests(new AiTransportError('closed', 'adapter closed'))
      for (const subscription of subscriptions.values()) {
        subscription.fail(new AiTransportError('closed', 'adapter closed'))
      }
      socket?.close(1000, 'client closed')
      socket = undefined
    },
  }
}
