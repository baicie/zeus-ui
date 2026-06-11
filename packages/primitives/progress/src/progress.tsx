import { defineElement, Host, prop, Slot } from '@zeus-js/zeus'

export interface ProgressProps {
  value?: number
  max?: number
  indeterminate?: boolean
  label?: string
}

export interface ProgressElement extends HTMLElement {
  value?: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function getMax(props: ProgressProps): number {
  return Math.max(1, props.max ?? 100)
}
function getValue(props: ProgressProps): number {
  return clamp(props.value ?? 0, 0, getMax(props))
}
function getPercent(props: ProgressProps): number {
  return Math.round((getValue(props) / getMax(props)) * 100)
}

export const Progress = defineElement<ProgressProps, ProgressElement>(
  'zw-progress',
  {
    shadow: false,
    props: {
      value: { type: Number, reflect: true },
      max: prop(Number, { default: 100, reflect: true }),
      indeterminate: prop(Boolean, { reflect: true }),
      label: String,
    },
    meta: { description: 'Headless progress primitive.' },
  },
  props => (
    <Host
      part="root"
      data-slot="progress-root"
      data-state={() => (props.indeterminate ? 'indeterminate' : 'determinate')}
      data-value={() => String(getValue(props))}
      data-max={() => String(getMax(props))}
      data-percent={() => String(getPercent(props))}
      role="progressbar"
      aria-label={() => props.label}
      aria-valuemin={() => (props.indeterminate ? undefined : '0')}
      aria-valuemax={() =>
        props.indeterminate ? undefined : String(getMax(props))
      }
      aria-valuenow={() =>
        props.indeterminate ? undefined : String(getValue(props))
      }
      aria-valuetext={() =>
        props.indeterminate ? 'Loading' : `${getPercent(props)}%`
      }
    >
      <span
        part="indicator"
        data-slot="progress-indicator"
        data-value={() => String(getValue(props))}
        data-max={() => String(getMax(props))}
        data-percent={() => String(getPercent(props))}
      />
      <Slot />
    </Host>
  ),
)
