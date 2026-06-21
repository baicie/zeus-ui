import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  createMockAgentProvider,
  createReplayAgentProvider,
} from '../src/provider'

const workspaceRoot = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../../..')

function readSource(path: string): string {
  return readFileSync(resolve(workspaceRoot, path), 'utf-8')
}

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

  it('keeps provider contract free of network/provider implementations', () => {
    const providerSources = [
      readSource('packages/advanced/agent-console/src/provider/types.ts'),
      readSource(
        'packages/advanced/agent-console/src/provider/mock-provider.ts',
      ),
      readSource(
        'packages/advanced/agent-console/src/provider/replay-provider.ts',
      ),
      readSource('packages/advanced/agent-console/src/provider/index.ts'),
    ].join('\n')

    for (const forbidden of [
      'fetch(',
      'EventSource',
      'WebSocket',
      'XMLHttpRequest',
      'Authorization',
      'Bearer',
      'OPENAI_API_KEY',
      'ANTHROPIC_API_KEY',
      'DEEPSEEK_API_KEY',
      '@openai',
      '@anthropic',
      'openai.chat',
      'anthropic.messages',
    ]) {
      expect(providerSources).not.toContain(forbidden)
    }
  })
})
