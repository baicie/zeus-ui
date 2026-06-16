import { describe, expect, it } from 'vitest'

import {
  createMockAgentProvider,
  createReplayAgentProvider,
} from '../src/provider'

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = []

  for await (const item of iterable) {
    result.push(item)
  }

  return result
}

describe('agent provider contract', () => {
  it('runs mock provider', async () => {
    const provider = createMockAgentProvider()

    expect(provider.name).toBe('mock')

    const run = provider.run({
      input: 'hello',
    })

    const events = await collect(run.events)

    expect(events.map(event => event.type)).toEqual([
      'status',
      'message',
      'done',
    ])
  })

  it('runs replay provider', async () => {
    const provider = createReplayAgentProvider('replay', [
      {
        type: 'status',
        status: 'running',
      },
      {
        type: 'done',
        status: 'complete',
      },
    ])

    const events = await collect(
      provider.run({
        input: 'x',
      }).events,
    )

    expect(events).toEqual([
      {
        type: 'status',
        status: 'running',
      },
      {
        type: 'done',
        status: 'complete',
      },
    ])
  })

  it('supports cancellation', async () => {
    const provider = createReplayAgentProvider('replay', [
      {
        type: 'status',
        status: 'running',
      },
      {
        type: 'message',
        message: {
          id: 'm1',
          role: 'assistant',
          content: 'after cancel',
          status: 'complete',
          createdAt: 1,
          updatedAt: 1,
        },
      },
    ])

    const run = provider.run({
      input: 'x',
    })

    run.cancel()

    const events = await collect(run.events)

    expect(events).toEqual([])
  })

  it('does not expose network primitives in provider implementation', async () => {
    const provider = createMockAgentProvider()

    expect(JSON.stringify(provider)).not.toContain('fetch')
    expect(JSON.stringify(provider)).not.toContain('WebSocket')
    expect(JSON.stringify(provider)).not.toContain('EventSource')
  })
})
