import { bindAttr, bindProp, defineElement } from '@zeus-js/runtime-dom'

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

function getInputValue(props: InputProps): string {
  if (props.value !== undefined) {
    return props.value
  }

  if (props.defaultValue !== undefined) {
    return props.defaultValue
  }

  return ''
}

function getDefaultValue(props: InputProps): string {
  return props.defaultValue === undefined ? '' : props.defaultValue
}

function getInputType(props: InputProps): InputType {
  return props.type === undefined ? 'text' : props.type
}

export const Input = defineElement<InputProps>(
  'zw-input',
  {
    shadow: false,
    props: {
      value: {
        type: String,
        default: '',
        reflect: true,
      },
      defaultValue: {
        type: String,
        attr: 'default-value',
        default: '',
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
      cssParts: ['input'],
    },
  },
  (props, { host, emit }) => {
    const input = document.createElement('input')

    input.part.add('input')
    input.setAttribute('data-slot', 'input')

    bindAttr(host, 'data-slot', () => 'input-root')
    bindAttr(host, 'data-disabled', () => (props.disabled ? '' : null))

    bindProp(input, 'value', () => getInputValue(props))
    bindProp(input, 'defaultValue', () => getDefaultValue(props))
    bindProp(input, 'type', () => getInputType(props))
    bindProp(input, 'disabled', () => Boolean(props.disabled))
    bindProp(input, 'readOnly', () => Boolean(props.readonly))
    bindProp(input, 'required', () => Boolean(props.required))

    bindAttr(input, 'placeholder', () => props.placeholder)
    bindAttr(input, 'name', () => props.name)

    input.addEventListener('input', nativeEvent => {
      emit('value-change', {
        value: input.value,
        nativeEvent,
      })
    })

    return input
  },
)
