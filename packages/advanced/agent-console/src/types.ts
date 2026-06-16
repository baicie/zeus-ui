export type AgentConsoleRole = 'system' | 'user' | 'assistant' | 'tool'

export type AgentConsoleStatus =
  | 'idle'
  | 'running'
  | 'waiting'
  | 'complete'
  | 'error'

export type AgentConsoleMessageStatus =
  | 'pending'
  | 'streaming'
  | 'complete'
  | 'error'

export type AgentConsoleToolCallStatus =
  | 'pending'
  | 'running'
  | 'complete'
  | 'error'
  | 'cancelled'

export type AgentConsoleArtifactKind =
  | 'text'
  | 'json'
  | 'code'
  | 'table'
  | 'file'
  | 'image'
  | 'link'

export type AgentConsoleDiagnosticLevel = 'info' | 'warning' | 'error'

export type AgentConsoleEventType =
  | 'message'
  | 'tool-call'
  | 'tool-result'
  | 'artifact'
  | 'diagnostic'
  | 'status'
  | 'reset'

export type AgentConsoleMetadata = Record<string, unknown>

export interface AgentConsoleMessage {
  id: string
  role: AgentConsoleRole
  content: string
  status: AgentConsoleMessageStatus
  createdAt: number
  updatedAt: number
  metadata?: AgentConsoleMetadata
}

export interface AgentConsoleToolCall {
  id: string
  name: string
  status: AgentConsoleToolCallStatus
  input?: unknown
  output?: unknown
  error?: string
  createdAt: number
  updatedAt: number
  metadata?: AgentConsoleMetadata
}

export interface AgentConsoleArtifact {
  id: string
  kind: AgentConsoleArtifactKind
  title: string
  content?: unknown
  url?: string
  mimeType?: string
  createdAt: number
  updatedAt: number
  metadata?: AgentConsoleMetadata
}

export interface AgentConsoleDiagnostic {
  id: string
  level: AgentConsoleDiagnosticLevel
  message: string
  source?: string
  createdAt: number
  metadata?: AgentConsoleMetadata
}

export interface AgentConsoleEvent {
  id: string
  type: AgentConsoleEventType
  createdAt: number
  message?: AgentConsoleMessage
  toolCall?: AgentConsoleToolCall
  artifact?: AgentConsoleArtifact
  diagnostic?: AgentConsoleDiagnostic
  status?: AgentConsoleStatus
  metadata?: AgentConsoleMetadata
}

export interface AgentConsoleState {
  status: AgentConsoleStatus
  messages: AgentConsoleMessage[]
  toolCalls: AgentConsoleToolCall[]
  artifacts: AgentConsoleArtifact[]
  diagnostics: AgentConsoleDiagnostic[]
  events: AgentConsoleEvent[]
  selectedArtifactId?: string
}

export interface AgentConsoleAppendMessageInput {
  id?: string
  role: AgentConsoleRole
  content: string
  status?: AgentConsoleMessageStatus
  createdAt?: number
  updatedAt?: number
  metadata?: AgentConsoleMetadata
}

export interface AgentConsoleUpdateMessageInput {
  id: string
  content?: string
  status?: AgentConsoleMessageStatus
  updatedAt?: number
  metadata?: AgentConsoleMetadata
}

export interface AgentConsoleStartToolCallInput {
  id?: string
  name: string
  input?: unknown
  status?: AgentConsoleToolCallStatus
  createdAt?: number
  updatedAt?: number
  metadata?: AgentConsoleMetadata
}

export interface AgentConsoleFinishToolCallInput {
  id: string
  output?: unknown
  error?: string
  status?: AgentConsoleToolCallStatus
  updatedAt?: number
  metadata?: AgentConsoleMetadata
}

export interface AgentConsoleAddArtifactInput {
  id?: string
  kind: AgentConsoleArtifactKind
  title: string
  content?: unknown
  url?: string
  mimeType?: string
  createdAt?: number
  updatedAt?: number
  metadata?: AgentConsoleMetadata
}

export interface AgentConsoleAddDiagnosticInput {
  id?: string
  level: AgentConsoleDiagnosticLevel
  message: string
  source?: string
  createdAt?: number
  metadata?: AgentConsoleMetadata
}

export interface AgentConsoleSnapshotOptions {
  maxEvents?: number
}

export interface AgentConsoleEventDetail {
  event: AgentConsoleEvent
  state: AgentConsoleState
}

export interface AgentConsoleStatusChangeDetail {
  status: AgentConsoleStatus
  previousStatus: AgentConsoleStatus
  state: AgentConsoleState
}

export interface AgentConsoleArtifactSelectDetail {
  artifact: AgentConsoleArtifact | undefined
  artifactId: string | undefined
  state: AgentConsoleState
}

export interface AgentConsoleResetDetail {
  state: AgentConsoleState
}

export type {
  AgentConsoleElement,
  AgentConsoleProps,
} from './components/agent-console'
