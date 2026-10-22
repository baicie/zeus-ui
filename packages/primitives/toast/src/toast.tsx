import type { DefineElementContext, EventDefinition } from '@zeus-js/zeus'
import type { ToastContextValue } from './toast-context'
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
import { ToastContext } from './toast-context'

export type ToastStatus = 'foreground' | 'background'
export interface ToastProps {
  open?: boolean
  defaultOpen?: boolean
  duration?: number
  status?: ToastStatus
}
export interface ToastElement extends HTMLElement {
  open?: boolean
  show: () => void
  hide: () => void
}
export interface ToastOpenChangeDetail {
  open: boolean
  nativeEvent?: Event
}
interface ToastEmits extends Record<string, EventDefinition<unknown>> {
  openChange: EventDefinition<ToastOpenChangeDetail>
}
let toastId = 0

function useToastContext(host: HTMLElement) {
  const [toast, setToast] = createSignal<ToastContextValue | undefined>(
    undefined,
  )
  const root = host.closest('zw-toast') as
    | (HTMLElement & { componentOnReady?: () => Promise<unknown> })
    | null

  const resolve = () => {
    const result = resolveDOMContext(host, ToastContext)
    if (result.found) setToast(result.value)
  }

  if (root?.componentOnReady) void root.componentOnReady().then(resolve)
  else resolve()

  return toast
}

function setupToast(
  props: ToastProps,
  ctx: DefineElementContext<ToastElement, ToastEmits>,
) {
  const id = `zw-toast-${++toastId}`
  let timer: ReturnType<typeof setTimeout> | undefined
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
  const getOpen = () => (controlled ? Boolean(props.open) : open())
  let schedule = (_duration?: number) => {}
  const setOpen = (nextOpen: boolean, nativeEvent?: Event) => {
    if (controlled) {
      ctx.emit.openChange({ open: nextOpen, nativeEvent })
      return
    }
    setOpenState(nextOpen)
    ctx.host.open = nextOpen
    ctx.emit.openChange({ open: nextOpen, nativeEvent })
    if (nextOpen) {
      schedule()
    } else if (timer) {
      clearTimeout(timer)
    }
  }
  schedule = (duration = props.duration) => {
    if (timer) clearTimeout(timer)
    if (getOpen() && duration !== 0) {
      timer = setTimeout(setOpen, duration || 5000, false)
    }
  }
  createEffect(() => {
    const open = getOpen()
    const duration = props.duration
    if (open) {
      schedule(duration)
    } else if (timer) {
      clearTimeout(timer)
      timer = undefined
    }
  })
  const value: ToastContextValue = {
    getOpen,
    getTitleId: () => `${id}-title`,
    getDescriptionId: () => `${id}-description`,
    setOpen,
  }
  provideDOMContext(ctx.host, ToastContext, value)
  ctx.expose({
    show: () => value.setOpen(true),
    hide: () => value.setOpen(false),
  })
  return (
    <Host
      ref={(element: HTMLElement | null) => {
        if (!element) {
          if (timer) clearTimeout(timer)
          timer = undefined
          return
        }
        schedule()
      }}
      role="status"
      aria-live={props.status === 'background' ? 'polite' : 'assertive'}
      aria-atomic="true"
      data-slot="toast"
      data-state={value.getOpen() ? 'open' : 'closed'}
      hidden={!value.getOpen()}
      onMouseEnter={() => {
        if (timer) clearTimeout(timer)
      }}
      onMouseLeave={() => schedule()}
    >
      <Slot />
    </Host>
  )
}
export const Toast = defineElement<ToastProps, ToastElement, ToastEmits>(
  'zw-toast',
  {
    shadow: false,
    props: {
      open: {
        type: Boolean,
        reflect: true,
        default: () => undefined as unknown as boolean,
      },
      defaultOpen: prop(Boolean, { attr: 'default-open' }),
      duration: prop(Number, { default: 5000 }),
      status: prop(['foreground', 'background'], { default: 'foreground' }),
    },
    emits: { openChange: event<{ open: boolean; nativeEvent?: Event }>() },
    meta: {
      description: 'Accessible toast with live region and auto-dismiss.',
    },
  },
  setupToast,
)

function setupTitle(_props: object, ctx: DefineElementContext<HTMLElement>) {
  const toast = useToastContext(ctx.host)
  return (
    <Host id={toast()?.getTitleId()} data-slot="toast-title">
      <Slot />
    </Host>
  )
}
export const ToastTitle = defineElement<object, HTMLElement>(
  'zw-toast-title',
  { shadow: false, meta: { description: 'Toast title.' } },
  setupTitle,
)
function setupDescription(
  _props: object,
  ctx: DefineElementContext<HTMLElement>,
) {
  const toast = useToastContext(ctx.host)
  return (
    <Host id={toast()?.getDescriptionId()} data-slot="toast-description">
      <Slot />
    </Host>
  )
}
export const ToastDescription = defineElement<object, HTMLElement>(
  'zw-toast-description',
  { shadow: false, meta: { description: 'Toast description.' } },
  setupDescription,
)
function setupClose(_props: object, ctx: DefineElementContext<HTMLElement>) {
  const toast = useToastContext(ctx.host)
  return (
    <Host data-slot="toast-close">
      <button
        type="button"
        aria-label="Close"
        onClick={(event: MouseEvent) => toast()?.setOpen(false, event)}
      >
        <Slot />
      </button>
    </Host>
  )
}
export const ToastClose = defineElement<object, HTMLElement>(
  'zw-toast-close',
  { shadow: false, meta: { description: 'Toast dismiss button.' } },
  setupClose,
)
function setupViewport(
  _props: object,
  _ctx: DefineElementContext<HTMLElement>,
) {
  return (
    <Host role="region" aria-label="Notifications" data-slot="toast-viewport">
      <Slot />
    </Host>
  )
}
export const ToastViewport = defineElement<object, HTMLElement>(
  'zw-toast-viewport',
  { shadow: false, meta: { description: 'Toast viewport landmark.' } },
  setupViewport,
)
