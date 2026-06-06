import type { DefineElementContext, EventDefinition } from '@zeus-js/zeus'
import { defineElement, event, Host, prop, Slot } from '@zeus-js/zeus'

export type InputType =
  | 'text'
  | 'email'
  | 'password'
  | 'search'
  | 'tel'
  | 'url'
  | 'number'

export type InputSize = 'sm' | 'md' | 'lg'

export interface InputProps {
  value?: string
  defaultValue?: string
  type?: InputType
  size?: InputSize
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  required?: boolean
  invalid?: boolean
  name?: string
  formatter?: (value: string) => string
}

export interface InputValueChangeDetail {
  value: string
  nativeEvent: Event
}

export interface InputFocusChangeDetail {
  focused: boolean
  nativeEvent: FocusEvent
}

export interface InputElement extends HTMLElement {
  value?: string
  focus: () => void
  blur: () => void
  select: () => void
}

interface InputEmits extends Record<string, EventDefinition<unknown>> {
  valueChange: EventDefinition<InputValueChangeDetail>
  focusChange: EventDefinition<InputFocusChangeDetail>
}

function resolveInputValue(props: InputProps): string {
  if (props.value !== undefined) return props.value
  if (props.defaultValue !== undefined) return props.defaultValue
  return ''
}

function setup(
  props: InputProps,
  ctx: DefineElementContext<InputElement, InputEmits>,
) {
  let control!: HTMLInputElement

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
      data-slot="input-root"
      data-size={() => props.size}
      data-disabled={() => (props.disabled ? '' : undefined)}
      data-invalid={() => (props.invalid ? '' : undefined)}
    >
      <label part="root">
        <span part="prefix" data-slot="input-prefix">
          <Slot name="prefix" />
        </span>

        <input
          ref={(element: HTMLInputElement | null) => {
            if (element) control = element
          }}
          part="control"
          data-slot="input"
          prop:type={() => props.type || 'text'}
          prop:value={() => resolveInputValue(props)}
          placeholder={() => props.placeholder}
          disabled={() => Boolean(props.disabled)}
          readOnly={() => Boolean(props.readonly)}
          required={() => Boolean(props.required)}
          name={() => props.name}
          aria-invalid={() => (props.invalid ? 'true' : undefined)}
          onInput={handleInput}
          onFocus={nativeEvent => {
            ctx.emit.focusChange({ focused: true, nativeEvent })
          }}
          onBlur={nativeEvent => {
            ctx.emit.focusChange({ focused: false, nativeEvent })
          }}
        />

        <span part="suffix" data-slot="input-suffix">
          <Slot name="suffix" />
        </span>
      </label>

      <div part="message" data-slot="input-message">
        <Slot name="message" />
      </div>
    </Host>
  )
}

export const Input = defineElement<InputProps, InputElement, InputEmits>(
  'zw-input',
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
      type: prop(
        ['text', 'email', 'password', 'search', 'tel', 'url', 'number'],
        {
          default: 'text',
          reflect: true,
        },
      ),
      size: prop(['sm', 'md', 'lg'], {
        default: 'md',
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
      description: 'Headless input primitive.',
    },
  },
  setup,
)
