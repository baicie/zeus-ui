import type { DefineElementContext, EventDefinition } from '@zeus-js/zeus'
import type { DOMContext } from '@zeus-web/zeus-compat'
import {
  createEffect,
  createSignal,
  defineElement,
  event,
  Host,
  onCleanup,
  prop,
  Slot,
} from '@zeus-js/zeus'
import { provideDOMContext, resolveDOMContext } from '@zeus-web/zeus-compat'

export interface DialogProps {
  open?: boolean
  defaultOpen?: boolean
  modal?: boolean
  closeOnOutsideClick?: boolean
}

export interface DialogOpenChangeDetail {
  open: boolean
  nativeEvent?: Event
}

export interface DialogElement extends HTMLElement {
  open?: boolean
  defaultOpen?: boolean
  modal?: boolean
  closeOnOutsideClick?: boolean
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
  closeOnOutsideClick: () => boolean
}

// The dialog parts are emitted as separate lazy entries, so they need one
// context identity even when each entry evaluates this module independently.
const DialogContext = {
  id: Symbol.for('@zeus-web/dialog/context'),
} as unknown as DOMContext<DialogContextValue>

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

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(focusableSelector),
  ).filter(element => {
    if (element.hasAttribute('disabled')) return false
    if (element.getAttribute('aria-hidden') === 'true') return false
    if (element.tabIndex < 0) return false
    /*
     * A control inside a closed nested dialog is still in this container's
     * light DOM with a tab index; it is not, however, something a person can
     * reach. Focusing it is worse than useless — the browser then moves focus
     * off it to the body on the next Tab, which looks exactly like a broken
     * trap.
     *
     * Three separate ways a control can be present but unreachable, and each
     * needs its own check:
     *
     * - `display: none` anywhere up the tree (including a closed nested
     *   dialog) produces no box at all, so there are no client rects.
     * - `inert` produces a box and keeps its tab index, but focus() on it is a
     *   no-op, so a trap that picks it silently drops focus.
     * - `visibility: hidden` produces a box and is focusable in some engines,
     *   so it also has to be excluded explicitly. It inherits, and the computed
     *   value already reflects an ancestor's.
     */
    if (element.getClientRects().length === 0) return false
    if (element.closest('[inert]')) return false
    const visibility = getComputedStyle(element).visibility
    if (visibility === 'hidden' || visibility === 'collapse') return false

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

/**
 * Shared across every copy of this module that runs on the page.
 *
 * The dialog parts are emitted as separate lazy entries, and each entry is its
 * own bundle with its own module scope — a module-level `WeakSet` is therefore
 * one set *per component*, and a nested dialog's copy cannot see the press its
 * parent already handled. A registry keyed on the global object is the one
 * place all of them agree on.
 *
 * `Symbol.for` rather than a property name: the point is that two bundles
 * written from the same source agree without either of them owning the
 * definition.
 */
const ESCAPE_REGISTRY_KEY = Symbol.for('@zeus-web/dialog/consumed-escapes')

interface EscapeRegistry {
  /** Escape presses already answered by the topmost dialog. */
  readonly consumed: WeakSet<Event>
  /** Tokens of the open dialogs, bottom of the stack first. */
  readonly stack: symbol[]
}

const escapeRegistry: EscapeRegistry = (() => {
  const scope = globalThis as typeof globalThis & {
    [ESCAPE_REGISTRY_KEY]?: EscapeRegistry
  }
  scope[ESCAPE_REGISTRY_KEY] ??= {
    consumed: new WeakSet<Event>(),
    stack: [],
  }
  return scope[ESCAPE_REGISTRY_KEY]
})()

/**
 * Where an element records which mode it is in, so a rebuilt setup inherits it
 * instead of re-deriving it from a prop the component itself wrote.
 */
const DIALOG_STATE = Symbol.for('@zeus-web/dialog/state')

interface DialogStateRecord {
  readonly controlled: boolean
  /** The current open state, read lazily so a rebuild sees the live value. */
  readonly open: boolean
}

type DialogHost = HTMLElement & {
  [DIALOG_STATE]?: DialogStateRecord
}

const consumedEscapes = escapeRegistry.consumed
const dialogStack = escapeRegistry.stack

/*
 * Which dialog owns the keyboard. Modals can nest (a confirm opened from
 * inside another), and every instance listens on `document`, so without a
 * stack the Escape that dismisses the inner one would dismiss the outer one
 * too, and the trap underneath would fight the one on top.
 *
 * Tokens rather than elements: a disposed root removes its own entry through
 * `onCleanup`, so a removed dialog cannot leave a stale owner behind. The
 * stack lives in the shared registry for the same reason the escape set does —
 * every part of this component is a separate bundle.
 */
function pushDialog(token: symbol): void {
  dialogStack.push(token)
}

function removeDialog(token: symbol): void {
  const index = dialogStack.lastIndexOf(token)
  if (index >= 0) dialogStack.splice(index, 1)
}

function isTopmostDialog(token: symbol): boolean {
  return dialogStack[dialogStack.length - 1] === token
}

function setupDialog(
  props: DialogProps,
  ctx: DefineElementContext<DialogElement, DialogEmits>,
) {
  const contentId = createDialogId('content')
  const titleId = createDialogId('title')
  const descriptionId = createDialogId('description')

  /*
   * Controlled means "the owner decides", and the answer is fixed at setup.
   *
   * It must not be recomputed later. An uncontrolled dialog writes its own
   * `open` property — that is what keeps the reflected attribute (and any CSS
   * keyed off it) truthful — and a later `props.open !== undefined` check
   * would read that write as the owner taking over. The element would then
   * become controlled by nobody: it would open from the trigger once and
   * never respond to Escape or its own close control again.
   */
  /*
   * The mode is a property of the *element*, not of the setup run.
   *
   * Zeus re-runs a custom element's setup after a projection rebuild, and by
   * then an uncontrolled dialog has written its own `open` — so
   * `props.open !== undefined` would be true on the second run, and the element
   * would silently become a controlled one nobody controls: it would report
   * every close and never apply one. The decision is recorded once per host and
   * inherited by later setups of the same element.
   */
  const host = ctx.host as DialogHost
  const previous = host[DIALOG_STATE]
  const controlled = previous ? previous.controlled : props.open !== undefined
  const [stateOpen, setStateOpen] = createSignal(
    previous
      ? previous.open
      : controlled
        ? Boolean(props.open)
        : Boolean(props.defaultOpen),
  )
  const getOpen = (): boolean =>
    controlled ? Boolean(props.open) : stateOpen()

  /*
   * Recorded after `getOpen` exists, and as a lazy read: the value has to be
   * the live one at rebuild time, not the one this setup run saw.
   */
  host[DIALOG_STATE] = {
    controlled,
    get open() {
      return getOpen()
    },
  }

  let triggerElement: HTMLElement | undefined
  let contentElement: HTMLElement | undefined
  let previouslyFocused: HTMLElement | undefined
  /*
   * The last value this component itself wrote to `open`. An uncontrolled
   * element can still be driven from outside (`el.open = true`), and that
   * write is a command; the component's own write comes back through the
   * reflected attribute and is not.
   */
  let selfWritten: boolean | undefined
  const token = Symbol('zw-dialog')

  createEffect(() => {
    if (controlled) return
    const propOpen = props.open
    if (propOpen === undefined) return
    if (Boolean(propOpen) === selfWritten) return
    setStateOpen(Boolean(propOpen))
  })

  const context: DialogContextValue = {
    getOpen,
    setOpen: (open, nativeEvent) => {
      const changed = open !== getOpen()
      if (controlled) {
        /*
         * A controlled dialog reports and does nothing else. The attribute it
         * used to write here is the owner's to write: writing it made the
         * element's own state disagree with the owner's, and the next read of
         * `props.open` picked up the disagreement as if it were a command.
         */
        ctx.emit.openChange({ open, nativeEvent })
        return
      }
      selfWritten = open
      setStateOpen(open)
      ctx.host.open = open
      if (changed || nativeEvent) {
        ctx.emit.openChange({ open, nativeEvent })
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
      const target = triggerElement?.isConnected
        ? triggerElement
        : previouslyFocused
      if (target?.isConnected) target.focus()
    },
    closeOnOutsideClick: () => props.closeOnOutsideClick !== false,
  }

  /*
   * Focus follows the open state, not the call that changed it.
   *
   * Moving it inside `setOpen` covered only the component's own trigger,
   * close control and Escape. Every other way a dialog opens — a page writing
   * `el.open = true`, a router restoring state, a controlled owner
   * re-rendering — left focus on whatever had it before, which for a modal
   * means the page behind it.
   */
  let previousOpen: boolean | undefined
  let focusRequest = 0

  const scheduleFocusContent = (): void => {
    const request = ++focusRequest
    let attempts = 10
    const attempt = (): void => {
      setTimeout(() => {
        if (request !== focusRequest || !getOpen()) return
        if (!contentElement && attempts > 0) {
          // The content element is a separate lazy entry; it may not have
          // upgraded yet when the open state flips.
          attempts -= 1
          attempt()
          return
        }
        context.focusContent()
      }, 0)
    }
    attempt()
  }

  const scheduleReturnFocus = (): void => {
    const request = ++focusRequest
    setTimeout(() => {
      if (request !== focusRequest || getOpen()) return
      context.returnFocus()
    }, 0)
  }

  createEffect(() => {
    const isOpen = getOpen()
    const wasOpen = previousOpen
    previousOpen = isOpen
    if (wasOpen === undefined) {
      // A dialog that starts open must take focus too; otherwise the first
      // Tab of the interaction walks the page behind the modal.
      if (isOpen) {
        previouslyFocused =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : undefined
        pushDialog(token)
        scheduleFocusContent()
      }
      return
    }
    if (isOpen === wasOpen) return
    if (isOpen) {
      previouslyFocused =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : undefined
      pushDialog(token)
      scheduleFocusContent()
      return
    }
    removeDialog(token)
    scheduleReturnFocus()
  })

  onCleanup(() => removeDialog(token))

  const handleOutsidePointerDown = (event: PointerEvent) => {
    if (!host.isConnected) return
    if (
      !getOpen() ||
      props.modal === false ||
      context.closeOnOutsideClick() === false
    ) {
      return
    }
    const content = contentElement
    if (!content) return
    const path = event.composedPath?.() ?? []
    if (path.includes(content)) return
    context.setOpen(false, event)
  }

  /*
   * Escape and the Tab trap live on `document`, not on the panel.
   *
   * A listener on the panel only hears keys while focus is already inside it.
   * The cases that matter are exactly the ones where it is not: a modal that
   * opened programmatically never received focus at all, and on WebKit a Tab
   * from the panel is delivered to the next element in the document, so the
   * panel never sees the key that let focus escape. Both reproduced, and
   * neither is fixable from inside the panel.
   *
   * Only the topmost dialog acts, and only a modal traps: a non-modal dialog
   * is meant to let focus leave.
   */
  const handleDocumentKeyDown = (event: KeyboardEvent) => {
    /*
     * A detached root must not answer for a page it is no longer part of.
     *
     * The listener is removed when the host ref is cleared, but a light-DOM
     * host is also rebuilt by projection without that callback running on the
     * old scope — so the check is repeated against the live DOM rather than
     * trusted to the teardown alone. Without it, a rebuilt dialog keeps a stale
     * copy listening, and one Escape closes a layer the reader can still see.
     */
    if (!host.isConnected || !getOpen() || !isTopmostDialog(token)) return
    if (event.key === 'Escape') {
      if (consumedEscapes.has(event)) return
      consumedEscapes.add(event)
      event.preventDefault()
      context.setOpen(false, event)
      return
    }
    if (event.key !== 'Tab' || !context.isModal()) return
    const panel = contentElement
    if (!panel) return
    const active = document.activeElement
    if (!active || !panel.contains(active)) {
      event.preventDefault()
      focusFirstElement(panel)
      return
    }
    /*
     * The panel itself is a legal focus holder (`tabindex="-1"`), and engines
     * disagree on what Tab from it means: WebKit hands focus to the document
     * body, skipping the panel's own controls, which then lets the next Tab
     * reach the page behind the modal. Moving to the first control ourselves
     * makes the step deterministic instead of engine-defined.
     */
    if (active === panel) {
      event.preventDefault()
      focusFirstElement(panel)
      return
    }
    trapFocus(panel, event)
  }

  /*
   * The `focusin` backstop for the same gap: focus may already have landed
   * outside by the time any key is seen, and only `focusin` reports a move
   * that has already happened. It is on `document` for the same reason the
   * keydown is — an event that never reaches the panel cannot be heard there,
   * which is why the panel-level listener this replaces never fired.
   */
  const handleDocumentFocusIn = (event: FocusEvent) => {
    if (!host.isConnected) return
    if (!getOpen() || !context.isModal() || !isTopmostDialog(token)) return
    const panel = contentElement
    if (!panel) return
    const target = event.target
    if (!(target instanceof Node)) return
    if (panel.contains(target)) return
    /*
     * Focus going back to the trigger — or on to the close control — is what a
     * close does. Pulling it back would trap the reader in a dialog on its way
     * out, and `returnFocus` runs a tick later than the focus move that
     * caused it.
     */
    if (
      target instanceof Element &&
      (target.closest('[data-slot="dialog-trigger"]') ||
        target.closest('[data-slot="dialog-close"]'))
    ) {
      return
    }
    focusFirstElement(panel)
  }

  let documentListenersAttached = false

  const attachDocumentListeners = () => {
    if (documentListenersAttached) return
    document.addEventListener('pointerdown', handleOutsidePointerDown, true)
    document.addEventListener('keydown', handleDocumentKeyDown, true)
    document.addEventListener('focusin', handleDocumentFocusIn, true)
    documentListenersAttached = true
  }

  const detachDocumentListeners = () => {
    if (!documentListenersAttached) return
    document.removeEventListener('pointerdown', handleOutsidePointerDown, true)
    document.removeEventListener('keydown', handleDocumentKeyDown, true)
    document.removeEventListener('focusin', handleDocumentFocusIn, true)
    documentListenersAttached = false
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
      ref={(element: HTMLElement | null) => {
        if (element) {
          attachDocumentListeners()
        } else {
          detachDocumentListeners()
        }
      }}
      data-slot="dialog-root"
      data-state={context.getOpen() ? 'open' : 'closed'}
      data-modal={context.isModal() ? '' : undefined}
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
      open: {
        type: Boolean,
        reflect: true,
        default: () => undefined as unknown as boolean,
      },
      defaultOpen: prop(Boolean, {
        attr: 'default-open',
      }),
      modal: prop(Boolean, {
        default: true,
        reflect: true,
      }),
      closeOnOutsideClick: prop(Boolean, {
        attr: 'close-on-outside-click',
        default: true,
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
      data-disabled={props.disabled ? '' : undefined}
    >
      <button
        ref={(element: HTMLButtonElement | null) => {
          if (element) {
            control = element
            dialog?.registerTrigger(element)
          }
        }}
        part="trigger"
        type="button"
        disabled={Boolean(props.disabled)}
        aria-haspopup="dialog"
        aria-controls={dialog?.getContentId()}
        aria-expanded={String(Boolean(dialog?.getOpen()))}
        onClick={(nativeEvent: MouseEvent) => {
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

  ctx.expose({
    focus(): void {
      panel.focus()
    },
  })

  return (
    <Host
      data-slot="dialog-content"
      data-state={isOpen() ? 'open' : 'closed'}
      hidden={props.forceMount ? false : !isOpen()}
    >
      <div
        ref={(element: HTMLDivElement | null) => {
          if (!element) return
          panel = element
          dialog?.registerContent(element)
        }}
        id={dialog?.getContentId()}
        part="content"
        role="dialog"
        aria-modal={dialog?.isModal() ? 'true' : undefined}
        aria-labelledby={dialog?.getTitleId()}
        aria-describedby={dialog?.getDescriptionId()}
        tabIndex={-1}
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

export interface DialogOverlayElement extends HTMLElement {}

function setupDialogOverlay(
  props: { forceMount?: boolean },
  ctx: DefineElementContext<DialogOverlayElement>,
) {
  const result = resolveDOMContext(ctx.host, DialogContext)
  const dialog = result.found ? result.value : undefined
  const isOpen = () => Boolean(dialog?.getOpen())

  return (
    <Host
      part="overlay"
      data-slot="dialog-overlay"
      data-state={isOpen() ? 'open' : 'closed'}
      hidden={props.forceMount ? false : !isOpen()}
    >
      <Slot />
    </Host>
  )
}

export const DialogOverlay = defineElement<
  { forceMount?: boolean },
  DialogOverlayElement
>(
  'zw-dialog-overlay',
  {
    shadow: false,
    props: {
      forceMount: prop(Boolean, { attr: 'force-mount' }),
    },
    meta: { description: 'Dialog backdrop primitive.' },
  },
  setupDialogOverlay,
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
      data-disabled={props.disabled ? '' : undefined}
    >
      <button
        ref={(element: HTMLButtonElement | null) => {
          if (element) control = element
        }}
        part="close"
        type="button"
        disabled={Boolean(props.disabled)}
        onClick={(nativeEvent: MouseEvent) => {
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
      <Host id={dialog?.getTitleId()} part="title" data-slot="dialog-title">
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
        id={dialog?.getDescriptionId()}
        part="description"
        data-slot="dialog-description"
      >
        <Slot />
      </Host>
    )
  },
)
