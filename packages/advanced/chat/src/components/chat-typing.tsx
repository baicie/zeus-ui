import { defineElement, Host, prop, Slot } from '@zeus-js/zeus'

export interface ChatTypingProps {
  text?: string
  active?: boolean
}

export interface ChatTypingElement extends HTMLElement {}

function setup(props: ChatTypingProps) {
  return (
    <Host
      part="root"
      data-slot="chat-typing-root"
      data-active={() => (props.active ? '' : undefined)}
      aria-hidden={() => (props.active ? undefined : 'true')}
    >
      <div part="indicator" data-slot="chat-typing">
        <Slot>{props.text ?? 'Typing...'}</Slot>
      </div>
    </Host>
  )
}

export const ChatTyping = defineElement<ChatTypingProps, ChatTypingElement>(
  'zw-chat-typing',
  {
    shadow: false,
    props: {
      text: String,
      active: prop(Boolean, {
        default: true,
        reflect: true,
      }),
    },
    meta: {
      description: 'Headless chat typing indicator advanced component.',
    },
  },
  setup,
)
