import type { DefineElementContext, EventDefinition } from '@zeus-js/zeus'
import type {
  ChatAbortDetail,
  ChatArtifactOpenDetail,
  ChatAttachmentData,
  ChatMessageActionDetail,
  ChatMessageData,
  ChatMessagePart,
  ChatRegenerateDetail,
  ChatSendDetail,
  NormalizedChatMessageData,
} from '../types'

import { defineElement, event, Host, prop, Slot } from '@zeus-js/zeus'
import { createChatStore } from '../core'

export interface ChatProps {
  messages?: ChatMessageData[]
  loading?: boolean
  disabled?: boolean
  autoScroll?: boolean
  virtual?: boolean
  emptyText?: string
}

export interface ChatElement extends HTMLElement {
  messages?: ChatMessageData[]
  setMessages: (messages: ChatMessageData[]) => void
  appendMessage: (message: ChatMessageData) => void
  updateMessage: (id: string, patch: Partial<ChatMessageData>) => void
  appendMessagePart: (id: string, part: ChatMessagePart) => void
  clear: () => void
  getMessages: () => NormalizedChatMessageData[]
  scrollToBottom: (options?: ScrollIntoViewOptions) => void
  emitSend: (
    value: string,
    nativeEvent?: Event | KeyboardEvent,
    attachments?: ChatAttachmentData[],
  ) => void
  emitAbort: (detail?: ChatAbortDetail) => void
  emitRegenerate: (messageId: string) => void
  emitMessageAction: (detail: ChatMessageActionDetail) => void
  emitArtifactOpen: (detail: ChatArtifactOpenDetail) => void
}

interface ChatEmits extends Record<string, EventDefinition<unknown>> {
  send: EventDefinition<ChatSendDetail>
  abort: EventDefinition<ChatAbortDetail>
  regenerate: EventDefinition<ChatRegenerateDetail>
  messageAction: EventDefinition<ChatMessageActionDetail>
  artifactOpen: EventDefinition<ChatArtifactOpenDetail>
}

function createSyntheticEvent(type: string): Event {
  return new Event(type)
}

function setup(
  props: ChatProps,
  ctx: DefineElementContext<ChatElement, ChatEmits>,
) {
  let root: HTMLElement | undefined
  const store = createChatStore(props.messages ?? [])

  const syncHostMessages = (messages: NormalizedChatMessageData[]): void => {
    ctx.host.messages = messages
  }

  const scrollToBottom = (options?: ScrollIntoViewOptions): void => {
    root?.scrollTo({
      top: root.scrollHeight,
      behavior: options?.behavior,
    })
  }

  const maybeAutoScroll = (): void => {
    if (props.autoScroll !== false) {
      queueMicrotask(() => scrollToBottom({ behavior: 'smooth' }))
    }
  }

  syncHostMessages(store.getMessages())

  ctx.expose({
    setMessages(messages: ChatMessageData[]): void {
      syncHostMessages(store.setMessages(messages))
      maybeAutoScroll()
    },

    appendMessage(message: ChatMessageData): void {
      syncHostMessages(store.appendMessage(message))
      maybeAutoScroll()
    },

    updateMessage(id: string, patch: Partial<ChatMessageData>): void {
      syncHostMessages(store.updateMessage(id, patch))
      maybeAutoScroll()
    },

    appendMessagePart(id: string, part: ChatMessagePart): void {
      syncHostMessages(store.appendMessagePart(id, part))
      maybeAutoScroll()
    },

    clear(): void {
      store.clear()
      ctx.host.messages = []
    },

    getMessages(): NormalizedChatMessageData[] {
      return store.getMessages()
    },

    scrollToBottom,

    emitSend(
      value: string,
      nativeEvent: Event | KeyboardEvent = createSyntheticEvent('send'),
      attachments: ChatAttachmentData[] = [],
    ): void {
      const normalizedValue = value.trim()

      if (!normalizedValue || props.disabled || props.loading) return

      ctx.emit.send({
        value: normalizedValue,
        attachments,
        nativeEvent,
      })
    },

    emitAbort(detail: ChatAbortDetail = {}): void {
      ctx.emit.abort(detail)
    },

    emitRegenerate(messageId: string): void {
      if (!messageId) return

      ctx.emit.regenerate({
        messageId,
      })
    },

    emitMessageAction(detail: ChatMessageActionDetail): void {
      ctx.emit.messageAction(detail)
    },

    emitArtifactOpen(detail: ChatArtifactOpenDetail): void {
      ctx.emit.artifactOpen(detail)
    },
  })

  return (
    <Host
      part="root"
      data-slot="chat-root"
      data-loading={() => (props.loading ? '' : undefined)}
      data-disabled={() => (props.disabled ? '' : undefined)}
      data-virtual={() => (props.virtual ? '' : undefined)}
      data-empty={() => (store.getMessages().length === 0 ? '' : undefined)}
    >
      <section
        ref={(element: HTMLElement | null) => {
          if (element) root = element
        }}
        part="container"
        data-slot="chat"
      >
        <header part="header" data-slot="chat-header">
          <Slot name="header" />
        </header>

        <aside part="sidebar" data-slot="chat-sidebar">
          <Slot name="sidebar" />
        </aside>

        <main part="thread" data-slot="chat-thread">
          <Slot name="thread" />

          <div part="empty" data-slot="chat-empty">
            <Slot name="empty">{props.emptyText ?? ''}</Slot>
          </div>

          <div part="loading" data-slot="chat-loading">
            <Slot name="loading" />
          </div>
        </main>

        <section part="artifact" data-slot="chat-artifact">
          <Slot name="artifact" />
        </section>

        <footer part="composer" data-slot="chat-composer">
          <Slot name="composer" />
        </footer>
      </section>
    </Host>
  )
}

export const Chat = defineElement<ChatProps, ChatElement, ChatEmits>(
  'zw-chat',
  {
    shadow: false,
    props: {
      messages: Array,
      loading: prop(Boolean, {
        reflect: true,
      }),
      disabled: prop(Boolean, {
        reflect: true,
      }),
      autoScroll: prop(Boolean, {
        attr: 'auto-scroll',
        default: true,
      }),
      virtual: prop(Boolean, {
        reflect: true,
      }),
      emptyText: prop(String, {
        attr: 'empty-text',
      }),
    },
    emits: {
      send: event<ChatSendDetail>(),
      abort: event<ChatAbortDetail>(),
      regenerate: event<ChatRegenerateDetail>(),
      messageAction: event<ChatMessageActionDetail>(),
      artifactOpen: event<ChatArtifactOpenDetail>(),
    },
    meta: {
      description: 'Headless ChatGPT-style chat root advanced component.',
    },
  },
  setup,
)
