import type { ChatToolCallStatus } from '../types'

import { defineElement, Host, prop, Slot } from '@zeus-js/zeus'

export interface ChatToolCallProps {
  toolId?: string
  name?: string
  status?: ChatToolCallStatus
  open?: boolean
}

export interface ChatToolCallElement extends HTMLElement {}

function setup(props: ChatToolCallProps) {
  return (
    <Host
      part="root"
      data-slot="chat-tool-call-root"
      data-tool-id={() => props.toolId}
      data-name={() => props.name}
      data-status={() => props.status}
      data-open={() => (props.open ? '' : undefined)}
    >
      <details
        part="details"
        data-slot="chat-tool-call"
        open={() => Boolean(props.open)}
      >
        <summary part="summary" data-slot="chat-tool-call-summary">
          <Slot name="summary">{props.name ?? ''}</Slot>
        </summary>

        <div part="input" data-slot="chat-tool-call-input">
          <Slot name="input" />
        </div>

        <div part="output" data-slot="chat-tool-call-output">
          <Slot name="output" />
        </div>

        <div part="error" data-slot="chat-tool-call-error">
          <Slot name="error" />
        </div>

        <div part="actions" data-slot="chat-tool-call-actions">
          <Slot name="actions" />
        </div>
      </details>
    </Host>
  )
}

export const ChatToolCall = defineElement<
  ChatToolCallProps,
  ChatToolCallElement
>(
  'zw-chat-tool-call',
  {
    shadow: false,
    props: {
      toolId: prop(String, {
        attr: 'tool-id',
      }),
      name: String,
      status: prop(['pending', 'running', 'success', 'error'], {
        default: 'pending',
        reflect: true,
      }),
      open: prop(Boolean, {
        reflect: true,
      }),
    },
    meta: {
      description: 'Headless chat tool call advanced component.',
    },
  },
  setup,
)
