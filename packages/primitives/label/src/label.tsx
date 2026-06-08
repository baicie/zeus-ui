import type { DefineElementContext } from '@zeus-js/zeus'
import { defineElement, Host, prop, Slot } from '@zeus-js/zeus'

export type LabelSize = 'sm' | 'md' | 'lg'

export interface LabelProps {
  for?: string
  size?: LabelSize
  required?: boolean
  disabled?: boolean
  visuallyHidden?: boolean
}

export interface LabelElement extends HTMLElement {
  focus: () => void
}

function setup(props: LabelProps, ctx: DefineElementContext<LabelElement>) {
  let control!: HTMLLabelElement

  ctx.expose({
    focus(): void {
      control.focus()
    },
  })

  return (
    <Host
      data-slot="label-root"
      data-size={() => props.size}
      data-required={() => (props.required ? '' : undefined)}
      data-disabled={() => (props.disabled ? '' : undefined)}
      data-visually-hidden={() => (props.visuallyHidden ? '' : undefined)}
    >
      <label
        ref={(element: HTMLLabelElement | null) => {
          if (element) control = element
        }}
        part="label"
        data-slot="label"
        for={() => props.for}
        aria-disabled={() => (props.disabled ? 'true' : undefined)}
      >
        <Slot />
        <span
          part="required-indicator"
          data-slot="label-required-indicator"
          aria-hidden={() => 'true'}
          hidden={() => !props.required}
        >
          *
        </span>
      </label>
    </Host>
  )
}

export const Label = defineElement<LabelProps, LabelElement>(
  'zw-label',
  {
    shadow: false,
    props: {
      for: String,
      size: prop(['sm', 'md', 'lg'], {
        default: 'md',
        reflect: true,
      }),
      required: prop(Boolean),
      disabled: prop(Boolean),
      visuallyHidden: prop(Boolean, {
        attr: 'visually-hidden',
      }),
    },
    meta: {
      description: 'Headless label primitive.',
    },
  },
  setup,
)
