import type { DefineElementContext, EventDefinition } from '@zeus-js/zeus'
import type { ChatMessageActionDetail } from '../types'

import { defineElement, event, Host, prop, Slot } from '@zeus-js/zeus'

export interface ChatCodeBlockProps {
  language?: string
  filename?: string
  copied?: boolean
}

export interface ChatCodeBlockElement extends HTMLElement {}

interface ChatCodeBlockEmits extends Record<string, EventDefinition<unknown>> {
  codeAction: EventDefinition<ChatMessageActionDetail>
}

function setup(
  props: ChatCodeBlockProps,
  _ctx: DefineElementContext<ChatCodeBlockElement, ChatCodeBlockEmits>,
) {
  return (
    <Host
      part="root"
      data-slot="chat-code-block-root"
      data-language={() => props.language}
      data-filename={() => props.filename}
      data-copied={() => (props.copied ? '' : undefined)}
    >
      <figure part="figure" data-slot="chat-code-block">
        <figcaption part="header" data-slot="chat-code-block-header">
          <span part="filename" data-slot="chat-code-block-filename">
            <Slot name="filename">{props.filename ?? ''}</Slot>
          </span>

          <span part="language" data-slot="chat-code-block-language">
            <Slot name="language">{props.language ?? ''}</Slot>
          </span>

          <div part="actions" data-slot="chat-code-block-actions">
            <Slot name="actions" />
          </div>
        </figcaption>

        <pre part="pre" data-slot="chat-code-block-pre">
          <code part="code" data-slot="chat-code-block-code">
            <Slot />
          </code>
        </pre>
      </figure>
    </Host>
  )
}

export const ChatCodeBlock = defineElement<
  ChatCodeBlockProps,
  ChatCodeBlockElement,
  ChatCodeBlockEmits
>(
  'zw-chat-code-block',
  {
    shadow: false,
    props: {
      language: prop(String, {
        reflect: true,
      }),
      filename: String,
      copied: prop(Boolean, {
        reflect: true,
      }),
    },
    emits: {
      codeAction: event<ChatMessageActionDetail>(),
    },
    meta: {
      description: 'Headless chat code block advanced component.',
    },
  },
  setup,
)
