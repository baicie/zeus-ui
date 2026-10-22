import type { DefineElementContext, EventDefinition } from '@zeus-js/zeus'
import type { DropdownMenuContextValue } from './dropdown-menu-context'
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
import { DropdownMenuContext } from './dropdown-menu-context'

export interface DropdownMenuProps {
  open?: boolean
  defaultOpen?: boolean
  disabled?: boolean
}
export interface DropdownMenuElement extends HTMLElement {
  open?: boolean
  show: () => void
  hide: () => void
}
export interface DropdownMenuOpenChangeDetail {
  open: boolean
  nativeEvent?: Event
}
interface DropdownMenuEmits extends Record<string, EventDefinition<unknown>> {
  openChange: EventDefinition<DropdownMenuOpenChangeDetail>
  select: EventDefinition<{ value?: string; nativeEvent: Event }>
}
function useDropdownMenuContext(host: HTMLElement) {
  const [menu, setMenu] = createSignal<DropdownMenuContextValue | undefined>(
    undefined,
  )
  const root = host.closest('zw-dropdown-menu') as
    | (HTMLElement & { componentOnReady?: () => Promise<unknown> })
    | null

  const resolve = () => {
    const result = resolveDOMContext(host, DropdownMenuContext)
    if (result.found) setMenu(result.value)
  }

  if (root?.componentOnReady) void root.componentOnReady().then(resolve)
  else resolve()

  return menu
}

let dropdownId = 0
function setupMenu(
  props: DropdownMenuProps,
  ctx: DefineElementContext<DropdownMenuElement, DropdownMenuEmits>,
) {
  const contentId = `zw-dropdown-menu-${++dropdownId}`
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
  const getEnabledItems = () =>
    Array.from(
      ctx.host.querySelectorAll<HTMLElement>(
        'zw-dropdown-menu-item[role="menuitem"]',
      ),
    ).filter(
      item =>
        !item.hasAttribute('disabled') &&
        item.getAttribute('aria-disabled') !== 'true',
    )
  let focusRequest = 0
  let pendingFocus: 'first' | 'last' | 'trigger' | undefined
  const value: DropdownMenuContextValue = {
    getOpen: () => (controlled ? Boolean(props.open) : open()),
    isDisabled: () => Boolean(props.disabled),
    getContentId: () => contentId,
    getEnabledItems,
    registerTrigger: element => {
      trigger = element
    },
    registerContent: element => {
      content = element
    },
    focusFirstItem: () => {
      const first = getEnabledItems()[0]
      ;(first ?? content)?.focus()
    },
    focusLastItem: () => {
      const items = getEnabledItems()
      ;(items[items.length - 1] ?? content)?.focus()
    },
    focusNextItem: direction => {
      const items = getEnabledItems()
      if (items.length === 0) {
        content?.focus()
        return
      }

      const activeIndex = items.indexOf(document.activeElement as HTMLElement)
      const nextIndex =
        activeIndex < 0
          ? direction === 1
            ? 0
            : items.length - 1
          : (activeIndex + direction + items.length) % items.length
      items[nextIndex]?.focus()
    },
    focusTrigger: () => trigger?.focus(),
    setOpen: (nextOpen, nativeEvent, focusIntent) => {
      if (props.disabled) return
      focusRequest += 1
      pendingFocus =
        nextOpen !== value.getOpen()
          ? (focusIntent ?? (nextOpen ? 'first' : undefined))
          : undefined
      if (controlled) {
        ctx.emit.openChange({ open: nextOpen, nativeEvent })
        return
      }
      setOpenState(nextOpen)
      ctx.host.open = nextOpen
      ctx.emit.openChange({ open: nextOpen, nativeEvent })
    },
    select: (itemValue, nativeEvent) => {
      ctx.emit.select({ value: itemValue, nativeEvent })
    },
    close: (nativeEvent, restoreFocus = false) => {
      value.setOpen(false, nativeEvent, restoreFocus ? 'trigger' : undefined)
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
        if (request === focusRequest && value.getOpen()) value.focusFirstItem()
      }, 0)
      return
    }
    if (isOpen === wasOpen) return
    const request = ++focusRequest
    const intent = pendingFocus
    pendingFocus = undefined
    if (!isOpen && intent !== 'trigger') return
    const focus = isOpen
      ? intent === 'last'
        ? value.focusLastItem
        : value.focusFirstItem
      : value.focusTrigger
    setTimeout(() => {
      if (request === focusRequest && value.getOpen() === isOpen) focus()
    }, 0)
  })
  const outside = (nativeEvent: PointerEvent) => {
    if (!value.getOpen()) return
    const path = nativeEvent.composedPath?.() || []
    if (!path.includes(ctx.host)) value.close(nativeEvent)
  }
  provideDOMContext(ctx.host, DropdownMenuContext, value)
  ctx.expose({ show: () => value.setOpen(true), hide: () => value.close() })
  return (
    <Host
      ref={(element: HTMLElement | null) => {
        if (element) document.addEventListener('pointerdown', outside, true)
        else document.removeEventListener('pointerdown', outside, true)
      }}
      data-slot="dropdown-menu-root"
      data-state={value.getOpen() ? 'open' : 'closed'}
    >
      <Slot />
    </Host>
  )
}
export const DropdownMenu = defineElement<
  DropdownMenuProps,
  DropdownMenuElement,
  DropdownMenuEmits
>(
  'zw-dropdown-menu',
  {
    shadow: false,
    props: {
      open: {
        type: Boolean,
        reflect: true,
        default: () => undefined as unknown as boolean,
      },
      defaultOpen: prop(Boolean, { attr: 'default-open' }),
      disabled: prop(Boolean),
    },
    emits: {
      openChange: event<{ open: boolean; nativeEvent?: Event }>(),
      select: event<{ value?: string; nativeEvent: Event }>(),
    },
    meta: { description: 'Headless dropdown menu root primitive.' },
  },
  setupMenu,
)

function setupTrigger(_props: object, ctx: DefineElementContext<HTMLElement>) {
  const menu = useDropdownMenuContext(ctx.host)
  let button: HTMLButtonElement | undefined
  const handleKeyDown = (nativeEvent: KeyboardEvent) => {
    if (nativeEvent.key !== 'ArrowDown' && nativeEvent.key !== 'ArrowUp') return
    const value = menu()
    if (!value || value.isDisabled()) return

    nativeEvent.preventDefault()
    if (!value.getOpen()) {
      value.setOpen(
        true,
        nativeEvent,
        nativeEvent.key === 'ArrowDown' ? 'first' : 'last',
      )
    } else if (nativeEvent.key === 'ArrowDown') {
      value.focusFirstItem()
    } else {
      value.focusLastItem()
    }
  }
  createEffect(() => {
    const value = menu()
    if (button && value) value.registerTrigger(button)
  })
  return (
    <Host data-slot="dropdown-menu-trigger">
      <button
        ref={(element: HTMLButtonElement | null) => {
          button = element ?? undefined
          const value = menu()
          if (button && value) value.registerTrigger(button)
        }}
        part="trigger"
        type="button"
        aria-haspopup="menu"
        aria-expanded={String(Boolean(menu()?.getOpen()))}
        aria-controls={menu()?.getContentId()}
        disabled={Boolean(menu()?.isDisabled())}
        onClick={(event: MouseEvent) => {
          const value = menu()
          if (!value) return
          const nextOpen = !value.getOpen()
          value.setOpen(nextOpen, event, nextOpen ? 'first' : 'trigger')
        }}
        onKeyDown={handleKeyDown}
      >
        <Slot />
      </button>
    </Host>
  )
}
export interface DropdownMenuTriggerElement extends HTMLElement {}

export const DropdownMenuTrigger = defineElement<
  object,
  DropdownMenuTriggerElement
>(
  'zw-dropdown-menu-trigger',
  { shadow: false, meta: { description: 'Dropdown menu trigger.' } },
  setupTrigger,
)

function setupContent(_props: object, ctx: DefineElementContext<HTMLElement>) {
  const menu = useDropdownMenuContext(ctx.host)
  const handleKeyDown = (nativeEvent: KeyboardEvent) => {
    if (nativeEvent.key === 'Tab') {
      menu()?.close(nativeEvent)
      return
    }

    if (nativeEvent.key === 'Escape') {
      nativeEvent.preventDefault()
      menu()?.close(nativeEvent, true)
      return
    }

    if (nativeEvent.key === 'ArrowDown') {
      nativeEvent.preventDefault()
      menu()?.focusNextItem(1)
      return
    }

    if (nativeEvent.key === 'ArrowUp') {
      nativeEvent.preventDefault()
      menu()?.focusNextItem(-1)
      return
    }

    if (nativeEvent.key === 'Home') {
      nativeEvent.preventDefault()
      menu()?.focusFirstItem()
      return
    }

    if (nativeEvent.key === 'End') {
      nativeEvent.preventDefault()
      menu()?.focusLastItem()
    }
  }
  let contentElement: HTMLElement | undefined
  createEffect(() => {
    const value = menu()
    if (contentElement && value) value.registerContent(contentElement)
  })
  return (
    <Host
      ref={(element: HTMLElement | null) => {
        if (contentElement) {
          contentElement.removeEventListener('keydown', handleKeyDown)
        }
        contentElement = element ?? undefined
        if (element) {
          element.tabIndex = -1
          element.addEventListener('keydown', handleKeyDown)
          menu()?.registerContent(element)
        }
      }}
      id={menu()?.getContentId()}
      role="menu"
      data-slot="dropdown-menu-content"
      hidden={!menu()?.getOpen()}
    >
      <Slot />
    </Host>
  )
}
export interface DropdownMenuContentElement extends HTMLElement {}

export const DropdownMenuContent = defineElement<
  object,
  DropdownMenuContentElement
>(
  'zw-dropdown-menu-content',
  {
    shadow: false,
    meta: { description: 'Dropdown menu content with Escape dismissal.' },
  },
  setupContent,
)

export interface DropdownMenuItemProps {
  value?: string
  disabled?: boolean
}
export interface DropdownMenuItemElement
  extends HTMLElement, DropdownMenuItemProps {}
function setupItem(
  props: DropdownMenuItemProps,
  ctx: DefineElementContext<DropdownMenuItemElement>,
) {
  const menu = useDropdownMenuContext(ctx.host)
  const handleKeyDown = (nativeEvent: KeyboardEvent) => {
    if (
      (nativeEvent.key === 'Enter' || nativeEvent.key === ' ') &&
      !props.disabled
    ) {
      nativeEvent.preventDefault()
      ctx.host.click()
    }
  }
  let itemElement: HTMLElement | undefined
  const handleClick = (nativeEvent: MouseEvent) => {
    if (!props.disabled && !menu()?.isDisabled()) {
      menu()?.close(nativeEvent, true)
      menu()?.select(props.value, nativeEvent)
    }
  }
  const attachItemListeners = (element: HTMLElement | null) => {
    if (itemElement) {
      itemElement.removeEventListener('click', handleClick)
      itemElement.removeEventListener('keydown', handleKeyDown)
    }
    itemElement = element ?? undefined
    if (element) {
      element.addEventListener('click', handleClick)
      element.addEventListener('keydown', handleKeyDown)
    }
  }
  return (
    <Host
      ref={attachItemListeners}
      role="menuitem"
      tabIndex={-1}
      aria-disabled={
        props.disabled || menu()?.isDisabled() ? 'true' : undefined
      }
      data-slot="dropdown-menu-item"
    >
      <Slot />
    </Host>
  )
}
export const DropdownMenuItem = defineElement<
  DropdownMenuItemProps,
  DropdownMenuItemElement
>(
  'zw-dropdown-menu-item',
  {
    shadow: false,
    props: { value: String, disabled: prop(Boolean) },
    meta: { description: 'Selectable dropdown menu item.' },
  },
  setupItem,
)
