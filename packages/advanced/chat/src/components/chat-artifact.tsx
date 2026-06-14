import type { DefineElementContext, EventDefinition } from '@zeus-js/zeus'
import type { ChatArtifactKind, ChatArtifactOpenDetail } from '../types'

import { defineElement, event, Host, prop, Slot } from '@zeus-js/zeus'

export interface ChatArtifactProps {
  artifactId?: string
  kind?: ChatArtifactKind
  title?: string
  open?: boolean
}

export interface ChatArtifactElement extends HTMLElement {}

interface ChatArtifactEmits extends Record<string, EventDefinition<unknown>> {
  artifactOpen: EventDefinition<ChatArtifactOpenDetail>
}

function setup(
  props: ChatArtifactProps,
  _ctx: DefineElementContext<ChatArtifactElement, ChatArtifactEmits>,
) {
  return (
    <Host
      part="root"
      data-slot="chat-artifact-root"
      data-artifact-id={() => props.artifactId}
      data-kind={() => props.kind}
      data-open={() => (props.open ? '' : undefined)}
    >
      <section part="artifact" data-slot="chat-artifact">
        <header part="header" data-slot="chat-artifact-header">
          <Slot name="header">{props.title ?? ''}</Slot>
        </header>

        <div part="content" data-slot="chat-artifact-content">
          <Slot />
        </div>

        <footer part="footer" data-slot="chat-artifact-footer">
          <Slot name="footer" />
        </footer>

        <div part="actions" data-slot="chat-artifact-actions">
          <Slot name="actions" />
        </div>
      </section>
    </Host>
  )
}

export const ChatArtifact = defineElement<
  ChatArtifactProps,
  ChatArtifactElement,
  ChatArtifactEmits
>(
  'zw-chat-artifact',
  {
    shadow: false,
    props: {
      artifactId: prop(String, {
        attr: 'artifact-id',
      }),
      kind: prop(['text', 'code', 'table', 'chart', 'custom'], {
        default: 'custom',
        reflect: true,
      }),
      title: String,
      open: prop(Boolean, {
        reflect: true,
      }),
    },
    emits: {
      artifactOpen: event<ChatArtifactOpenDetail>(),
    },
    meta: {
      description: 'Headless chat artifact advanced component.',
    },
  },
  setup,
)
