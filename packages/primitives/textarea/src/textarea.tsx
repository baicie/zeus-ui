import type { DefineElementContext, EventDefinition } from '@zeus-js/zeus'
import { defineElement, event, Host, prop, Slot } from '@zeus-js/zeus'

export type TextareaSize = 'sm' | 'md' | 'lg'
export type TextareaResize = 'none' | 'vertical' | 'horizontal' | 'both'

export interface TextareaProps {
  id?: string
  value?: string
  defaultValue?: string
  size?: TextareaSize
  resize?: TextareaResize
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  required?: boolean
  invalid?: boolean
  name?: string
  rows?: number
  cols?: number
  minlength?: number
  maxlength?: number
  ariaLabel?: string
  ariaDescribedby?: string
  ariaErrormessage?: string
  formatter?: (value: string) => string
}

export interface TextareaValueChangeDetail {
  value: string
  nativeEvent: Event
}

export interface TextareaFocusChangeDetail {
  focused: boolean
  nativeEvent: FocusEvent
}

export interface TextareaElement extends HTMLElement {
  value?: string
  focus: () => void
  blur: () => void
  select: () => void
}

interface TextareaEmits extends Record<string, EventDefinition<unknown>> {
  valueChange: EventDefinition<TextareaValueChangeDetail>
  focusChange: EventDefinition<TextareaFocusChangeDetail>
}

function resolveTextareaValue(props: TextareaProps): string {
  if (props.value !== undefined) return props.value
  if (props.defaultValue !== undefined) return props.defaultValue
  return ''
}

function setup(
  props: TextareaProps,
  ctx: DefineElementContext<TextareaElement, TextareaEmits>,
) {
  let control!: HTMLTextAreaElement

  const formatValue = (value: string) =>
    typeof props.formatter === 'function' ? props.formatter(value) : value

  const handleInput = (nativeEvent: Event) => {
    const value = formatValue(control.value)

    control.value = value
    ctx.host.value = value
    ctx.emit.valueChange({ value, nativeEvent })
  }

  ctx.expose({
    focus(): void {
      control.focus()
    },
    blur(): void {
      control.blur()
    },
    select(): void {
      control.select()
    },
  })

  return (
    <Host
      data-slot="textarea-root"
      data-size={() => props.size}
      data-resize={() => props.resize}
      data-disabled={() => (props.disabled ? '' : undefined)}
      data-invalid={() => (props.invalid ? '' : undefined)}
    >
      <label part="root" for={() => props.id}>
        <textarea
          ref={(element: HTMLTextAreaElement | null) => {
            if (element) control = element
          }}
          id={() => props.id}
          part="control"
          data-slot="textarea"
          prop:value={() => resolveTextareaValue(props)}
          placeholder={() => props.placeholder}
          disabled={() => Boolean(props.disabled)}
          readOnly={() => Boolean(props.readonly)}
          required={() => Boolean(props.required)}
          name={() => props.name}
          rows={() => props.rows}
          cols={() => props.cols}
          minLength={() => props.minlength}
          maxLength={() => props.maxlength}
          aria-label={() => props.ariaLabel}
          aria-describedby={() => props.ariaDescribedby}
          aria-errormessage={() => props.ariaErrormessage}
          aria-invalid={() => (props.invalid ? 'true' : undefined)}
          onInput={handleInput}
          onFocus={nativeEvent => {
            ctx.emit.focusChange({ focused: true, nativeEvent })
          }}
          onBlur={nativeEvent => {
            ctx.emit.focusChange({ focused: false, nativeEvent })
          }}
        />
      </label>

      <div part="message" data-slot="textarea-message">
        <Slot name="message" />
      </div>
    </Host>
  )
}

export const Textarea = defineElement<
  TextareaProps,
  TextareaElement,
  TextareaEmits
>(
  'zw-textarea',
  {
    shadow: false,
    props: {
      id: String,
      value: {
        type: String,
        reflect: true,
      },
      defaultValue: {
        type: String,
        attr: 'default-value',
      },
      size: prop(['sm', 'md', 'lg'], {
        default: 'md',
        reflect: true,
      }),
      resize: prop(['none', 'vertical', 'horizontal', 'both'], {
        default: 'vertical',
        reflect: true,
      }),
      placeholder: String,
      disabled: prop(Boolean),
      readonly: prop(Boolean, {
        attr: 'readonly',
      }),
      required: prop(Boolean),
      invalid: prop(Boolean),
      name: String,
      rows: Number,
      cols: Number,
      minlength: prop(Number, {
        attr: 'minlength',
      }),
      maxlength: prop(Number, {
        attr: 'maxlength',
      }),
      ariaLabel: prop(String, {
        attr: 'aria-label',
      }),
      ariaDescribedby: prop(String, {
        attr: 'aria-describedby',
      }),
      ariaErrormessage: prop(String, {
        attr: 'aria-errormessage',
      }),
      formatter: Function,
    },
    emits: {
      valueChange: event<{ value: string; nativeEvent: Event }>(),
      focusChange: event<{
        focused: boolean
        nativeEvent: FocusEvent
      }>(),
    },
    meta: {
      description: 'Headless textarea primitive.',
    },
  },
  setup,
)
