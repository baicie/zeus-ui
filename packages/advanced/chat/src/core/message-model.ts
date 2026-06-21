import type {
  ChatMessageData,
  ChatMessagePart,
  ChatMessagePartText,
  ChatMessageStatus,
  NormalizedChatMessageData,
} from '../types'

function createTextPart(text: string): ChatMessagePartText {
  return {
    type: 'text',
    text,
  }
}

function normalizeParts(message: ChatMessageData): ChatMessagePart[] {
  if (message.parts && message.parts.length > 0) {
    return message.parts.map(part => ({ ...part }))
  }

  if (message.content !== undefined) {
    return [createTextPart(message.content)]
  }

  return []
}

function normalizeStatus(
  status: ChatMessageStatus | undefined,
): ChatMessageStatus {
  return status ?? 'idle'
}

export function normalizeChatMessage(
  message: ChatMessageData,
): NormalizedChatMessageData {
  return {
    id: message.id,
    role: message.role,
    status: normalizeStatus(message.status),
    parts: normalizeParts(message),
    createdAt: message.createdAt ?? Date.now(),
    metadata: message.metadata ? { ...message.metadata } : undefined,
  }
}

export function normalizeChatMessages(
  messages: ChatMessageData[] | undefined,
): NormalizedChatMessageData[] {
  return (messages ?? []).map(message => normalizeChatMessage(message))
}

export function getMessageText(message: NormalizedChatMessageData): string {
  return message.parts
    .filter((part): part is ChatMessagePartText => part.type === 'text')
    .map(part => part.text)
    .join('')
}

export function appendMessagePart(
  message: NormalizedChatMessageData,
  part: ChatMessagePart,
): NormalizedChatMessageData {
  return {
    ...message,
    parts: [...message.parts, { ...part }],
  }
}

export function patchMessage(
  message: NormalizedChatMessageData,
  patch: Partial<ChatMessageData>,
): NormalizedChatMessageData {
  const next: ChatMessageData = {
    ...message,
    ...patch,
    parts: patch.parts ?? message.parts,
  }

  if (patch.content !== undefined && patch.parts === undefined) {
    next.parts = [{ type: 'text', text: patch.content }]
  }

  return normalizeChatMessage(next)
}

export function hasMessageId(
  messages: NormalizedChatMessageData[],
  id: string,
): boolean {
  return messages.some(message => message.id === id)
}
