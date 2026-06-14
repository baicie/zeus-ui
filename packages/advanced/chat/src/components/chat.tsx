import type { DefineElementContext, EventDefinition } from '@zeus-js/zeus'
import type {
  ChatAbortDetail,
  ChatArtifactOpenDetail,
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
  appendMessage: (message: ChatMessageData) => void
  updateMessage: (id: string, patch: Partial<ChatMessageData>) => void
  appendMessagePart: (id: string, part: ChatMessagePart) => void
  clear: () => void
  getMessages: () => NormalizedChatMessageData[]
  scrollToBottom: (options?: ScrollIntoViewOptions) => void
}

interface ChatEmits extends Record<string, EventDefinition<unknown>> {
  send: EventDefinition<ChatSendDetail>
  abort: EventDefinition<ChatAbortDetail>
  regenerate: EventDefinition<ChatRegenerateDetail>
  messageAction: EventDefinition<ChatMessageActionDetail>
  artifactOpen: EventDefinition<ChatArtifactOpenDetail>
}

function setup(
  props: ChatProps,
  ctx: DefineElementContext<ChatElement, ChatEmits>,
) {
  let root: HTMLElement | undefined
  const store = createChatStore(props.messages ?? [])

  const scrollToBottom = (options?: ScrollIntoViewOptions): void => {
    root?.scrollTo({
      top: root.scrollHeight,
      behavior: options?.behavior,
    })
  }

  const syncHostMessages = (messages: NormalizedChatMessageData[]) => {
    ctx.host.messages = messages
  }

  ctx.expose({
    appendMessage(message: ChatMessageData): void {
      const messages = store.appendMessage(message)
      syncHostMessages(messages)

      if (props.autoScroll !== false) {
        queueMicrotask(() => scrollToBottom({ behavior: 'smooth' }))
      }
    },

    updateMessage(id: string, patch: Partial<ChatMessageData>): void {
      const messages = store.updateMessage(id, patch)
      syncHostMessages(messages)

      if (props.autoScroll !== false) {
        queueMicrotask(() => scrollToBottom({ behavior: 'smooth' }))
      }
    },

    appendMessagePart(id: string, part: ChatMessagePart): void {
      const messages = store.appendMessagePart(id, part)
      syncHostMessages(messages)

      if (props.autoScroll !== false) {
        queueMicrotask(() => scrollToBottom({ behavior: 'smooth' }))
      }
    },

    clear(): void {
      store.clear()
      ctx.host.messages = []
    },

    getMessages(): NormalizedChatMessageData[] {
      return store.getMessages()
    },

    scrollToBottom,
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
