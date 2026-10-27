/**
 * Server-Sent Events host adapter (AI2-111).
 *
 * HTTP layout (relative to `baseUrl`):
 *
 * | Operation     | Request                                                   |
 * | ------------- | --------------------------------------------------------- |
 * | `execute`     | `POST /commands` with the command as JSON → `CommandAck`  |
 * | `subscribe`   | `GET /streams/:streamId/events?after=N` (`text/event-stream`, `Last-Event-ID: N`) |
 * | `getSnapshot` | `GET /snapshots?kind=&id=` → `HostSnapshotPayload`        |
 * | `loadAsset`   | `GET /assets/:assetId` → bytes                            |
 *
 * Each SSE `data:` field carries one `DomainEvent` as JSON. Reconnects resume
 * after the last verified seq; a gap re-requests from there, so the host
 * replays what is missing instead of the client skipping it.
 *
 * Credentials never live here: `headers()` is called per request so the
 * application can hand in a fresh token from its own session.
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

import { AiTransportError, isRetryableStatus } from './errors'
import {
  backoffDelay,
  createSequenceGuard,
  defaultSleep,
  readCommandAck,
  readSnapshotPayload,
} from './shared'

export type FetchLike = (
  input: string,
  init: {
    method: string
    headers: Record<string, string>
    body?: string
    signal?: AbortSignal
  },
) => Promise<Response>

export interface SseHostAdapterOptions {
  /** Base URL without a trailing slash, e.g. `https://host/ai/v2`. */
  baseUrl: string
  /** Defaults to the global `fetch`, looked up per call (SSR-safe import). */
  fetch?: FetchLike
  /** Extra headers per request, e.g. a short-lived bearer token. */
  headers?: () => Record<string, string>
  reconnect?: ReconnectPolicy
  sleep?: Sleep
}

export interface SseFrame {
  id?: string
  event?: string
  data: string
}

/**
 * Incremental SSE parser (WHATWG `text/event-stream`). Feed it decoded text in
 * any chunking; it returns the frames completed so far.
 */
export function createSseParser(): {
  push: (chunk: string) => SseFrame[]
} {
  let buffer = ''
  let data: string[] = []
  let id: string | undefined
  let event: string | undefined

  function dispatch(frames: SseFrame[]): void {
    if (data.length > 0) frames.push({ id, event, data: data.join('\n') })
    data = []
    event = undefined
  }

  return {
    push(chunk: string): SseFrame[] {
      let text = buffer + chunk
      // A trailing CR may be the first half of CRLF split across chunks; keep
      // it back so the next chunk's LF does not produce a phantom blank line.
      const heldCr = text.endsWith('\r') ? '\r' : ''
      if (heldCr) text = text.slice(0, -1)

      const frames: SseFrame[] = []
      const lines = text.split(/\r\n|\r|\n/)
      // The last element is an incomplete line (or '' after a newline).
      buffer = (lines.pop() ?? '') + heldCr

      for (const line of lines) {
        if (line === '') {
          dispatch(frames)
          continue
        }
        if (line.startsWith(':')) continue

        const colon = line.indexOf(':')
        const field = colon < 0 ? line : line.slice(0, colon)
        let value = colon < 0 ? '' : line.slice(colon + 1)
        if (value.startsWith(' ')) value = value.slice(1)

        if (field === 'data') data.push(value)
        else if (field === 'id') id = value
        else if (field === 'event') event = value
      }

      return frames
    },
  }
}

function resolveFetch(option: FetchLike | undefined): FetchLike {
  if (option) return option
  if (typeof fetch !== 'function') {
    throw new AiTransportError('unsupported', 'no fetch implementation')
  }
  return fetch as unknown as FetchLike
}

function isAbort(error: unknown, signal?: AbortSignal): boolean {
  return (
    signal?.aborted === true ||
    (error instanceof Error && error.name === 'AbortError')
  )
}

export function createSseHostAdapter(
  options: SseHostAdapterOptions,
): AiHostAdapter {
  const baseUrl = options.baseUrl.replace(/\/+$/, '')
  const policy = options.reconnect ?? {}
  const sleep = options.sleep ?? defaultSleep

  function headers(extra: Record<string, string>): Record<string, string> {
    return { ...(options.headers?.() ?? {}), ...extra }
  }

  async function request(
    path: string,
    init: { method: string; body?: string; accept: string },
    signal?: AbortSignal,
  ): Promise<Response> {
    try {
      return await resolveFetch(options.fetch)(`${baseUrl}${path}`, {
        method: init.method,
        headers: headers(
          init.body === undefined
            ? { Accept: init.accept }
            : { Accept: init.accept, 'Content-Type': 'application/json' },
        ),
        body: init.body,
        signal,
      })
    } catch (error) {
      if (isAbort(error, signal)) {
        throw new AiTransportError('aborted', 'request was aborted', {
          cause: error,
        })
      }
      throw new AiTransportError('network', `request to ${path} failed`, {
        retryable: true,
        cause: error,
      })
    }
  }

  async function readJson(response: Response, path: string): Promise<unknown> {
    try {
      return await response.json()
    } catch (error) {
      throw new AiTransportError('protocol', `${path} returned invalid JSON`, {
        status: response.status,
        cause: error,
      })
    }
  }

  async function* readEvents(
    response: Response,
    signal?: AbortSignal,
  ): AsyncGenerator<unknown> {
    const body = response.body

    if (!body) {
      throw new AiTransportError('protocol', 'event stream has no body')
    }

    const reader = body.getReader()
    const decoder = new TextDecoder()
    const parser = createSseParser()

    try {
      for (;;) {
        if (signal?.aborted) return

        let chunk: ReadableStreamReadResult<Uint8Array>
        try {
          chunk = await reader.read()
        } catch (error) {
          if (isAbort(error, signal)) return
          throw new AiTransportError('network', 'event stream broke', {
            retryable: true,
            cause: error,
          })
        }

        if (chunk.done) return

        for (const frame of parser.push(
          decoder.decode(chunk.value, { stream: true }),
        )) {
          if (frame.event !== undefined && frame.event !== 'message') {
            // Only domain events travel on the default channel; keep-alives
            // and vendor extensions are not the client's business.
            if (frame.event !== 'ai-event') continue
          }
          try {
            yield JSON.parse(frame.data)
          } catch (error) {
            throw new AiTransportError('protocol', 'event frame is not JSON', {
              cause: error,
            })
          }
        }
      }
    } finally {
      reader.cancel().catch(() => {})
    }
  }

  return {
    async execute(command: Command, signal?: AbortSignal): Promise<CommandAck> {
      const response = await request(
        '/commands',
        {
          method: 'POST',
          body: JSON.stringify(command),
          accept: 'application/json',
        },
        signal,
      )

      if (response.ok) {
        return readCommandAck(
          await readJson(response, '/commands'),
          command.commandId,
        )
      }

      // A refusal may still come back as a well-formed rejected Ack.
      const body = await response.json().catch(() => undefined)

      if (body && (body as { accepted?: unknown }).accepted === false) {
        return readCommandAck(body, command.commandId)
      }

      throw new AiTransportError(
        'http',
        `POST /commands answered ${response.status}`,
        {
          status: response.status,
          retryable: isRetryableStatus(response.status),
        },
      )
    },

    subscribe(
      streamId: string,
      afterSeq: number,
      signal?: AbortSignal,
    ): AsyncIterable<AnyDomainEvent> {
      async function* iterate(): AsyncGenerator<AnyDomainEvent> {
        const guard = createSequenceGuard(streamId, afterSeq)
        let failures = 0
        let lastError: unknown

        for (;;) {
          if (signal?.aborted) return

          const after = guard.lastSeq
          const path = `/streams/${encodeURIComponent(streamId)}/events?after=${after}`
          let gap = false

          try {
            const response = await resolveFetch(options.fetch)(
              `${baseUrl}${path}`,
              {
                method: 'GET',
                headers: headers({
                  Accept: 'text/event-stream',
                  'Last-Event-ID': String(after),
                }),
                signal,
              },
            )

            if (!response.ok) {
              const retryable = isRetryableStatus(response.status)
              const error = new AiTransportError(
                'http',
                `GET ${path} answered ${response.status}`,
                { status: response.status, retryable },
              )
              if (!retryable) throw error
              lastError = error
            } else {
              for await (const event of readEvents(response, signal)) {
                const verdict = guard.check(event)

                if (verdict === 'duplicate') continue
                if (verdict === 'gap') {
                  gap = true
                  break
                }

                failures = 0
                yield event as AnyDomainEvent
              }

              if (signal?.aborted) return
              lastError = new AiTransportError(
                gap ? 'protocol' : 'closed',
                gap
                  ? `stream ${streamId} skipped past seq ${guard.lastSeq + 1}`
                  : `stream ${streamId} closed`,
                { retryable: true },
              )
            }
          } catch (error) {
            if (isAbort(error, signal)) return
            if (error instanceof AiTransportError && !error.retryable)
              throw error
            lastError = error
          }

          failures += 1

          if (failures > (policy.maxAttempts ?? 8)) {
            throw new AiTransportError(
              'reconnect-exhausted',
              `gave up on stream ${streamId} after ${failures - 1} reconnects`,
              { cause: lastError },
            )
          }

          try {
            await sleep(backoffDelay(failures, policy), signal)
          } catch {
            return
          }
        }
      }

      return iterate()
    },

    async getSnapshot(
      scope: SnapshotScope,
      signal?: AbortSignal,
    ): Promise<HostSnapshotPayload> {
      const path = `/snapshots?kind=${encodeURIComponent(scope.kind)}&id=${encodeURIComponent(scope.id)}`
      const response = await request(
        path,
        { method: 'GET', accept: 'application/json' },
        signal,
      )

      if (!response.ok) {
        throw new AiTransportError(
          'http',
          `GET /snapshots answered ${response.status}`,
          {
            status: response.status,
            retryable: isRetryableStatus(response.status),
          },
        )
      }

      return readSnapshotPayload(await readJson(response, '/snapshots'))
    },

    async loadAsset(
      asset: AssetRef,
      signal?: AbortSignal,
    ): Promise<AssetContent> {
      const path = `/assets/${encodeURIComponent(asset.id)}`
      const response = await request(
        path,
        { method: 'GET', accept: asset.mimeType },
        signal,
      )

      if (!response.ok) {
        throw new AiTransportError(
          'http',
          `GET ${path} answered ${response.status}`,
          {
            status: response.status,
            retryable: isRetryableStatus(response.status),
          },
        )
      }

      return response.body ?? new Uint8Array(await response.arrayBuffer())
    },
  }
}
