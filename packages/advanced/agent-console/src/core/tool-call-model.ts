import type {
  AgentConsoleFinishToolCallInput,
  AgentConsoleStartToolCallInput,
  AgentConsoleToolCall,
} from '../types'

import { normalizeAgentConsoleId } from './id'

function now(): number {
  return Date.now()
}

export function createAgentConsoleToolCall(
  input: AgentConsoleStartToolCallInput,
): AgentConsoleToolCall {
  const createdAt = input.createdAt ?? now()

  return {
    id: normalizeAgentConsoleId(input.id, 'tool'),
    name: input.name,
    status: input.status ?? 'running',
    input: input.input,
    createdAt,
    updatedAt: input.updatedAt ?? createdAt,
    metadata: input.metadata,
  }
}

export function startAgentConsoleToolCall(
  toolCalls: AgentConsoleToolCall[],
  input: AgentConsoleStartToolCallInput,
): AgentConsoleToolCall[] {
  return [...toolCalls, createAgentConsoleToolCall(input)]
}

export function finishAgentConsoleToolCall(
  toolCalls: AgentConsoleToolCall[],
  input: AgentConsoleFinishToolCallInput,
): AgentConsoleToolCall[] {
  return toolCalls.map(toolCall => {
    if (toolCall.id !== input.id) return toolCall

    const status = input.status ?? (input.error ? 'error' : 'complete')

    return {
      ...toolCall,
      status,
      output: input.output,
      error: input.error,
      updatedAt: input.updatedAt ?? Date.now(),
      metadata: input.metadata
        ? {
            ...(toolCall.metadata ?? {}),
            ...input.metadata,
          }
        : toolCall.metadata,
    }
  })
}

export function getAgentConsoleToolCallById(
  toolCalls: AgentConsoleToolCall[],
  id: string,
): AgentConsoleToolCall | undefined {
  return toolCalls.find(toolCall => toolCall.id === id)
}
