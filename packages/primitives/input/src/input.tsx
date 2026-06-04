import type { DefineElementSetup } from '@zeus-web/zeus-compat'
import { defineElement, Host } from '@zeus-web/zeus-compat'

export type InputType =
  | 'text'
  | 'email'
  | 'password'
  | 'search'
  | 'tel'
  | 'url'
  | 'number'

export interface InputProps {
  value?: string
  defaultValue?: string
  type?: InputType
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  required?: boolean
  name?: string
}

export interface InputValueChangeDetail {
  value: string
  nativeEvent: Event
}

function resolveInputValue(props: InputProps): string | undefined {
  return props.value !== undefined
    ? props.value
    : props.defaultValue !== undefined
      ? props.defaultValue
      : undefined
}

const setup: DefineElementSetup<InputProps> = (props, ctx) => {
  const handleInput = (event: Event) => {
    const target = event.currentTarget as HTMLInputElement
    ctx.emit('value-change', {
      value: target.value,
      nativeEvent: event,
    })
  }

  return (
    <Host
      data-slot="input-root"
      data-disabled={props.disabled ? '' : undefined}
    >
      <input
        part="root"
        data-slot="input"
        type={props.type ?? 'text'}
        placeholder={props.placeholder}
        disabled={props.disabled}
        readOnly={props.readonly}
        required={props.required}
        name={props.name}
        value={resolveInputValue(props)}
        onInput={handleInput}
      />
    </Host>
  )
}

export const Input = defineElement<InputProps>(
  'zw-input',
  {
    shadow: false,
    props: {
      value: {
        type: String,
        default: undefined,
        reflect: true,
      },
      defaultValue: {
        type: String,
        attr: 'default-value',
        default: undefined,
      },
      type: {
        type: String,
        default: 'text',
        reflect: true,
      },
      placeholder: {
        type: String,
        default: '',
      },
      disabled: {
        type: Boolean,
        reflect: true,
      },
      readonly: {
        type: Boolean,
        attr: 'readonly',
        reflect: true,
      },
      required: {
        type: Boolean,
        reflect: true,
      },
      name: {
        type: String,
        default: '',
      },
    },
    meta: {
      description: 'Headless input primitive.',
      props: {
        value: {
          description: 'The controlled input value.',
        },
        defaultValue: {
          description: 'The initial input value.',
        },
        type: {
          description: 'The native input type.',
        },
        placeholder: {
          description: 'The input placeholder.',
        },
        disabled: {
          description: 'Whether the input is disabled.',
        },
      },
      events: {
        'value-change': {
          description: 'Emitted when the input value changes.',
          detail: {
            value: 'string',
            nativeEvent: 'Event',
          },
        },
      },
      cssParts: ['root'],
    },
  },
  setup,
)
