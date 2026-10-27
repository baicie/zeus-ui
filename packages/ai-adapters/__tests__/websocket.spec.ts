import type { AnyDomainEvent } from '@zeus-web/ai-core'
import type { WebSocketLike } from '../src/websocket'

import { createCommand, createS1ChatScenario } from '@zeus-web/ai-core'
import { describe, expect, it } from 'vitest'
import { createWebSocketHostAdapter } from '../src/websocket'

const events = createS1ChatScenario().events
const streamId = events[0].streamId
const tick = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0))

type Listener = (event: { data?: unknown }) => void

/** In-memory host on the other end of a fake socket. */
function createFakeServer(
  options: { dropSeq?: number; ackDelay?: boolean } = {},
) {
  const sockets: FakeSocket[] = []
  const received: Record<string, unknown>[] = []
  let dropped = false

  class FakeSocket implements WebSocketLike {
    readyState = 0
    listeners = new Map<string, Listener[]>()

    constructor() {
      sockets.push(this)
      setTimeout(() => {
        this.readyState = 1
        this.emit('open', {})
      }, 0)
    }

    addEventListener(type: string, listener: Listener): void {
      this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
    }

    emit(type: string, event: { data?: unknown }): void {
      for (const listener of this.listeners.get(type) ?? []) listener(event)
    }

    reply(frame: Record<string, unknown>): void {
      this.emit('message', { data: JSON.stringify(frame) })
    }

    send(data: string): void {
      const frame = JSON.parse(data)
      received.push(frame)

      if (frame.op === 'command' && !options.ackDelay) {
        this.reply({
          op: 'ack',
          id: frame.id,
          ack: {
            accepted: true,
            commandId: frame.command.commandId,
            operationId: 'op-1',
          },
        })
      }
      if (frame.op === 'snapshot') {
        this.reply({
          op: 'snapshot',
          id: frame.id,
          payload: { cursors: {}, state: {} },
        })
      }
      if (frame.op === 'subscribe') {
        // One event per tick, and nothing after the socket closed, like a
        // real connection that drops mid-stream.
        const queue = events.filter(event => event.seq > frame.afterSeq)
        const pump = (): void => {
          const event = queue.shift()
          if (!event || this.readyState !== 1) return
          if (event.seq === options.dropSeq && !dropped) {
            dropped = true
          } else {
            this.reply({ op: 'event', id: frame.id, event })
          }
          setTimeout(pump, 0)
        }
        setTimeout(pump, 0)
      }
    }

    close(): void {
      this.readyState = 3
      this.emit('close', {})
    }
  }

  return {
    sockets,
    received,
    createSocket: (): WebSocketLike => new FakeSocket(),
  }
}

async function collect(
  iterable: AsyncIterable<AnyDomainEvent>,
  limit: number,
  onEvent?: (seq: number) => void,
): Promise<number[]> {
  const seqs: number[] = []
  for await (const event of iterable) {
    seqs.push(event.seq)
    onEvent?.(event.seq)
    if (seqs.length >= limit) break
  }
  return seqs
}

const command = createCommand({
  commandId: 'cmd-1',
  idempotencyKey: 'key-1',
  type: 'message.send',
  target: { kind: 'conversation', id: 'conv-1' },
  payload: {},
})

describe('websocket host adapter', () => {
  it('correlates acks and snapshots by request id', async () => {
    const server = createFakeServer()
    const adapter = createWebSocketHostAdapter({
      url: 'ws://host',
      createSocket: server.createSocket,
    })

    await expect(adapter.execute(command)).resolves.toMatchObject({
      accepted: true,
      operationId: 'op-1',
    })
    await expect(
      adapter.getSnapshot({ kind: 'conversation', id: 'c' }),
    ).resolves.toEqual({
      cursors: {},
      state: {},
    })
    expect(server.sockets).toHaveLength(1)
    adapter.close()
  })

  it('fails an outstanding command with a retryable error when the socket drops', async () => {
    const server = createFakeServer({ ackDelay: true })
    const adapter = createWebSocketHostAdapter({
      url: 'ws://host',
      createSocket: server.createSocket,
    })
    const pending = adapter.execute(command)

    await tick()
    await tick()
    server.sockets[0].close()

    await expect(pending).rejects.toMatchObject({
      code: 'closed',
      retryable: true,
    })
    adapter.close()
  })

  it('times out a command the host never answers', async () => {
    const server = createFakeServer({ ackDelay: true })
    const adapter = createWebSocketHostAdapter({
      url: 'ws://host',
      createSocket: server.createSocket,
      requestTimeoutMs: 5,
    })

    await expect(adapter.execute(command)).rejects.toMatchObject({
      code: 'timeout',
    })
    adapter.close()
  })

  it('re-subscribes after a reconnect from the last verified seq', async () => {
    const server = createFakeServer()
    const adapter = createWebSocketHostAdapter({
      url: 'ws://host',
      createSocket: server.createSocket,
      sleep: () => Promise.resolve(),
    })

    const seqs = await collect(
      adapter.subscribe(streamId, 0),
      events.length,
      seq => {
        if (seq === 2) server.sockets[0].close()
      },
    )

    expect(seqs).toEqual(events.map(event => event.seq))
    const subscribes = server.received.filter(frame => frame.op === 'subscribe')
    expect(subscribes.map(frame => frame.afterSeq)).toEqual([0, 2])
    adapter.close()
  })

  it('asks the host to replay when the wire skips a seq', async () => {
    const server = createFakeServer({ dropSeq: 2 })
    const adapter = createWebSocketHostAdapter({
      url: 'ws://host',
      createSocket: server.createSocket,
      sleep: () => Promise.resolve(),
    })

    expect(await collect(adapter.subscribe(streamId, 0), 3)).toEqual([1, 2, 3])
    expect(
      server.received
        .filter(frame => frame.op === 'subscribe')
        .map(frame => frame.afterSeq),
    ).toEqual([0, 1])
    adapter.close()
  })

  it('does not tunnel assets unless a loader is given', async () => {
    const adapter = createWebSocketHostAdapter({
      url: 'ws://host',
      createSocket: createFakeServer().createSocket,
    })

    await expect(
      adapter.loadAsset({ id: 'a', mimeType: 'image/png' }),
    ).rejects.toMatchObject({
      code: 'unsupported',
    })
  })
})
