import type {
  AgentConsoleArtifact,
  AgentConsoleDiagnostic,
  AgentConsoleEvent,
  AgentConsoleEventType,
  AgentConsoleMessage,
  AgentConsoleMetadata,
  AgentConsoleStatus,
  AgentConsoleToolCall,
} from '../types'

import { normalizeAgentConsoleId } from './id'

function now(): number {
  return Date.now()
}

export interface CreateAgentConsoleEventInput {
  id?: string
  type: AgentConsoleEventType
  createdAt?: number
  message?: AgentConsoleMessage
  toolCall?: AgentConsoleToolCall
  artifact?: AgentConsoleArtifact
  diagnostic?: AgentConsoleDiagnostic
  status?: AgentConsoleStatus
  metadata?: AgentConsoleMetadata
}

export function createAgentConsoleEvent(
  input: CreateAgentConsoleEventInput,
): AgentConsoleEvent {
  return {
    id: normalizeAgentConsoleId(input.id, 'event'),
    type: input.type,
    createdAt: input.createdAt ?? now(),
    message: input.message,
    toolCall: input.toolCall,
    artifact: input.artifact,
    diagnostic: input.diagnostic,
    status: input.status,
    metadata: input.metadata,
  }
}

export function appendAgentConsoleEvent(
  events: AgentConsoleEvent[],
  input: CreateAgentConsoleEventInput,
  maxEvents?: number,
): AgentConsoleEvent[] {
  const next = [...events, createAgentConsoleEvent(input)]

  if (!maxEvents || maxEvents <= 0 || next.length <= maxEvents) return next

  return next.slice(next.length - maxEvents)
}

export function filterAgentConsoleEventsByType(
  events: AgentConsoleEvent[],
  type: AgentConsoleEventType,
): AgentConsoleEvent[] {
  return events.filter(event => event.type === type)
}
