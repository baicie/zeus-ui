import type {
  VirtualItem,
  VirtualRange,
  VirtualScrollAlign,
} from '@zeus-web/virtual'

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool'

export type ChatMessageStatus =
  | 'idle'
  | 'streaming'
  | 'complete'
  | 'error'
  | 'aborted'

export type ChatToolCallStatus = 'pending' | 'running' | 'success' | 'error'

export type ChatArtifactKind = 'text' | 'code' | 'table' | 'chart' | 'custom'

export interface ChatMessagePartText {
  type: 'text'
  text: string
}

export interface ChatMessagePartCode {
  type: 'code'
  code: string
  language?: string
  filename?: string
}

export interface ChatMessagePartToolCall {
  type: 'tool-call'
  id: string
  name: string
  status: ChatToolCallStatus
  input?: unknown
  output?: unknown
  error?: string
}

export interface ChatMessagePartArtifact {
  type: 'artifact'
  id: string
  kind: ChatArtifactKind
  title?: string
  data?: unknown
}

export type ChatMessagePart =
  | ChatMessagePartText
  | ChatMessagePartCode
  | ChatMessagePartToolCall
  | ChatMessagePartArtifact

export interface ChatMessageData {
  id: string
  role: ChatRole
  status?: ChatMessageStatus
  content?: string
  parts?: ChatMessagePart[]
  createdAt?: number
  metadata?: Record<string, unknown>
}

export interface NormalizedChatMessageData {
  id: string
  role: ChatRole
  status: ChatMessageStatus
  parts: ChatMessagePart[]
  createdAt: number
  metadata?: Record<string, unknown>
}

export interface ChatAttachmentData {
  id: string
  name: string
  type?: string
  size?: number
  url?: string
  metadata?: Record<string, unknown>
}

export interface ChatSendDetail {
  value: string
  attachments: ChatAttachmentData[]
  nativeEvent: Event | KeyboardEvent
}

export interface ChatAbortDetail {
  messageId?: string
  reason?: string
}

export interface ChatRegenerateDetail {
  messageId: string
}

export type ChatMessageAction = 'copy' | 'like' | 'dislike' | 'retry' | 'delete'

export interface ChatMessageActionDetail {
  messageId: string
  action: ChatMessageAction
  nativeEvent?: Event
}

export interface ChatArtifactOpenDetail {
  artifactId: string
  messageId?: string
  nativeEvent?: Event
}

export interface ChatValueChangeDetail {
  value: string
  nativeEvent: Event
}

export interface ChatAttachmentChangeDetail {
  attachments: ChatAttachmentData[]
  nativeEvent?: Event
}

export type ChatCodeBlockAction = 'copy'

export interface ChatCodeBlockActionDetail {
  action: ChatCodeBlockAction
  language?: string
  filename?: string
  nativeEvent?: Event
}

export type ChatThreadScrollAlign = VirtualScrollAlign

export type ChatThreadVirtualRange = VirtualRange

export type ChatThreadVirtualItem = VirtualItem

export interface ChatThreadVirtualSnapshot {
  range: ChatThreadVirtualRange
  items: ChatThreadVirtualItem[]
  totalSize: number
}

export interface ChatThreadRangeChangeDetail {
  range: ChatThreadVirtualRange
  items: ChatThreadVirtualItem[]
  scrollOffset: number
  viewportSize: number
  totalSize: number
}

export interface ChatThreadScrollOffsetChangeDetail {
  offset: number
  nativeEvent: Event
}

export interface ChatThreadVirtualizerOptions {
  count: number
  estimateSize: number
  overscan?: number
  getItemKey?: (index: number) => string
}

export interface ChatThreadVirtualizer {
  getSnapshot: (
    scrollOffset: number,
    viewportSize: number,
  ) => ChatThreadVirtualSnapshot
  getRange: (
    scrollOffset: number,
    viewportSize: number,
  ) => ChatThreadVirtualRange
  getItems: (range: ChatThreadVirtualRange) => ChatThreadVirtualItem[]
  getTotalSize: () => number
  getOffsetForIndex: (
    index: number,
    align?: ChatThreadScrollAlign,
    viewportSize?: number,
  ) => number
  measure: (index: number, size: number) => void
  resetMeasurements: () => void
}

export type { ChatProps, ChatElement } from './components/chat'

export type {
  ChatArtifactProps,
  ChatArtifactElement,
} from './components/chat-artifact'

export type {
  ChatCodeBlockProps,
  ChatCodeBlockElement,
} from './components/chat-code-block'

export type {
  ChatComposerProps,
  ChatComposerElement,
} from './components/chat-composer'

export type {
  ChatMessageProps,
  ChatMessageElement,
} from './components/chat-message'

export type {
  ChatThreadProps,
  ChatThreadElement,
} from './components/chat-thread'

export type {
  ChatToolCallProps,
  ChatToolCallElement,
} from './components/chat-tool-call'

export type {
  ChatTypingProps,
  ChatTypingElement,
} from './components/chat-typing'
