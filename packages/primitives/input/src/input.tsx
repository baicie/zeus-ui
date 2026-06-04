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

const setup: DefineElementSetup = (props, ctx) => {
  const inputProps = props as InputProps
  const handleInput = (event: Event) => {
    const target = event.currentTarget as HTMLInputElement
    ;(ctx as { emit: (event: string, detail: unknown) => void }).emit(
      'value-change',
      {
        value: target.value,
        nativeEvent: event,
      },
    )
  }

  return (
    <Host
      data-slot="input-root"
      data-disabled={inputProps.disabled ? '' : undefined}
    >
      <input
        part="root"
        data-slot="input"
        type={inputProps.type ?? 'text'}
        placeholder={inputProps.placeholder}
        disabled={inputProps.disabled}
        readOnly={inputProps.readonly}
        required={inputProps.required}
        name={inputProps.name}
        value={resolveInputValue(inputProps)}
        onInput={handleInput}
      />
    </Host>
  )
}

export const Input = defineElement(
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
) as unknown as { new (): unknown } & typeof defineElement
