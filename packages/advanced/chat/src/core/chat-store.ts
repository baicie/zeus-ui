import type {
  ChatMessageData,
  ChatMessagePart,
  NormalizedChatMessageData,
} from '../types'

import {
  appendMessagePart as appendPartToMessage,
  hasMessageId,
  normalizeChatMessage,
  normalizeChatMessages,
  patchMessage,
} from './message-model'

export interface ChatStoreSnapshot {
  messages: NormalizedChatMessageData[]
}

export interface ChatStore {
  getSnapshot: () => ChatStoreSnapshot
  getMessages: () => NormalizedChatMessageData[]
  setMessages: (messages: ChatMessageData[]) => NormalizedChatMessageData[]
  appendMessage: (message: ChatMessageData) => NormalizedChatMessageData[]
  updateMessage: (
    id: string,
    patch: Partial<ChatMessageData>,
  ) => NormalizedChatMessageData[]
  appendMessagePart: (
    id: string,
    part: ChatMessagePart,
  ) => NormalizedChatMessageData[]
  clear: () => void
}

export function createChatStore(
  initialMessages: ChatMessageData[] = [],
): ChatStore {
  let messages = normalizeChatMessages(initialMessages)

  const cloneMessages = () =>
    messages.map(message => ({
      ...message,
      parts: message.parts.map(part => ({ ...part })),
      metadata: message.metadata ? { ...message.metadata } : undefined,
    }))

  return {
    getSnapshot(): ChatStoreSnapshot {
      return {
        messages: cloneMessages(),
      }
    },

    getMessages(): NormalizedChatMessageData[] {
      return cloneMessages()
    },

    setMessages(nextMessages: ChatMessageData[]): NormalizedChatMessageData[] {
      messages = normalizeChatMessages(nextMessages)
      return cloneMessages()
    },

    appendMessage(message: ChatMessageData): NormalizedChatMessageData[] {
      if (hasMessageId(messages, message.id)) {
        messages = messages.map(item =>
          item.id === message.id ? normalizeChatMessage(message) : item,
        )
      } else {
        messages = [...messages, normalizeChatMessage(message)]
      }

      return cloneMessages()
    },

    updateMessage(
      id: string,
      patch: Partial<ChatMessageData>,
    ): NormalizedChatMessageData[] {
      messages = messages.map(message =>
        message.id === id ? patchMessage(message, patch) : message,
      )

      return cloneMessages()
    },

    appendMessagePart(
      id: string,
      part: ChatMessagePart,
    ): NormalizedChatMessageData[] {
      messages = messages.map(message =>
        message.id === id ? appendPartToMessage(message, part) : message,
      )

      return cloneMessages()
    },

    clear(): void {
      messages = []
    },
  }
}
