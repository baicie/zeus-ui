import type { DefineElementContext, EventDefinition } from '@zeus-js/zeus'
import type { DOMContext } from '@zeus-web/zeus-compat'
import {
  createContext,
  defineElement,
  event,
  Host,
  prop,
  Slot,
} from '@zeus-js/zeus'
import { provideDOMContext, resolveDOMContext } from '@zeus-web/zeus-compat'

export interface DialogProps {
  open?: boolean
  defaultOpen?: boolean
  modal?: boolean
}

export interface DialogOpenChangeDetail {
  open: boolean
  nativeEvent?: Event
}

export interface DialogElement extends HTMLElement {
  open?: boolean
  show: () => void
  close: () => void
}

interface DialogEmits extends Record<string, EventDefinition<unknown>> {
  openChange: EventDefinition<DialogOpenChangeDetail>
}

interface DialogContextValue {
  getOpen: () => boolean
  setOpen: (open: boolean, nativeEvent?: Event) => void
  isModal: () => boolean
  getContentId: () => string
  getTitleId: () => string
  getDescriptionId: () => string
  registerTrigger: (element: HTMLElement) => void
  registerContent: (element: HTMLElement) => void
  focusContent: () => void
  returnFocus: () => void
}

const DialogContext =
  createContext<DialogContextValue>() as DOMContext<DialogContextValue>

let dialogId = 0

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function createDialogId(part: string): string {
  dialogId += 1
  return `zw-dialog-${part}-${dialogId}`
}

function resolveOpen(props: DialogProps): boolean {
  if (props.open !== undefined) return Boolean(props.open)
  if (props.defaultOpen !== undefined) return Boolean(props.defaultOpen)
  return false
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(focusableSelector),
  ).filter(element => {
    if (element.hasAttribute('disabled')) return false
    if (element.getAttribute('aria-hidden') === 'true') return false
    if (element.tabIndex < 0) return false

    return true
  })
}

function focusFirstElement(container: HTMLElement): void {
  const focusable = getFocusableElements(container)
  const target = focusable[0] ?? container

  target.focus()
}

function trapFocus(container: HTMLElement, event: KeyboardEvent): void {
  if (event.key !== 'Tab') return

  const focusable = getFocusableElements(container)

  if (focusable.length === 0) {
    event.preventDefault()
    container.focus()
    return
  }

  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  const activeElement = document.activeElement

  if (event.shiftKey && activeElement === first) {
    event.preventDefault()
    last.focus()
    return
  }

  if (!event.shiftKey && activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

function setupDialog(
  props: DialogProps,
  ctx: DefineElementContext<DialogElement, DialogEmits>,
) {
  const contentId = createDialogId('content')
  const titleId = createDialogId('title')
  const descriptionId = createDialogId('description')

  let triggerElement: HTMLElement | undefined
  let contentElement: HTMLElement | undefined

  const context: DialogContextValue = {
    getOpen: () => resolveOpen(props),
    setOpen: (open, nativeEvent) => {
      ctx.host.open = open
      ctx.emit.openChange({ open, nativeEvent })

      if (open) {
        setTimeout(() => {
          context.focusContent()
        }, 0)
      } else {
        setTimeout(() => {
          context.returnFocus()
        }, 0)
      }
    },
    isModal: () => props.modal !== false,
    getContentId: () => contentId,
    getTitleId: () => titleId,
    getDescriptionId: () => descriptionId,
    registerTrigger: element => {
      triggerElement = element
    },
    registerContent: element => {
      contentElement = element
    },
    focusContent: () => {
      if (contentElement) {
        focusFirstElement(contentElement)
      }
    },
    returnFocus: () => {
      triggerElement?.focus()
    },
  }

  provideDOMContext(ctx.host, DialogContext, context)

  ctx.expose({
    show(): void {
      context.setOpen(true)
    },
    close(): void {
      context.setOpen(false)
    },
  })

  return (
    <Host
      data-slot="dialog-root"
      data-state={() => (context.getOpen() ? 'open' : 'closed')}
      data-modal={() => (context.isModal() ? '' : undefined)}
    >
      <Slot />
    </Host>
  )
}

export const Dialog = defineElement<DialogProps, DialogElement, DialogEmits>(
  'zw-dialog',
  {
    shadow: false,
    props: {
      open: prop(Boolean, {
        reflect: true,
      }),
      defaultOpen: prop(Boolean, {
        attr: 'default-open',
      }),
      modal: prop(Boolean, {
        default: true,
        reflect: true,
      }),
    },
    emits: {
      openChange: event<{
        open: boolean
        nativeEvent?: Event
      }>(),
    },
    meta: {
      description: 'Headless dialog root primitive.',
    },
  },
  setupDialog,
)

export interface DialogTriggerProps {
  disabled?: boolean
}

export interface DialogTriggerElement extends HTMLElement {
  focus: () => void
}

function setupDialogTrigger(
  props: DialogTriggerProps,
  ctx: DefineElementContext<DialogTriggerElement>,
) {
  const result = resolveDOMContext(ctx.host, DialogContext)
  const dialog = result.found ? result.value : undefined

  let control!: HTMLButtonElement

  ctx.expose({
    focus(): void {
      control.focus()
    },
  })

  return (
    <Host
      data-slot="dialog-trigger"
      data-disabled={() => (props.disabled ? '' : undefined)}
    >
      <button
        ref={(element: HTMLButtonElement | null) => {
          if (element) {
            control = element
            dialog?.registerTrigger(element)
          }
        }}
        part="trigger"
        prop:type={() => 'button'}
        disabled={() => Boolean(props.disabled)}
        aria-haspopup={() => 'dialog'}
        aria-controls={() => dialog?.getContentId()}
        aria-expanded={() => String(Boolean(dialog?.getOpen()))}
        onClick={nativeEvent => {
          if (!props.disabled) {
            dialog?.setOpen(true, nativeEvent)
          }
        }}
      >
        <Slot />
      </button>
    </Host>
  )
}

export const DialogTrigger = defineElement<
  DialogTriggerProps,
  DialogTriggerElement
>(
  'zw-dialog-trigger',
  {
    shadow: false,
    props: {
      disabled: prop(Boolean),
    },
    meta: {
      description: 'Headless dialog trigger primitive.',
    },
  },
  setupDialogTrigger,
)

export interface DialogContentProps {
  forceMount?: boolean
}

export interface DialogContentElement extends HTMLElement {
  focus: () => void
}

function setupDialogContent(
  props: DialogContentProps,
  ctx: DefineElementContext<DialogContentElement>,
) {
  const result = resolveDOMContext(ctx.host, DialogContext)
  const dialog = result.found ? result.value : undefined

  let panel!: HTMLDivElement

  const isOpen = () => Boolean(dialog?.getOpen())

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      dialog?.setOpen(false, event)
      return
    }

    if (dialog?.isModal()) {
      trapFocus(panel, event)
    }
  }

  ctx.expose({
    focus(): void {
      panel.focus()
    },
  })

  return (
    <Host
      data-slot="dialog-content"
      data-state={() => (isOpen() ? 'open' : 'closed')}
      hidden={() => (props.forceMount ? false : !isOpen())}
    >
      <div
        ref={(element: HTMLDivElement | null) => {
          if (element) {
            panel = element
            dialog?.registerContent(element)
          }
        }}
        id={() => dialog?.getContentId()}
        part="content"
        role="dialog"
        aria-modal={() => (dialog?.isModal() ? 'true' : undefined)}
        aria-labelledby={() => dialog?.getTitleId()}
        aria-describedby={() => dialog?.getDescriptionId()}
        tabIndex={() => -1}
        onKeyDown={handleKeyDown}
      >
        <Slot />
      </div>
    </Host>
  )
}

export const DialogContent = defineElement<
  DialogContentProps,
  DialogContentElement
>(
  'zw-dialog-content',
  {
    shadow: false,
    props: {
      forceMount: prop(Boolean, {
        attr: 'force-mount',
      }),
    },
    meta: {
      description: 'Headless dialog content primitive.',
    },
  },
  setupDialogContent,
)

export interface DialogCloseProps {
  disabled?: boolean
}

export interface DialogCloseElement extends HTMLElement {
  focus: () => void
}

function setupDialogClose(
  props: DialogCloseProps,
  ctx: DefineElementContext<DialogCloseElement>,
) {
  const result = resolveDOMContext(ctx.host, DialogContext)
  const dialog = result.found ? result.value : undefined

  let control!: HTMLButtonElement

  ctx.expose({
    focus(): void {
      control.focus()
    },
  })

  return (
    <Host
      data-slot="dialog-close"
      data-disabled={() => (props.disabled ? '' : undefined)}
    >
      <button
        ref={(element: HTMLButtonElement | null) => {
          if (element) control = element
        }}
        part="close"
        prop:type={() => 'button'}
        disabled={() => Boolean(props.disabled)}
        onClick={nativeEvent => {
          if (!props.disabled) {
            dialog?.setOpen(false, nativeEvent)
          }
        }}
      >
        <Slot />
      </button>
    </Host>
  )
}

export const DialogClose = defineElement<DialogCloseProps, DialogCloseElement>(
  'zw-dialog-close',
  {
    shadow: false,
    props: {
      disabled: prop(Boolean),
    },
    meta: {
      description: 'Headless dialog close primitive.',
    },
  },
  setupDialogClose,
)

export interface DialogTitleElement extends HTMLElement {}

export const DialogTitle = defineElement<object, DialogTitleElement>(
  'zw-dialog-title',
  {
    shadow: false,
    meta: {
      description: 'Headless dialog title primitive.',
    },
  },
  (_props: object, ctx: DefineElementContext<DialogTitleElement>) => {
    const result = resolveDOMContext(ctx.host, DialogContext)
    const dialog = result.found ? result.value : undefined

    return (
      <Host
        id={() => dialog?.getTitleId()}
        part="title"
        data-slot="dialog-title"
      >
        <Slot />
      </Host>
    )
  },
)

export interface DialogDescriptionElement extends HTMLElement {}

export const DialogDescription = defineElement<
  object,
  DialogDescriptionElement
>(
  'zw-dialog-description',
  {
    shadow: false,
    meta: {
      description: 'Headless dialog description primitive.',
    },
  },
  (_props: object, ctx: DefineElementContext<DialogDescriptionElement>) => {
    const result = resolveDOMContext(ctx.host, DialogContext)
    const dialog = result.found ? result.value : undefined

    return (
      <Host
        id={() => dialog?.getDescriptionId()}
        part="description"
        data-slot="dialog-description"
      >
        <Slot />
      </Host>
    )
  },
)
