import type {
  AgentProviderAdapter,
  AgentProviderEvent,
  AgentProviderRequest,
  AgentProviderRun,
} from './types'

export interface CreateMockAgentProviderOptions {
  name?: string
  events?: AgentProviderEvent[]
}

async function* iterateEvents(
  events: AgentProviderEvent[],
  signal: { cancelled: boolean },
): AsyncIterable<AgentProviderEvent> {
  for (const event of events) {
    if (signal.cancelled) return

    await Promise.resolve()
    yield event
  }
}

export function createMockAgentProvider(
  options: CreateMockAgentProviderOptions = {},
): AgentProviderAdapter {
  const events = options.events ?? [
    {
      type: 'status',
      status: 'running',
    },
    {
      type: 'message',
      message: {
        id: 'mock-message',
        role: 'assistant',
        content: 'Mock provider response.',
        status: 'complete',
        createdAt: 1,
        updatedAt: 1,
      },
    },
    {
      type: 'done',
      status: 'complete',
    },
  ]

  return {
    name: options.name ?? 'mock',
    run(_request: AgentProviderRequest): AgentProviderRun {
      const signal = {
        cancelled: false,
      }

      return {
        events: iterateEvents(events, signal),
        cancel() {
          signal.cancelled = true
        },
      }
    },
  }
}
