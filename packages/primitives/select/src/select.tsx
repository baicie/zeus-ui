import type { DefineElementContext, EventDefinition } from '@zeus-js/zeus'
import { defineElement, event, Host, prop, Slot } from '@zeus-js/zeus'

export type SelectSize = 'sm' | 'md' | 'lg'

export interface SelectProps {
  id?: string
  value?: string
  defaultValue?: string
  size?: SelectSize
  disabled?: boolean
  required?: boolean
  invalid?: boolean
  multiple?: boolean
  name?: string
  ariaLabel?: string
  ariaDescribedby?: string
  ariaErrormessage?: string
}

export interface SelectValueChangeDetail {
  value: string
  values: string[]
  nativeEvent: Event
}

export interface SelectFocusChangeDetail {
  focused: boolean
  nativeEvent: FocusEvent
}

export interface SelectElement extends HTMLElement {
  value?: string
  focus: () => void
  blur: () => void
}

interface SelectEmits extends Record<string, EventDefinition<unknown>> {
  valueChange: EventDefinition<SelectValueChangeDetail>
  focusChange: EventDefinition<SelectFocusChangeDetail>
}

function resolveValue(props: SelectProps): string {
  if (props.value !== undefined) return props.value
  if (props.defaultValue !== undefined) return props.defaultValue
  return ''
}

function getSelectedValues(control: HTMLSelectElement): string[] {
  return Array.from(control.selectedOptions).map(option => option.value)
}

function setup(
  props: SelectProps,
  ctx: DefineElementContext<SelectElement, SelectEmits>,
) {
  let control!: HTMLSelectElement

  const handleChange = (nativeEvent: Event) => {
    const values = getSelectedValues(control)
    const value = control.value

    ctx.host.value = value
    ctx.emit.valueChange({ value, values, nativeEvent })
  }

  ctx.expose({
    focus(): void {
      control.focus()
    },
    blur(): void {
      control.blur()
    },
  })

  return (
    <Host
      data-slot="select-root"
      data-size={() => props.size}
      data-disabled={() => (props.disabled ? '' : undefined)}
      data-invalid={() => (props.invalid ? '' : undefined)}
    >
      <label part="root" for={() => props.id}>
        <select
          ref={(element: HTMLSelectElement | null) => {
            if (element) control = element
          }}
          id={() => props.id}
          part="control"
          data-slot="select"
          prop:value={() => resolveValue(props)}
          disabled={() => Boolean(props.disabled)}
          required={() => Boolean(props.required)}
          multiple={() => Boolean(props.multiple)}
          name={() => props.name}
          aria-label={() => props.ariaLabel}
          aria-describedby={() => props.ariaDescribedby}
          aria-errormessage={() => props.ariaErrormessage}
          aria-invalid={() => (props.invalid ? 'true' : undefined)}
          onChange={handleChange}
          onFocus={nativeEvent => {
            ctx.emit.focusChange({ focused: true, nativeEvent })
          }}
          onBlur={nativeEvent => {
            ctx.emit.focusChange({ focused: false, nativeEvent })
          }}
        >
          <Slot />
        </select>
      </label>

      <div part="message" data-slot="select-message">
        <Slot name="message" />
      </div>
    </Host>
  )
}

export const Select = defineElement<SelectProps, SelectElement, SelectEmits>(
  'zw-select',
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
      disabled: prop(Boolean),
      required: prop(Boolean),
      invalid: prop(Boolean),
      multiple: prop(Boolean),
      name: String,
      ariaLabel: prop(String, {
        attr: 'aria-label',
      }),
      ariaDescribedby: prop(String, {
        attr: 'aria-describedby',
      }),
      ariaErrormessage: prop(String, {
        attr: 'aria-errormessage',
      }),
    },
    emits: {
      valueChange: event<{
        value: string
        values: string[]
        nativeEvent: Event
      }>(),
      focusChange: event<{
        focused: boolean
        nativeEvent: FocusEvent
      }>(),
    },
    meta: {
      description: 'Headless native select primitive.',
    },
  },
  setup,
)
