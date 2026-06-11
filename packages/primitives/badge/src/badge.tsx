import { defineElement, Host, prop, Slot } from '@zeus-js/zeus'

export type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'outline'
  | 'danger'
  | 'success'
  | 'warning'

export type BadgeSize = 'sm' | 'md' | 'lg'

export interface BadgeProps {
  variant?: BadgeVariant
  size?: BadgeSize
}

export interface BadgeElement extends HTMLElement {}

export const Badge = defineElement<BadgeProps, BadgeElement>(
  'zw-badge',
  {
    shadow: false,
    props: {
      variant: prop(
        ['default', 'secondary', 'outline', 'danger', 'success', 'warning'],
        {
          default: 'default',
          reflect: true,
        },
      ),
      size: prop(['sm', 'md', 'lg'], {
        default: 'md',
        reflect: true,
      }),
    },
    meta: {
      description: 'Headless badge primitive.',
    },
  },
  props => (
    <Host
      part="root"
      data-slot="badge-root"
      data-variant={() => props.variant}
      data-size={() => props.size}
    >
      <Slot />
    </Host>
  ),
)
