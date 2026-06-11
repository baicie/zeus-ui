import { defineElement, Host, prop } from '@zeus-js/zeus'

export type SeparatorOrientation = 'horizontal' | 'vertical'

export interface SeparatorProps {
  orientation?: SeparatorOrientation
  decorative?: boolean
}

export interface SeparatorElement extends HTMLElement {}

export const Separator = defineElement<SeparatorProps, SeparatorElement>(
  'zw-separator',
  {
    shadow: false,
    props: {
      orientation: prop(['horizontal', 'vertical'], {
        default: 'horizontal',
        reflect: true,
      }),
      decorative: prop(Boolean, {
        default: true,
      }),
    },
    meta: {
      description: 'Headless separator primitive.',
    },
  },
  props => (
    <Host
      part="root"
      data-slot="separator-root"
      data-orientation={() => props.orientation}
      role={() => (props.decorative ? undefined : 'separator')}
      aria-orientation={() =>
        props.decorative ? undefined : props.orientation || 'horizontal'
      }
      aria-hidden={() => (props.decorative ? 'true' : undefined)}
    />
  ),
)
