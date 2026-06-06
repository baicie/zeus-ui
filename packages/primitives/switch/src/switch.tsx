import type { DefineElementContext, EventDefinition } from '@zeus-js/zeus'
import { defineElement, event, Host, prop, Slot } from '@zeus-js/zeus'

export type SwitchSize = 'sm' | 'md' | 'lg'

export interface SwitchProps {
  checked?: boolean
  defaultChecked?: boolean
  size?: SwitchSize
  disabled?: boolean
  required?: boolean
  invalid?: boolean
  name?: string
  value?: string
}

export interface SwitchCheckedChangeDetail {
  checked: boolean
  nativeEvent: Event
}

export interface SwitchFocusChangeDetail {
  focused: boolean
  nativeEvent: FocusEvent
}

export interface SwitchElement extends HTMLElement {
  checked?: boolean
  focus: () => void
  blur: () => void
}

interface SwitchEmits extends Record<string, EventDefinition<unknown>> {
  checkedChange: EventDefinition<SwitchCheckedChangeDetail>
  focusChange: EventDefinition<SwitchFocusChangeDetail>
}

function resolveChecked(props: SwitchProps): boolean {
  if (props.checked !== undefined) return Boolean(props.checked)
  if (props.defaultChecked !== undefined) return Boolean(props.defaultChecked)
  return false
}

function setup(
  props: SwitchProps,
  ctx: DefineElementContext<SwitchElement, SwitchEmits>,
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
      data-slot="switch-root"
      data-state={() => (resolveChecked(props) ? 'checked' : 'unchecked')}
      data-size={() => props.size}
      data-disabled={() => (props.disabled ? '' : undefined)}
      data-invalid={() => (props.invalid ? '' : undefined)}
    >
      <label part="root">
        <input
          ref={(element: HTMLInputElement | null) => {
            if (element) control = element
          }}
          part="control"
          data-slot="switch-control"
          prop:type={() => 'checkbox'}
          prop:checked={() => resolveChecked(props)}
          role="switch"
          disabled={() => Boolean(props.disabled)}
          required={() => Boolean(props.required)}
          name={() => props.name}
          value={() => props.value}
          aria-checked={() => String(resolveChecked(props))}
          aria-invalid={() => (props.invalid ? 'true' : undefined)}
          onChange={handleChange}
          onFocus={nativeEvent => {
            ctx.emit.focusChange({ focused: true, nativeEvent })
          }}
          onBlur={nativeEvent => {
            ctx.emit.focusChange({ focused: false, nativeEvent })
          }}
        />

        <span part="track" data-slot="switch-track">
          <span part="thumb" data-slot="switch-thumb" />
        </span>

        <span part="label" data-slot="switch-label">
          <Slot />
        </span>
      </label>
    </Host>
  )
}

export const Switch = defineElement<SwitchProps, SwitchElement, SwitchEmits>(
  'zw-switch',
  {
    shadow: false,
    props: {
      checked: prop(Boolean, {
        reflect: true,
      }),
      defaultChecked: prop(Boolean, {
        attr: 'default-checked',
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
      checkedChange: event<SwitchCheckedChangeDetail>(),
      focusChange: event<SwitchFocusChangeDetail>(),
    },
    meta: {
      description: 'Headless switch primitive.',
    },
  },
  setup,
)
