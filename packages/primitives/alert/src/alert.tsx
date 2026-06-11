import { defineElement, Host, prop, Slot } from '@zeus-js/zeus'

export type AlertVariant = 'default' | 'info' | 'success' | 'warning' | 'danger'

export interface AlertProps {
  variant?: AlertVariant
  live?: 'polite' | 'assertive' | 'off'
}

export interface AlertElement extends HTMLElement {}

export const Alert = defineElement<AlertProps, AlertElement>(
  'zw-alert',
  {
    shadow: false,
    props: {
      variant: prop(['default', 'info', 'success', 'warning', 'danger'], {
        default: 'default',
        reflect: true,
      }),
      live: prop(['polite', 'assertive', 'off'], {
        default: 'polite',
        reflect: true,
      }),
    },
    meta: {
      description: 'Headless alert primitive.',
    },
  },
  props => (
    <Host
      part="root"
      data-slot="alert-root"
      data-variant={() => props.variant}
      role={() => (props.live === 'assertive' ? 'alert' : 'status')}
      aria-live={() => props.live}
    >
      <Slot />
    </Host>
  ),
)

export const AlertTitle = defineElement<object, HTMLElement>(
  'zw-alert-title',
  {
    shadow: false,
    meta: {
      description: 'Headless alert title primitive.',
    },
  },
  () => (
    <Host part="title" data-slot="alert-title">
      <Slot />
    </Host>
  ),
)

export const AlertDescription = defineElement<object, HTMLElement>(
  'zw-alert-description',
  {
    shadow: false,
    meta: {
      description: 'Headless alert description primitive.',
    },
  },
  () => (
    <Host part="description" data-slot="alert-description">
      <Slot />
    </Host>
  ),
)
