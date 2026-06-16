import type {
  AgentConsoleAppendMessageInput,
  AgentConsoleMessage,
  AgentConsoleUpdateMessageInput,
} from '../types'

import { normalizeAgentConsoleId } from './id'

function now(): number {
  return Date.now()
}

export function createAgentConsoleMessage(
  input: AgentConsoleAppendMessageInput,
): AgentConsoleMessage {
  const createdAt = input.createdAt ?? now()

  return {
    id: normalizeAgentConsoleId(input.id, 'msg'),
    role: input.role,
    content: input.content,
    status: input.status ?? 'complete',
    createdAt,
    updatedAt: input.updatedAt ?? createdAt,
    metadata: input.metadata,
  }
}

export function appendAgentConsoleMessage(
  messages: AgentConsoleMessage[],
  input: AgentConsoleAppendMessageInput,
): AgentConsoleMessage[] {
  return [...messages, createAgentConsoleMessage(input)]
}

export function updateAgentConsoleMessage(
  messages: AgentConsoleMessage[],
  input: AgentConsoleUpdateMessageInput,
): AgentConsoleMessage[] {
  return messages.map(message => {
    if (message.id !== input.id) return message

    return {
      ...message,
      content: input.content ?? message.content,
      status: input.status ?? message.status,
      updatedAt: input.updatedAt ?? Date.now(),
      metadata: input.metadata
        ? {
            ...(message.metadata ?? {}),
            ...input.metadata,
          }
        : message.metadata,
    }
  })
}

export function getAgentConsoleMessageById(
  messages: AgentConsoleMessage[],
  id: string,
): AgentConsoleMessage | undefined {
  return messages.find(message => message.id === id)
}
