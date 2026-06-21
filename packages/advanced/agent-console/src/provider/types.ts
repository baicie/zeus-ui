import type {
  AgentConsoleArtifact,
  AgentConsoleDiagnostic,
  AgentConsoleMessage,
  AgentConsoleToolCall,
} from '../types'

export type AgentProviderEventType =
  | 'message'
  | 'message-delta'
  | 'tool-call'
  | 'tool-result'
  | 'artifact'
  | 'diagnostic'
  | 'status'
  | 'done'
  | 'error'

export interface AgentProviderRequest {
  input: string
  messages?: AgentConsoleMessage[]
  metadata?: Record<string, unknown>
}

export interface AgentProviderEvent {
  type: AgentProviderEventType
  message?: AgentConsoleMessage
  delta?: string
  toolCall?: AgentConsoleToolCall
  artifact?: AgentConsoleArtifact
  diagnostic?: AgentConsoleDiagnostic
  status?: 'idle' | 'running' | 'waiting' | 'complete' | 'error'
  error?: string
  metadata?: Record<string, unknown>
}

export interface AgentProviderRun {
  events: AsyncIterable<AgentProviderEvent>
  cancel: () => void
}

export interface AgentProviderAdapter {
  name: string
  run: (request: AgentProviderRequest) => AgentProviderRun
}
