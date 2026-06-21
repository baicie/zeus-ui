import type { DefineElementContext, EventDefinition } from '@zeus-js/zeus'
import type {
  ChatAttachmentChangeDetail,
  ChatSendDetail,
  ChatValueChangeDetail,
} from '../types'

import { defineElement, event, Host, prop, Slot } from '@zeus-js/zeus'
import { createComposerState, shouldSubmitFromKeyboardEvent } from '../core'

export interface ChatComposerProps {
  value?: string
  defaultValue?: string
  placeholder?: string
  disabled?: boolean
  loading?: boolean
  submitOnEnter?: boolean
  rows?: number
  maxLength?: number
  ariaLabel?: string
}

export interface ChatComposerElement extends HTMLElement {
  value?: string
  focus: () => void
  clear: () => void
  submit: () => void
}

interface ChatComposerEmits extends Record<string, EventDefinition<unknown>> {
  send: EventDefinition<ChatSendDetail>
  valueChange: EventDefinition<ChatValueChangeDetail>
  attachmentChange: EventDefinition<ChatAttachmentChangeDetail>
}

function resolveInitialValue(props: ChatComposerProps): string {
  if (props.value !== undefined) return props.value
  if (props.defaultValue !== undefined) return props.defaultValue
  return ''
}

function normalizeRows(value: number | undefined): number {
  if (!value || !Number.isFinite(value) || value <= 0) return 3
  return Math.max(1, Math.floor(value))
}

function setup(
  props: ChatComposerProps,
  ctx: DefineElementContext<ChatComposerElement, ChatComposerEmits>,
) {
  let control: HTMLTextAreaElement | undefined
  const composer = createComposerState(resolveInitialValue(props))

  const setControlValue = (value: string) => {
    if (control) control.value = value
    ctx.host.value = value
    composer.setValue(value)
  }

  const emitValueChange = (nativeEvent: Event) => {
    const value = control?.value ?? ''
    composer.setValue(value)
    ctx.host.value = value
    ctx.emit.valueChange({ value, nativeEvent })
  }

  const submit = (nativeEvent: Event | KeyboardEvent) => {
    const value = (control?.value ?? composer.getValue()).trim()

    if (!value || props.disabled || props.loading) return

    ctx.emit.send({
      value,
      attachments: composer.getAttachments(),
      nativeEvent,
    })

    setControlValue('')
    composer.clearAttachments()

    ctx.emit.attachmentChange({
      attachments: [],
      nativeEvent,
    })
  }

  ctx.expose({
    focus(): void {
      control?.focus()
    },

    clear(): void {
      setControlValue('')
      composer.clearAttachments()
      ctx.emit.attachmentChange({
        attachments: [],
      })
    },

    submit(): void {
      const event = new Event('submit')
      submit(event)
    },
  })

  return (
    <Host
      part="root"
      data-slot="chat-composer-root"
      data-disabled={() => (props.disabled ? '' : undefined)}
      data-loading={() => (props.loading ? '' : undefined)}
    >
      <form
        part="form"
        data-slot="chat-composer"
        onSubmit={(nativeEvent: Event) => {
          nativeEvent.preventDefault()
          submit(nativeEvent)
        }}
      >
        <div part="prefix" data-slot="chat-composer-prefix">
          <Slot name="prefix" />
        </div>

        <div part="attachments" data-slot="chat-composer-attachments">
          <Slot name="attachments" />
        </div>

        <textarea
          ref={(element: HTMLTextAreaElement | null) => {
            if (element) {
              control = element
              control.value = resolveInitialValue(props)
            }
          }}
          part="control"
          data-slot="chat-composer-control"
          prop:value={() => props.value ?? composer.getValue()}
          placeholder={() => props.placeholder}
          disabled={() => Boolean(props.disabled)}
          rows={() => normalizeRows(props.rows)}
          maxLength={() => props.maxLength}
          aria-label={() => props.ariaLabel}
          onInput={emitValueChange}
          onKeyDown={(nativeEvent: KeyboardEvent) => {
            if (
              shouldSubmitFromKeyboardEvent(
                nativeEvent,
                props.submitOnEnter !== false,
              )
            ) {
              nativeEvent.preventDefault()
              submit(nativeEvent)
            }
          }}
        />

        <button
          part="submit"
          data-slot="chat-composer-submit"
          type="submit"
          disabled={() => Boolean(props.disabled || props.loading)}
        >
          <Slot name="submit">Send</Slot>
        </button>

        <div part="suffix" data-slot="chat-composer-suffix">
          <Slot name="suffix" />
        </div>
      </form>
    </Host>
  )
}

export const ChatComposer = defineElement<
  ChatComposerProps,
  ChatComposerElement,
  ChatComposerEmits
>(
  'zw-chat-composer',
  {
    shadow: false,
    props: {
      value: {
        type: String,
        reflect: true,
      },
      defaultValue: {
        type: String,
        attr: 'default-value',
      },
      placeholder: String,
      disabled: prop(Boolean, {
        reflect: true,
      }),
      loading: prop(Boolean, {
        reflect: true,
      }),
      submitOnEnter: prop(Boolean, {
        attr: 'submit-on-enter',
        default: true,
      }),
      rows: prop(Number, {
        default: 3,
      }),
      maxLength: prop(Number, {
        attr: 'max-length',
      }),
      ariaLabel: prop(String, {
        attr: 'aria-label',
      }),
    },
    emits: {
      send: event<ChatSendDetail>(),
      valueChange: event<ChatValueChangeDetail>(),
      attachmentChange: event<ChatAttachmentChangeDetail>(),
    },
    meta: {
      description: 'Headless chat composer advanced component.',
    },
  },
  setup,
)
