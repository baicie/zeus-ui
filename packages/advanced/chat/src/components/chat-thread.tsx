import type { DefineElementContext } from '@zeus-js/zeus'
import { defineElement, Host, prop, Slot } from '@zeus-js/zeus'

export interface ChatThreadProps {
  count?: number
  loading?: boolean
  empty?: boolean
  virtual?: boolean
  ariaLabel?: string
}

export interface ChatThreadElement extends HTMLElement {
  scrollToBottom: (options?: ScrollIntoViewOptions) => void
}

function setup(
  props: ChatThreadProps,
  ctx: DefineElementContext<ChatThreadElement>,
) {
  let viewport: HTMLElement | undefined

  ctx.expose({
    scrollToBottom(options?: ScrollIntoViewOptions): void {
      viewport?.scrollTo({
        top: viewport.scrollHeight,
        behavior: options?.behavior,
      })
    },
  })

  return (
    <Host
      part="root"
      data-slot="chat-thread-root"
      data-loading={() => (props.loading ? '' : undefined)}
      data-empty={() => (props.empty ? '' : undefined)}
      data-virtual={() => (props.virtual ? '' : undefined)}
      data-count={() => String(props.count ?? 0)}
    >
      <div
        ref={(element: HTMLElement | null) => {
          if (element) viewport = element
        }}
        part="viewport"
        data-slot="chat-thread"
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-busy={() => (props.loading ? 'true' : undefined)}
        aria-label={() => props.ariaLabel}
      >
        <Slot />
      </div>
    </Host>
  )
}

export const ChatThread = defineElement<ChatThreadProps, ChatThreadElement>(
  'zw-chat-thread',
  {
    shadow: false,
    props: {
      count: prop(Number, {
        default: 0,
      }),
      loading: prop(Boolean, {
        reflect: true,
      }),
      empty: prop(Boolean, {
        reflect: true,
      }),
      virtual: prop(Boolean, {
        reflect: true,
      }),
      ariaLabel: prop(String, {
        attr: 'aria-label',
      }),
    },
    meta: {
      description: 'Headless chat message thread advanced component.',
    },
  },
  setup,
)
