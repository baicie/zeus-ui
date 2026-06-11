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

export interface CollapsibleProps {
  open?: boolean
  defaultOpen?: boolean
  disabled?: boolean
}

export interface CollapsibleOpenChangeDetail {
  open: boolean
  nativeEvent?: Event
}

export interface CollapsibleElement extends HTMLElement {
  open?: boolean
  show: () => void
  hide: () => void
  toggle: () => void
}

interface CollapsibleEmits extends Record<string, EventDefinition<unknown>> {
  openChange: EventDefinition<CollapsibleOpenChangeDetail>
}

interface CollapsibleContextValue {
  getOpen: () => boolean
  setOpen: (open: boolean, nativeEvent?: Event) => void
  isDisabled: () => boolean
  getContentId: () => string
}

const CollapsibleContext = createContext<CollapsibleContextValue>()

let collapsibleId = 0

function createContentId(): string {
  collapsibleId += 1
  return `zw-collapsible-content-${collapsibleId}`
}

function resolveOpen(props: CollapsibleProps): boolean {
  if (props.open !== undefined) return Boolean(props.open)
  if (props.defaultOpen !== undefined) return Boolean(props.defaultOpen)
  return false
}

function setupCollapsible(
  props: CollapsibleProps,
  ctx: DefineElementContext<CollapsibleElement, CollapsibleEmits>,
) {
  const contentId = createContentId()

  const context: CollapsibleContextValue = {
    getOpen: () => resolveOpen(props),
    setOpen: (open, nativeEvent) => {
      if (props.disabled) return
      ctx.host.open = open
      ctx.emit.openChange({ open, nativeEvent })
    },
    isDisabled: () => Boolean(props.disabled),
    getContentId: () => contentId,
  }

  provide(CollapsibleContext, context)

  ctx.expose({
    show(): void {
      context.setOpen(true)
    },
    hide(): void {
      context.setOpen(false)
    },
    toggle(): void {
      context.setOpen(!context.getOpen())
    },
  })

  return (
    <Host
      data-slot="collapsible-root"
      data-state={() => (context.getOpen() ? 'open' : 'closed')}
      data-disabled={() => (props.disabled ? '' : undefined)}
    >
      <Slot />
    </Host>
  )
}

export const Collapsible = defineElement<
  CollapsibleProps,
  CollapsibleElement,
  CollapsibleEmits
>(
  'zw-collapsible',
  {
    shadow: false,
    props: {
      open: prop(Boolean, { reflect: true }),
      defaultOpen: prop(Boolean, { attr: 'default-open' }),
      disabled: prop(Boolean),
    },
    emits: { openChange: event<{ open: boolean; nativeEvent?: Event }>() },
    meta: { description: 'Headless collapsible root primitive.' },
  },
  setupCollapsible,
)

export interface CollapsibleTriggerProps {
  disabled?: boolean
}
export interface CollapsibleTriggerElement extends HTMLElement {
  focus: () => void
}

function setupCollapsibleTrigger(
  props: CollapsibleTriggerProps,
  ctx: DefineElementContext<CollapsibleTriggerElement>,
) {
  const collapsible = inject(CollapsibleContext)
  let control!: HTMLButtonElement
  const isDisabled = () => Boolean(props.disabled || collapsible?.isDisabled())
  ctx.expose({
    focus() {
      control.focus()
    },
  })
  return (
    <Host
      data-slot="collapsible-trigger"
      data-state={() => (collapsible?.getOpen() ? 'open' : 'closed')}
      data-disabled={() => (isDisabled() ? '' : undefined)}
    >
      <button
        ref={(e: HTMLButtonElement | null) => {
          if (e) control = e
        }}
        part="trigger"
        data-slot="collapsible-trigger-button"
        prop:type={() => 'button'}
        disabled={() => isDisabled()}
        aria-expanded={() => String(Boolean(collapsible?.getOpen()))}
        aria-controls={() => collapsible?.getContentId()}
        onClick={nativeEvent => {
          if (!isDisabled())
            collapsible?.setOpen(!collapsible.getOpen(), nativeEvent)
        }}
      >
        <Slot />
      </button>
    </Host>
  )
}

export const CollapsibleTrigger = defineElement<
  CollapsibleTriggerProps,
  CollapsibleTriggerElement
>(
  'zw-collapsible-trigger',
  {
    shadow: false,
    props: { disabled: prop(Boolean) },
    meta: { description: 'Headless collapsible trigger primitive.' },
  },
  setupCollapsibleTrigger,
)

export interface CollapsibleContentProps {
  forceMount?: boolean
}
export interface CollapsibleContentElement extends HTMLElement {}

function setupCollapsibleContent(props: CollapsibleContentProps) {
  const collapsible = inject(CollapsibleContext)
  const isOpen = () => Boolean(collapsible?.getOpen())
  return (
    <Host
      id={() => collapsible?.getContentId()}
      part="content"
      data-slot="collapsible-content"
      data-state={() => (isOpen() ? 'open' : 'closed')}
      hidden={() => (props.forceMount ? false : !isOpen())}
    >
      <Slot />
    </Host>
  )
}

export const CollapsibleContent = defineElement<
  CollapsibleContentProps,
  CollapsibleContentElement
>(
  'zw-collapsible-content',
  {
    shadow: false,
    props: { forceMount: prop(Boolean, { attr: 'force-mount' }) },
    meta: { description: 'Headless collapsible content primitive.' },
  },
  setupCollapsibleContent,
)
