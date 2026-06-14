import type { DefineElementContext, EventDefinition } from '@zeus-js/zeus'
import type {
  ChatMessageActionDetail,
  ChatMessageStatus,
  ChatRole,
} from '../types'

import { defineElement, event, Host, prop, Slot } from '@zeus-js/zeus'

export interface ChatMessageProps {
  messageId?: string
  role?: ChatRole
  status?: ChatMessageStatus
  selected?: boolean
  interactive?: boolean
}

export interface ChatMessageElement extends HTMLElement {}

interface ChatMessageEmits extends Record<string, EventDefinition<unknown>> {
  messageAction: EventDefinition<ChatMessageActionDetail>
}

function setup(
  props: ChatMessageProps,
  _ctx: DefineElementContext<ChatMessageElement, ChatMessageEmits>,
) {
  return (
    <Host
      part="root"
      data-slot="chat-message-root"
      data-message-id={() => props.messageId}
      data-role={() => props.role}
      data-status={() => props.status}
      data-selected={() => (props.selected ? '' : undefined)}
      data-interactive={() => (props.interactive ? '' : undefined)}
    >
      <article part="message" data-slot="chat-message">
        <div part="avatar" data-slot="chat-message-avatar">
          <Slot name="avatar" />
        </div>

        <div part="body" data-slot="chat-message-body">
          <header part="header" data-slot="chat-message-header">
            <Slot name="header" />
          </header>

          <div part="content" data-slot="chat-message-content">
            <Slot />
          </div>

          <footer part="footer" data-slot="chat-message-footer">
            <Slot name="footer" />
          </footer>

          <div part="actions" data-slot="chat-message-actions">
            <Slot name="actions" />
          </div>
        </div>
      </article>
    </Host>
  )
}

export const ChatMessage = defineElement<
  ChatMessageProps,
  ChatMessageElement,
  ChatMessageEmits
>(
  'zw-chat-message',
  {
    shadow: false,
    props: {
      messageId: prop(String, {
        attr: 'message-id',
      }),
      role: prop(['system', 'user', 'assistant', 'tool'], {
        default: 'assistant',
        reflect: true,
      }),
      status: prop(['idle', 'streaming', 'complete', 'error', 'aborted'], {
        default: 'idle',
        reflect: true,
      }),
      selected: prop(Boolean, {
        reflect: true,
      }),
      interactive: prop(Boolean, {
        reflect: true,
      }),
    },
    emits: {
      messageAction: event<ChatMessageActionDetail>(),
    },
    meta: {
      description: 'Headless chat message advanced component.',
    },
  },
  setup,
)
