import type { DefineElementContext, EventDefinition } from '@zeus-js/zeus'
import type { PopoverContextValue } from './popover-context'
import {
  createEffect,
  createSignal,
  defineElement,
  event,
  Host,
  prop,
  Slot,
} from '@zeus-js/zeus'
import { provideDOMContext, resolveDOMContext } from '@zeus-web/zeus-compat'
import { PopoverContext } from './popover-context'

export interface PopoverProps {
  open?: boolean
  defaultOpen?: boolean
  modal?: boolean
  disabled?: boolean
}
export interface PopoverElement extends HTMLElement {
  open?: boolean
  show: () => void
  hide: () => void
}
export interface PopoverOpenChangeDetail {
  open: boolean
  nativeEvent?: Event
}
interface PopoverEmits extends Record<string, EventDefinition<unknown>> {
  openChange: EventDefinition<PopoverOpenChangeDetail>
}
let popoverId = 0

function usePopoverContext(host: HTMLElement) {
  const [popover, setPopover] = createSignal<PopoverContextValue | undefined>(
    undefined,
  )
  const root = host.closest('zw-popover') as
    | (HTMLElement & { componentOnReady?: () => Promise<unknown> })
    | null

  const resolve = () => {
    const result = resolveDOMContext(host, PopoverContext)
    if (result.found) setPopover(result.value)
  }

  if (root?.componentOnReady) void root.componentOnReady().then(resolve)
  else resolve()

  return popover
}

function setupPopover(
  props: PopoverProps,
  ctx: DefineElementContext<PopoverElement, PopoverEmits>,
) {
  const contentId = `zw-popover-content-${++popoverId}`
  const controlled = props.open !== undefined
  const [open, setOpenState] = createSignal(
    controlled ? Boolean(props.open) : Boolean(props.defaultOpen),
  )
  let initialOpenSync = true
  createEffect(() => {
    const propOpen = Boolean(props.open)
    if (initialOpenSync) {
      initialOpenSync = false
      return
    }
    setOpenState(propOpen)
  })
  let trigger: HTMLElement | undefined
  let content: HTMLElement | undefined
  let focusRequest = 0
  let pendingFocus: 'content' | 'trigger' | undefined
  const value: PopoverContextValue = {
    getOpen: () => (controlled ? Boolean(props.open) : open()),
    isDisabled: () => Boolean(props.disabled),
    getContentId: () => contentId,
    registerTrigger: element => {
      trigger = element
    },
    focusTrigger: () => trigger?.focus(),
    registerContent: element => {
      content = element
    },
    focusContent: () => content?.focus(),
    setOpen: (nextOpen, nativeEvent, focusIntent) => {
      if (props.disabled) return
      focusRequest += 1
      pendingFocus =
        nextOpen !== value.getOpen()
          ? (focusIntent ?? (nextOpen ? 'content' : undefined))
          : undefined
      if (controlled) {
        ctx.emit.openChange({ open: nextOpen, nativeEvent })
        return
      }
      setOpenState(nextOpen)
      ctx.host.open = nextOpen
      ctx.emit.openChange({ open: nextOpen, nativeEvent })
    },
  }
  let previousOpen: boolean | undefined
  createEffect(() => {
    const isOpen = value.getOpen()
    const wasOpen = previousOpen
    previousOpen = isOpen
    if (wasOpen === undefined) {
      if (!isOpen) return
      const request = ++focusRequest
      setTimeout(() => {
        if (request === focusRequest && value.getOpen()) value.focusContent()
      }, 0)
      return
    }
    if (isOpen === wasOpen) return
    const intent = pendingFocus
    pendingFocus = undefined
    if (!intent) return
    const request = ++focusRequest
    const focus = intent === 'content' ? value.focusContent : value.focusTrigger
    setTimeout(() => {
      if (request === focusRequest && value.getOpen() === isOpen) focus()
    }, 0)
  })
  const outside = (nativeEvent: PointerEvent) => {
    if (!value.getOpen() || props.modal === false || !content) return
    const path = nativeEvent.composedPath?.() || []
    if (!path.includes(content) && !path.includes(ctx.host))
      value.setOpen(false, nativeEvent)
  }
  provideDOMContext(ctx.host, PopoverContext, value)
  ctx.expose({
    show: () => value.setOpen(true),
    hide: () => value.setOpen(false),
  })
  return (
    <Host
      ref={(element: HTMLElement | null) => {
        if (element) document.addEventListener('pointerdown', outside, true)
        else document.removeEventListener('pointerdown', outside, true)
      }}
      data-slot="popover-root"
      data-state={value.getOpen() ? 'open' : 'closed'}
    >
      <Slot />
    </Host>
  )
}
export const Popover = defineElement<
  PopoverProps,
  PopoverElement,
  PopoverEmits
>(
  'zw-popover',
  {
    shadow: false,
    props: {
      open: {
        type: Boolean,
        reflect: true,
        default: () => undefined as unknown as boolean,
      },
      defaultOpen: prop(Boolean, { attr: 'default-open' }),
      modal: prop(Boolean, { default: true }),
      disabled: prop(Boolean),
    },
    emits: { openChange: event<{ open: boolean; nativeEvent?: Event }>() },
    meta: { description: 'Headless popover root primitive.' },
  },
  setupPopover,
)

function setupTrigger(_props: object, ctx: DefineElementContext<HTMLElement>) {
  const popover = usePopoverContext(ctx.host)
  let trigger: HTMLButtonElement | undefined
  createEffect(() => {
    const value = popover()
    if (trigger && value) value.registerTrigger(trigger)
  })
  return (
    <Host data-slot="popover-trigger">
      <button
        ref={(element: HTMLButtonElement | null) => {
          trigger = element ?? undefined
          const value = popover()
          if (value) value.registerTrigger(trigger)
        }}
        part="trigger"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={String(Boolean(popover()?.getOpen()))}
        aria-controls={popover()?.getContentId()}
        disabled={Boolean(popover()?.isDisabled())}
        onClick={(event: MouseEvent) => {
          const value = popover()
          if (!value) return
          const nextOpen = !value.getOpen()
          value.setOpen(nextOpen, event, nextOpen ? 'content' : 'trigger')
        }}
      >
        <Slot />
      </button>
    </Host>
  )
}
export const PopoverTrigger = defineElement<object, HTMLElement>(
  'zw-popover-trigger',
  { shadow: false, meta: { description: 'Popover trigger.' } },
  setupTrigger,
)

export interface PopoverContentProps {
  forceMount?: boolean
}
function setupContent(
  props: PopoverContentProps,
  ctx: DefineElementContext<HTMLElement>,
) {
  const popover = usePopoverContext(ctx.host)
  let content: HTMLElement | undefined
  createEffect(() => {
    const value = popover()
    if (content && value) value.registerContent(content)
  })
  return (
    <Host
      ref={(element: HTMLElement | null) => {
        if (element) {
          element.tabIndex = -1
          content = element
          popover()?.registerContent(element)
        } else {
          content = undefined
        }
      }}
      id={popover()?.getContentId()}
      role="dialog"
      data-slot="popover-content"
      data-state={popover()?.getOpen() ? 'open' : 'closed'}
      hidden={props.forceMount ? false : !popover()?.getOpen()}
      onKeyDown={(nativeEvent: KeyboardEvent) => {
        if (nativeEvent.key === 'Escape') {
          nativeEvent.preventDefault()
          popover()?.setOpen(false, nativeEvent, 'trigger')
        }
      }}
    >
      <Slot />
    </Host>
  )
}
export const PopoverContent = defineElement<PopoverContentProps, HTMLElement>(
  'zw-popover-content',
  {
    shadow: false,
    props: { forceMount: prop(Boolean, { attr: 'force-mount' }) },
    meta: { description: 'Popover content with Escape dismissal.' },
  },
  setupContent,
)
