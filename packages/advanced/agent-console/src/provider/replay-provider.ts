import type {
  AgentProviderAdapter,
  AgentProviderEvent,
  AgentProviderRequest,
  AgentProviderRun,
} from './types'

async function* replay(
  events: AgentProviderEvent[],
  signal: { cancelled: boolean },
): AsyncIterable<AgentProviderEvent> {
  for (const event of events) {
    if (signal.cancelled) return

    await Promise.resolve()
    yield event
  }
}

export function createReplayAgentProvider(
  name: string,
  events: AgentProviderEvent[],
): AgentProviderAdapter {
  return {
    name,
    run(_request: AgentProviderRequest): AgentProviderRun {
      const signal = {
        cancelled: false,
      }

      return {
        events: replay(events, signal),
        cancel() {
          signal.cancelled = true
        },
      }
    },
  }
}
