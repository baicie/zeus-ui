export interface DataGridRowData {
  id: string
  metric: string
  owner: string
  status: string
  value: string
}

export interface DataGridColumn {
  id: string
  header: string
  field: keyof DataGridRowData
  width: number
  sortable?: boolean
}

export interface DataGridElement extends HTMLElement {
  rows?: DataGridRowData[]
  columns?: DataGridColumn[]
  selectionMode?: 'none' | 'single' | 'multiple'
  selectedKeys?: string[]
  resizable?: boolean
  keyboardNavigation?: boolean
  activeRowKey?: string
  activeColumnId?: string
  rowHeight?: number
  overscan?: number
  virtual?: boolean
  getSort?: () => unknown
  getSelection?: () => unknown
  getActiveCell?: () => unknown
}

export interface ChatMessageData {
  id: string
  role: 'system' | 'user' | 'assistant' | 'tool'
  status?: 'idle' | 'streaming' | 'complete' | 'error' | 'aborted'
  content?: string
  parts?: unknown[]
  createdAt?: number
}

export interface ChatElement extends HTMLElement {
  messages?: ChatMessageData[]
  loading?: boolean
  disabled?: boolean
  autoScroll?: boolean
  virtual?: boolean
  emptyText?: string
  setMessages: (messages: ChatMessageData[]) => void
  appendMessage: (message: ChatMessageData) => void
  updateMessage: (id: string, patch: Partial<ChatMessageData>) => void
  clear: () => void
  getMessages: () => unknown[]
  scrollToBottom: (options?: ScrollIntoViewOptions) => void
  emitSend: (
    value: string,
    nativeEvent?: Event,
    attachments?: unknown[],
  ) => void
  emitAbort: (detail?: unknown) => void
}

export interface ChatMessageElement extends HTMLElement {
  emitAction: (
    action: 'copy' | 'like' | 'dislike' | 'retry' | 'delete',
    nativeEvent?: Event,
  ) => void
}

export interface ChatComposerElement extends HTMLElement {
  focus: () => void
  clear: () => void
  submit: () => void
}

export interface ChatCodeBlockElement extends HTMLElement {
  copied?: boolean
  filename?: string
  language?: string
  emitAction: (action: 'copy', nativeEvent?: Event) => void
}

export interface RevoGridAdapterElement extends HTMLElement {
  rows?: DataGridRowData[]
  columns?: DataGridColumn[]
  selectedKeys?: string[]
  selectionMode?: 'none' | 'single' | 'multiple'
  sortColumn?: string
  sortDirection?: 'asc' | 'desc'
  readonly?: boolean
  refresh: () => void
  getState?: () => unknown
  getGridElement?: () => HTMLElement | undefined
}

export interface AgentConsoleMessage {
  id: string
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  status: 'pending' | 'streaming' | 'complete' | 'error'
  createdAt: number
  updatedAt: number
  metadata?: Record<string, unknown>
}

export interface AgentConsoleToolCall {
  id: string
  name: string
  status: 'pending' | 'running' | 'complete' | 'error' | 'cancelled'
  input?: unknown
  output?: unknown
  error?: string
  createdAt: number
  updatedAt: number
  metadata?: Record<string, unknown>
}

export interface AgentConsoleArtifact {
  id: string
  kind: 'text' | 'json' | 'code' | 'table' | 'file' | 'image' | 'link'
  title: string
  content?: unknown
  url?: string
  mimeType?: string
  createdAt: number
  updatedAt: number
  metadata?: Record<string, unknown>
}

export interface AgentConsoleDiagnostic {
  id: string
  level: 'info' | 'warning' | 'error'
  message: string
  source?: string
  createdAt: number
  metadata?: Record<string, unknown>
}

export interface AgentConsoleElement extends HTMLElement {
  status?: 'idle' | 'running' | 'waiting' | 'complete' | 'error'
  messages?: AgentConsoleMessage[]
  toolCalls?: AgentConsoleToolCall[]
  artifacts?: AgentConsoleArtifact[]
  diagnostics?: AgentConsoleDiagnostic[]
  selectedArtifactId?: string
  maxEvents?: number
  appendMessage: (input: {
    id?: string
    role: 'system' | 'user' | 'assistant' | 'tool'
    content: string
    status?: 'pending' | 'streaming' | 'complete' | 'error'
  }) => AgentConsoleMessage
  updateMessage: (input: {
    id: string
    content?: string
    status?: 'pending' | 'streaming' | 'complete' | 'error'
  }) => AgentConsoleMessage | undefined
  startToolCall: (input: {
    id?: string
    name: string
    input?: unknown
  }) => string
  finishToolCall: (input: {
    id: string
    output?: unknown
    error?: string
  }) => void
  addArtifact: (input: {
    id?: string
    kind: 'text' | 'json' | 'code' | 'table' | 'file' | 'image' | 'link'
    title: string
    content?: unknown
  }) => AgentConsoleArtifact
  selectArtifact: (
    artifactId: string | undefined,
  ) => AgentConsoleArtifact | undefined
  addDiagnostic: (input: {
    id?: string
    level: 'info' | 'warning' | 'error'
    message: string
    source?: string
  }) => void
  setStatus: (
    status: 'idle' | 'running' | 'waiting' | 'complete' | 'error',
  ) => void
  getState: () => unknown
  getEvents: () => unknown[]
  reset: () => void
}

export interface VirtualListElement extends HTMLElement {
  count?: number
  estimateSize?: number
  overscan?: number
}
