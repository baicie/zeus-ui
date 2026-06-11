import type { DefineElementContext, EventDefinition } from '@zeus-js/zeus'
import { defineElement, event, Host, prop, Slot } from '@zeus-js/zeus'

export type ButtonVariant =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'

export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

export type ButtonType = 'button' | 'submit' | 'reset'

export interface ButtonProps {
  ariaLabel?: string
  variant?: ButtonVariant
  size?: ButtonSize
  type?: ButtonType
  disabled?: boolean
  loading?: boolean
  pressed?: boolean
  name?: string
  value?: string
}

export interface ButtonPressDetail {
  nativeEvent: MouseEvent
}

export interface ButtonElement extends HTMLElement {
  focus: () => void
  blur: () => void
  click: () => void
}

interface ButtonEmits extends Record<string, EventDefinition<unknown>> {
  press: EventDefinition<ButtonPressDetail>
}

function setup(
  props: ButtonProps,
  ctx: DefineElementContext<ButtonElement, ButtonEmits>,
) {
  let control!: HTMLButtonElement

  const isDisabled = () => Boolean(props.disabled || props.loading)

  const handleClick = (nativeEvent: MouseEvent) => {
    if (isDisabled()) {
      nativeEvent.preventDefault()
      nativeEvent.stopPropagation()
      return
    }

    ctx.emit.press({ nativeEvent })
  }

  ctx.expose({
    focus(): void {
      control.focus()
    },
    blur(): void {
      control.blur()
    },
    click(): void {
      control.click()
    },
  })

  return (
    <Host
      data-slot="button-root"
      data-variant={() => props.variant}
      data-size={() => props.size}
      data-disabled={() => (isDisabled() ? '' : undefined)}
      data-loading={() => (props.loading ? '' : undefined)}
      data-pressed={() => (props.pressed ? '' : undefined)}
    >
      <button
        ref={(element: HTMLButtonElement | null) => {
          if (element) control = element
        }}
        part="button"
        data-slot="button"
        prop:type={() => props.type || 'button'}
        disabled={() => isDisabled()}
        aria-label={() => props.ariaLabel}
        aria-disabled={() => (isDisabled() ? 'true' : undefined)}
        aria-busy={() => (props.loading ? 'true' : undefined)}
        aria-pressed={() =>
          props.pressed === undefined
            ? undefined
            : String(Boolean(props.pressed))
        }
        name={() => props.name}
        value={() => props.value}
        onClick={handleClick}
      >
        <span part="prefix" data-slot="button-prefix">
          <Slot name="prefix" />
        </span>

        <span part="label" data-slot="button-label">
          <Slot />
        </span>

        <span part="suffix" data-slot="button-suffix">
          <Slot name="suffix" />
        </span>
      </button>
    </Host>
  )
}

export const Button = defineElement<ButtonProps, ButtonElement, ButtonEmits>(
  'zw-button',
  {
    shadow: false,
    props: {
      variant: prop(
        ['default', 'primary', 'secondary', 'outline', 'ghost', 'danger'],
        {
          default: 'default',
          reflect: true,
        },
      ),
      size: prop(['sm', 'md', 'lg', 'icon'], {
        default: 'md',
        reflect: true,
      }),
      type: prop(['button', 'submit', 'reset'], {
        default: 'button',
      }),
      disabled: prop(Boolean),
      loading: prop(Boolean),
      pressed: prop(Boolean, {
        reflect: true,
      }),
      name: String,
      value: String,
      ariaLabel: prop(String, {
        attr: 'aria-label',
      }),
    },
    emits: {
      press: event<{
        nativeEvent: MouseEvent
      }>(),
    },
    meta: {
      description: 'Headless button primitive.',
    },
  },
  setup,
)
