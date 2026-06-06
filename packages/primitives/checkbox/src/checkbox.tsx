import type { DefineElementContext, EventDefinition } from '@zeus-js/zeus'
import { defineElement, event, Host, prop, Slot } from '@zeus-js/zeus'

export type CheckboxSize = 'sm' | 'md' | 'lg'

export interface CheckboxProps {
  checked?: boolean
  defaultChecked?: boolean
  indeterminate?: boolean
  size?: CheckboxSize
  disabled?: boolean
  required?: boolean
  invalid?: boolean
  name?: string
  value?: string
}

export interface CheckboxCheckedChangeDetail {
  checked: boolean
  nativeEvent: Event
}

export interface CheckboxFocusChangeDetail {
  focused: boolean
  nativeEvent: FocusEvent
}

export interface CheckboxElement extends HTMLElement {
  checked?: boolean
  indeterminate?: boolean
  focus: () => void
  blur: () => void
}

interface CheckboxEmits extends Record<string, EventDefinition<unknown>> {
  checkedChange: EventDefinition<CheckboxCheckedChangeDetail>
  focusChange: EventDefinition<CheckboxFocusChangeDetail>
}

function resolveChecked(props: CheckboxProps): boolean {
  if (props.checked !== undefined) return Boolean(props.checked)
  if (props.defaultChecked !== undefined) return Boolean(props.defaultChecked)
  return false
}

function setup(
  props: CheckboxProps,
  ctx: DefineElementContext<CheckboxElement, CheckboxEmits>,
) {
  let control!: HTMLInputElement

  const handleChange = (nativeEvent: Event) => {
    const checked = control.checked

    ctx.host.checked = checked
    ctx.emit.checkedChange({ checked, nativeEvent })
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
      data-slot="checkbox-root"
      data-state={() =>
        props.indeterminate
          ? 'indeterminate'
          : resolveChecked(props)
            ? 'checked'
            : 'unchecked'
      }
      data-size={() => props.size}
      data-disabled={() => (props.disabled ? '' : undefined)}
      data-invalid={() => (props.invalid ? '' : undefined)}
    >
      <label part="root">
        <input
          ref={(element: HTMLInputElement | null) => {
            if (element) control = element
            if (element) element.indeterminate = Boolean(props.indeterminate)
          }}
          part="control"
          data-slot="checkbox-control"
          prop:type={() => 'checkbox'}
          prop:checked={() => resolveChecked(props)}
          disabled={() => Boolean(props.disabled)}
          required={() => Boolean(props.required)}
          name={() => props.name}
          value={() => props.value}
          aria-invalid={() => (props.invalid ? 'true' : undefined)}
          onChange={handleChange}
          onFocus={nativeEvent => {
            ctx.emit.focusChange({ focused: true, nativeEvent })
          }}
          onBlur={nativeEvent => {
            ctx.emit.focusChange({ focused: false, nativeEvent })
          }}
        />

        <span part="indicator" data-slot="checkbox-indicator">
          <Slot name="indicator" />
        </span>

        <span part="label" data-slot="checkbox-label">
          <Slot />
        </span>
      </label>
    </Host>
  )
}

export const Checkbox = defineElement<
  CheckboxProps,
  CheckboxElement,
  CheckboxEmits
>(
  'zw-checkbox',
  {
    shadow: false,
    props: {
      checked: prop(Boolean, {
        reflect: true,
      }),
      defaultChecked: prop(Boolean, {
        attr: 'default-checked',
      }),
      indeterminate: prop(Boolean, {
        reflect: true,
      }),
      size: prop(['sm', 'md', 'lg'], {
        default: 'md',
        reflect: true,
      }),
      disabled: prop(Boolean),
      required: prop(Boolean),
      invalid: prop(Boolean),
      name: String,
      value: String,
    },
    emits: {
      checkedChange: event<CheckboxCheckedChangeDetail>(),
      focusChange: event<CheckboxFocusChangeDetail>(),
    },
    meta: {
      description: 'Headless checkbox primitive.',
    },
  },
  setup,
)
