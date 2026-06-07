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

export type TabsOrientation = 'horizontal' | 'vertical'

export interface TabsProps {
  value?: string
  defaultValue?: string
  orientation?: TabsOrientation
  disabled?: boolean
}

export interface TabsValueChangeDetail {
  value: string
  nativeEvent?: Event
}

export interface TabsElement extends HTMLElement {
  value?: string
}

interface TabsEmits extends Record<string, EventDefinition<unknown>> {
  valueChange: EventDefinition<TabsValueChangeDetail>
}

interface TabsContextValue {
  getValue: () => string | undefined
  setValue: (value: string, nativeEvent?: Event) => void
  getOrientation: () => TabsOrientation | undefined
  isDisabled: () => boolean
}

const TabsContext = createContext<TabsContextValue>()

function resolveValue(props: TabsProps): string | undefined {
  if (props.value !== undefined) return props.value
  if (props.defaultValue !== undefined) return props.defaultValue
  return undefined
}

function setupTabs(
  props: TabsProps,
  ctx: DefineElementContext<TabsElement, TabsEmits>,
) {
  const context: TabsContextValue = {
    getValue: () => resolveValue(props),
    setValue: (value: string, nativeEvent?: Event) => {
      ctx.host.value = value
      ctx.emit.valueChange({ value, nativeEvent })
    },
    getOrientation: () => props.orientation || 'horizontal',
    isDisabled: () => Boolean(props.disabled),
  }

  provide(TabsContext, context)

  return (
    <Host
      data-slot="tabs-root"
      data-orientation={() => props.orientation || 'horizontal'}
      data-disabled={() => (props.disabled ? '' : undefined)}
    >
      <Slot />
    </Host>
  )
}

export const Tabs = defineElement<TabsProps, TabsElement, TabsEmits>(
  'zw-tabs',
  {
    shadow: false,
    props: {
      value: {
        type: String,
        reflect: true,
      },
      defaultValue: {
        type: String,
        attr: 'default-value',
      },
      orientation: prop(['horizontal', 'vertical'], {
        default: 'horizontal',
        reflect: true,
      }),
      disabled: prop(Boolean),
    },
    emits: {
      valueChange: event<{
        value: string
        nativeEvent?: Event
      }>(),
    },
    meta: {
      description: 'Headless tabs root primitive.',
    },
  },
  setupTabs,
)

export interface TabsListElement extends HTMLElement {}

function setupTabsList() {
  const tabs = inject(TabsContext)

  return (
    <Host
      part="list"
      role="tablist"
      data-slot="tabs-list"
      data-orientation={() => tabs?.getOrientation()}
      aria-orientation={() => tabs?.getOrientation()}
    >
      <Slot />
    </Host>
  )
}

export const TabsList = defineElement<object, TabsListElement>(
  'zw-tabs-list',
  {
    shadow: false,
    meta: {
      description: 'Headless tabs list primitive.',
    },
  },
  setupTabsList,
)

export interface TabsTriggerProps {
  value?: string
  disabled?: boolean
}

export interface TabsTriggerElement extends HTMLElement {
  focus: () => void
}

function setupTabsTrigger(
  props: TabsTriggerProps,
  ctx: DefineElementContext<TabsTriggerElement>,
) {
  const tabs = inject(TabsContext)
  let control!: HTMLButtonElement

  const isSelected = () =>
    Boolean(props.value && tabs?.getValue() === props.value)

  const isDisabled = () => Boolean(props.disabled || tabs?.isDisabled())

  const activate = (nativeEvent?: Event) => {
    if (isDisabled() || !props.value) return
    tabs?.setValue(props.value, nativeEvent)
  }

  ctx.expose({
    focus(): void {
      control.focus()
    },
  })

  return (
    <Host
      part="trigger"
      data-slot="tabs-trigger"
      data-value={() => props.value}
      data-state={() => (isSelected() ? 'active' : 'inactive')}
      data-disabled={() => (isDisabled() ? '' : undefined)}
    >
      <button
        ref={(element: HTMLButtonElement | null) => {
          if (element) control = element
        }}
        part="trigger"
        role="tab"
        prop:type={() => 'button'}
        aria-selected={() => String(isSelected())}
        tabIndex={() => (isSelected() ? 0 : -1)}
        disabled={() => isDisabled()}
        onClick={event => {
          activate(event)
        }}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            activate(event)
          }
        }}
      >
        <Slot />
      </button>
    </Host>
  )
}

export const TabsTrigger = defineElement<TabsTriggerProps, TabsTriggerElement>(
  'zw-tabs-trigger',
  {
    shadow: false,
    props: {
      value: String,
      disabled: prop(Boolean),
    },
    meta: {
      description: 'Headless tabs trigger primitive.',
    },
  },
  setupTabsTrigger,
)

export interface TabsContentProps {
  value?: string
}

export interface TabsContentElement extends HTMLElement {}

function setupTabsContent(props: TabsContentProps) {
  const tabs = inject(TabsContext)
  const isActive = () =>
    Boolean(props.value && tabs?.getValue() === props.value)

  return (
    <Host
      part="content"
      role="tabpanel"
      data-slot="tabs-content"
      data-state={() => (isActive() ? 'active' : 'inactive')}
      data-value={() => props.value}
      hidden={() => !isActive()}
    >
      <Slot />
    </Host>
  )
}

export const TabsContent = defineElement<TabsContentProps, TabsContentElement>(
  'zw-tabs-content',
  {
    shadow: false,
    props: {
      value: String,
    },
    meta: {
      description: 'Headless tabs content primitive.',
    },
  },
  setupTabsContent,
)
