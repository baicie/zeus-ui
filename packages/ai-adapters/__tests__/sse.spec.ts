import type { AnyDomainEvent } from '@zeus-web/ai-core'
import type { FetchLike } from '../src/sse'

import {
  createAiStore,
  createCommand,
  createMockHost,
  createS1ChatScenario,
} from '@zeus-web/ai-core'
import { describe, expect, it } from 'vitest'
import { AiTransportError } from '../src/errors'
import { createSseHostAdapter, createSseParser } from '../src/sse'

const noSleep = (): Promise<void> => Promise.resolve()

function sseBody(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
}

function frames(events: readonly unknown[]): string {
  return events
    .map(
      event =>
        `id: ${(event as { seq: number }).seq}\ndata: ${JSON.stringify(event)}\n\n`,
    )
    .join('')
}

interface Call {
  url: string
  method: string
  headers: Record<string, string>
  body?: string
}

/** A fetch whose event stream is served from a list of recorded events. */
function fakeHost(
  events: readonly AnyDomainEvent[],
  options: {
    /** Per connection, cut the stream after N events (then close). */
    cutAfter?: number[]
    /** Per connection, drop the event at this index (simulates a gap). */
    dropIndex?: number[]
    status?: number[]
  } = {},
) {
  const calls: Call[] = []
  let connection = 0

  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({
      url,
      method: init.method,
      headers: init.headers,
      body: init.body,
    })

    if (url.includes('/events')) {
      const index = connection++
      const status = options.status?.[index]
      if (status && status !== 200) return new Response('', { status })

      const after = Number(new URL(url).searchParams.get('after'))
      let pending = events.filter(event => event.seq > after)
      const drop = options.dropIndex?.[index]
      if (drop !== undefined) pending = pending.filter((_, i) => i !== drop)
      const cut = options.cutAfter?.[index]
      if (cut !== undefined) pending = pending.slice(0, cut)

      return new Response(sseBody([': keep-alive\n\n', frames(pending)]), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    }

    return new Response('{}', { status: 404 })
  }

  return { fetchImpl, calls }
}

async function collect(
  iterable: AsyncIterable<AnyDomainEvent>,
  limit: number,
): Promise<number[]> {
  const seqs: number[] = []
  for await (const event of iterable) {
    seqs.push(event.seq)
    if (seqs.length >= limit) break
  }
  return seqs
}

describe('sse parser', () => {
  it('handles arbitrary chunking, CRLF, comments and multi-line data', () => {
    const parser = createSseParser()
    const text =
      ': hi\r\nid: 1\r\ndata: {"a":\r\ndata: 1}\r\n\r\nevent: ai-event\ndata: x\n\n'
    const out = []
    for (const char of text) out.push(...parser.push(char))

    expect(out).toEqual([
      { id: '1', event: undefined, data: '{"a":\n1}' },
      { id: '1', event: 'ai-event', data: 'x' },
    ])
  })
})

describe('sse host adapter · commands', () => {
  const command = createCommand({
    commandId: 'cmd-1',
    idempotencyKey: 'key-1',
    type: 'message.send',
    target: { kind: 'conversation', id: 'conv-1' },
    payload: { text: 'hi' },
  })

  it('posts the command with caller headers and returns the ack', async () => {
    const calls: Call[] = []
    const adapter = createSseHostAdapter({
      baseUrl: 'https://host/ai/',
      headers: () => ({ Authorization: 'Bearer t' }),
      fetch: async (url, init) => {
        calls.push({
          url,
          method: init.method,
          headers: init.headers,
          body: init.body,
        })
        return Response.json({
          accepted: true,
          commandId: 'cmd-1',
          operationId: 'op-9',
        })
      },
    })

    await expect(adapter.execute(command)).resolves.toEqual({
      accepted: true,
      commandId: 'cmd-1',
      operationId: 'op-9',
    })
    expect(calls[0]).toMatchObject({
      url: 'https://host/ai/commands',
      method: 'POST',
      headers: {
        Authorization: 'Bearer t',
        'Content-Type': 'application/json',
      },
    })
    expect(JSON.parse(calls[0].body as string).idempotencyKey).toBe('key-1')
  })

  it('returns a host refusal as a rejected ack, not an error', async () => {
    const adapter = createSseHostAdapter({
      baseUrl: 'https://host',
      fetch: async () =>
        Response.json(
          {
            accepted: false,
            commandId: 'cmd-1',
            code: 'AI_FORBIDDEN',
            message: 'no',
          },
          { status: 403 },
        ),
    })

    await expect(adapter.execute(command)).resolves.toMatchObject({
      accepted: false,
      code: 'AI_FORBIDDEN',
    })
  })

  it('classifies transport failures and malformed acks', async () => {
    const fail = (impl: FetchLike) =>
      createSseHostAdapter({ baseUrl: 'https://host', fetch: impl }).execute(
        command,
      )

    await expect(
      fail(async () => new Response('', { status: 503 })),
    ).rejects.toMatchObject({
      code: 'http',
      status: 503,
      retryable: true,
    })
    await expect(
      fail(async () => {
        throw new TypeError('offline')
      }),
    ).rejects.toMatchObject({ code: 'network', retryable: true })
    await expect(
      fail(async () =>
        Response.json({ accepted: true, commandId: 'other', operationId: 'x' }),
      ),
    ).rejects.toMatchObject({ code: 'protocol' })
  })
})

describe('sse host adapter · subscribe', () => {
  const events = createS1ChatScenario().events
  const streamId = events[0].streamId

  it('resumes after the given cursor and sends Last-Event-ID', async () => {
    const { fetchImpl, calls } = fakeHost(events)
    const adapter = createSseHostAdapter({
      baseUrl: 'https://host',
      fetch: fetchImpl,
    })

    expect(await collect(adapter.subscribe(streamId, 2, undefined), 3)).toEqual(
      [3, 4, 5],
    )
    expect(calls[0].url).toContain('after=2')
    expect(calls[0].headers['Last-Event-ID']).toBe('2')
  })

  it('reconnects after a dropped stream from the last verified seq', async () => {
    const { fetchImpl, calls } = fakeHost(events, { cutAfter: [2] })
    const adapter = createSseHostAdapter({
      baseUrl: 'https://host',
      fetch: fetchImpl,
      sleep: noSleep,
    })

    expect(
      await collect(adapter.subscribe(streamId, 0), events.length),
    ).toEqual(events.map(event => event.seq))
    expect(
      calls.filter(call => call.url.includes('/events')).map(call => call.url),
    ).toEqual([
      `https://host/streams/${streamId}/events?after=0`,
      `https://host/streams/${streamId}/events?after=2`,
    ])
  })

  it('re-requests from the last good seq when the wire skips one', async () => {
    const { fetchImpl, calls } = fakeHost(events, { dropIndex: [1] })
    const adapter = createSseHostAdapter({
      baseUrl: 'https://host',
      fetch: fetchImpl,
      sleep: noSleep,
    })

    expect(await collect(adapter.subscribe(streamId, 0), 3)).toEqual([1, 2, 3])
    expect(calls[1].url).toContain('after=1')
  })

  it('stops on non-retryable statuses and on a foreign stream', async () => {
    const unauthorized = createSseHostAdapter({
      baseUrl: 'https://host',
      fetch: fakeHost(events, { status: [401] }).fetchImpl,
    })
    await expect(
      collect(unauthorized.subscribe(streamId, 0), 1),
    ).rejects.toMatchObject({
      code: 'http',
      status: 401,
    })

    const foreign = createSseHostAdapter({
      baseUrl: 'https://host',
      fetch: fakeHost(events).fetchImpl,
    })
    await expect(
      collect(foreign.subscribe('other-stream', 0), 1),
    ).rejects.toMatchObject({
      code: 'stream-mismatch',
    })
  })

  it('gives up after the reconnect budget', async () => {
    const adapter = createSseHostAdapter({
      baseUrl: 'https://host',
      fetch: fakeHost(events, { status: [503, 503, 503] }).fetchImpl,
      sleep: noSleep,
      reconnect: { maxAttempts: 2 },
    })

    const error = await collect(adapter.subscribe(streamId, 0), 1).catch(e => e)

    expect(error).toBeInstanceOf(AiTransportError)
    expect(error.code).toBe('reconnect-exhausted')
  })

  it('ends quietly when the caller aborts', async () => {
    const controller = new AbortController()
    const adapter = createSseHostAdapter({
      baseUrl: 'https://host',
      fetch: fakeHost(events, { cutAfter: [1, 1, 1] }).fetchImpl,
      sleep: (_ms, signal) =>
        new Promise((_resolve, reject) =>
          signal?.addEventListener('abort', () => reject(new Error('aborted'))),
        ),
    })
    const seqs: number[] = []
    const done = (async () => {
      for await (const event of adapter.subscribe(
        streamId,
        0,
        controller.signal,
      )) {
        seqs.push(event.seq)
        controller.abort()
      }
    })()

    await expect(done).resolves.toBeUndefined()
    expect(seqs).toEqual([1])
  })

  it('feeds a store to the same state as the host recorded', async () => {
    const host = createMockHost({ streamId })
    for (const event of events)
      host.emitForEntity(event.type, event.entity, event.payload)

    const adapter = createSseHostAdapter({
      baseUrl: 'https://host',
      fetch: fakeHost(host.events(), { cutAfter: [3] }).fetchImpl,
      sleep: noSleep,
    })
    const store = createAiStore({ streamId })
    let count = 0
    for await (const event of adapter.subscribe(streamId, store.getCursor())) {
      store.ingest(event)
      if (++count === events.length) break
    }

    const expected = createAiStore({ streamId })
    for (const event of events) expected.ingest(event)

    expect(store.exportSnapshot('t').checksum).toBe(
      expected.exportSnapshot('t').checksum,
    )
  })
})

describe('sse host adapter · snapshots and assets', () => {
  it('loads a host snapshot and asset bytes', async () => {
    const adapter = createSseHostAdapter({
      baseUrl: 'https://host',
      fetch: async url =>
        url.includes('/snapshots')
          ? Response.json({ cursors: { s: 1 }, state: {} })
          : new Response(new Uint8Array([1, 2, 3])),
    })

    await expect(
      adapter.getSnapshot({ kind: 'conversation', id: 'c' }),
    ).resolves.toEqual({
      cursors: { s: 1 },
      state: {},
    })
    const asset = await adapter.loadAsset({ id: 'a', mimeType: 'text/plain' })
    const bytes =
      asset instanceof Uint8Array
        ? asset
        : new Uint8Array(await new Response(asset).arrayBuffer())
    expect([...bytes]).toEqual([1, 2, 3])
  })
})
