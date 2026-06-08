import type { DefineElementContext, EventDefinition } from '@zeus-js/zeus'
import {
  createContext,
  defineElement,
  event,
  Host,
  inject,
  prop,
  provide,
  Slot,
} from '@zeus-js/zeus'

export type TooltipSide = 'top' | 'right' | 'bottom' | 'left'

export interface TooltipProps {
  open?: boolean
  defaultOpen?: boolean
  disabled?: boolean
  delayDuration?: number
}

export interface TooltipOpenChangeDetail {
  open: boolean
  nativeEvent?: Event
}

export interface TooltipElement extends HTMLElement {
  open?: boolean
  show: () => void
  hide: () => void
}

interface TooltipEmits extends Record<string, EventDefinition<unknown>> {
  openChange: EventDefinition<TooltipOpenChangeDetail>
}

interface TooltipContextValue {
  getOpen: () => boolean
  setOpen: (open: boolean, nativeEvent?: Event) => void
  isDisabled: () => boolean
  getContentId: () => string
  getDelayDuration: () => number
}

const TooltipContext = createContext<TooltipContextValue>()
let tooltipId = 0

function createTooltipId(): string {
  tooltipId += 1
  return `zw-tooltip-content-${tooltipId}`
}

function resolveOpen(props: TooltipProps): boolean {
  if (props.open !== undefined) return Boolean(props.open)
  if (props.defaultOpen !== undefined) return Boolean(props.defaultOpen)
  return false
}

function setupTooltip(
  props: TooltipProps,
  ctx: DefineElementContext<TooltipElement, TooltipEmits>,
) {
  const contentId = createTooltipId()
  const context: TooltipContextValue = {
    getOpen: () => resolveOpen(props),
    setOpen: (open, nativeEvent) => {
      if (props.disabled) return
      ctx.host.open = open
      ctx.emit.openChange({ open, nativeEvent })
    },
    isDisabled: () => Boolean(props.disabled),
    getContentId: () => contentId,
    getDelayDuration: () => props.delayDuration ?? 300,
  }
  provide(TooltipContext, context)
  ctx.expose({
    show() {
      context.setOpen(true)
    },
    hide() {
      context.setOpen(false)
    },
  })
  return (
    <Host
      data-slot="tooltip-root"
      data-state={() => (context.getOpen() ? 'open' : 'closed')}
      data-disabled={() => (props.disabled ? '' : undefined)}
    >
      <Slot />
    </Host>
  )
}

export const Tooltip = defineElement<
  TooltipProps,
  TooltipElement,
  TooltipEmits
>(
  'zw-tooltip',
  {
    shadow: false,
    props: {
      open: prop(Boolean, { reflect: true }),
      defaultOpen: prop(Boolean, { attr: 'default-open' }),
      disabled: prop(Boolean),
      delayDuration: prop(Number, { attr: 'delay-duration', default: 300 }),
    },
    emits: { openChange: event<{ open: boolean; nativeEvent?: Event }>() },
    meta: { description: 'Headless tooltip root primitive.' },
  },
  setupTooltip,
)

export interface TooltipTriggerElement extends HTMLElement {
  focus: () => void
}

function setupTooltipTrigger(
  _props: object,
  ctx: DefineElementContext<TooltipTriggerElement>,
) {
  const tooltip = inject(TooltipContext)
  let control!: HTMLSpanElement
  let openTimer: ReturnType<typeof setTimeout> | undefined
  const clearOpenTimer = () => {
    if (openTimer) {
      clearTimeout(openTimer)
      openTimer = undefined
    }
  }
  const openWithDelay = (nativeEvent: Event) => {
    clearOpenTimer()
    if (tooltip?.isDisabled()) return
    openTimer = setTimeout(
      () => tooltip?.setOpen(true, nativeEvent),
      tooltip?.getDelayDuration() ?? 300,
    )
  }
  const close = (nativeEvent: Event) => {
    clearOpenTimer()
    tooltip?.setOpen(false, nativeEvent)
  }
  ctx.expose({
    focus() {
      control.focus()
    },
  })
  return (
    <Host
      part="trigger"
      data-slot="tooltip-trigger"
      data-state={() => (tooltip?.getOpen() ? 'open' : 'closed')}
    >
      <span
        ref={(e: HTMLSpanElement | null) => {
          if (e) control = e
        }}
        data-slot="tooltip-trigger-control"
        tabIndex={() => 0}
        aria-describedby={() =>
          tooltip?.getOpen() ? tooltip.getContentId() : undefined
        }
        onMouseEnter={openWithDelay}
        onMouseLeave={close}
        onFocus={openWithDelay}
        onBlur={close}
        onKeyDown={nativeEvent => {
          if (nativeEvent.key === 'Escape') {
            nativeEvent.preventDefault()
            close(nativeEvent)
          }
        }}
      >
        <Slot />
      </span>
    </Host>
  )
}

export const TooltipTrigger = defineElement<object, TooltipTriggerElement>(
  'zw-tooltip-trigger',
  {
    shadow: false,
    meta: { description: 'Headless tooltip trigger primitive.' },
  },
  setupTooltipTrigger,
)

export interface TooltipContentProps {
  side?: TooltipSide
  forceMount?: boolean
}
export interface TooltipContentElement extends HTMLElement {}

function setupTooltipContent(props: TooltipContentProps) {
  const tooltip = inject(TooltipContext)
  const isOpen = () => Boolean(tooltip?.getOpen())
  return (
    <Host
      id={() => tooltip?.getContentId()}
      part="content"
      data-slot="tooltip-content"
      role="tooltip"
      data-state={() => (isOpen() ? 'open' : 'closed')}
      data-side={() => props.side || 'top'}
      hidden={() => (props.forceMount ? false : !isOpen())}
    >
      <Slot />
    </Host>
  )
}

export const TooltipContent = defineElement<
  TooltipContentProps,
  TooltipContentElement
>(
  'zw-tooltip-content',
  {
    shadow: false,
    props: {
      side: prop(['top', 'right', 'bottom', 'left'], {
        default: 'top',
        reflect: true,
      }),
      forceMount: prop(Boolean, { attr: 'force-mount' }),
    },
    meta: { description: 'Headless tooltip content primitive.' },
  },
  setupTooltipContent,
)
