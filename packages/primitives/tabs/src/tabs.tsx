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

interface TabsTriggerRecord {
  value: string
  control: HTMLButtonElement
  isDisabled: () => boolean
}

interface TabsContextValue {
  getValue: () => string | undefined
  setValue: (value: string, nativeEvent?: Event) => void
  getOrientation: () => TabsOrientation
  isDisabled: () => boolean
  getTriggerId: (value: string) => string
  getContentId: (value: string) => string
  registerTrigger: (record: TabsTriggerRecord) => void
  moveFocus: (
    currentValue: string | undefined,
    control: HTMLButtonElement,
    key: string,
    nativeEvent: KeyboardEvent,
  ) => void
}

const TabsContext =
  createContext<TabsContextValue>() as DOMContext<TabsContextValue>

let tabsId = 0

function createTabsId(): string {
  tabsId += 1
  return `zw-tabs-${tabsId}`
}

function resolveValue(props: TabsProps): string | undefined {
  if (props.value !== undefined) return props.value
  if (props.defaultValue !== undefined) return props.defaultValue
  return undefined
}

function sortByDomOrder(records: TabsTriggerRecord[]): TabsTriggerRecord[] {
  return [...records].sort((a, b) => {
    if (a.control === b.control) return 0

    const position = a.control.compareDocumentPosition(b.control)

    return position & Node.DOCUMENT_POSITION_PRECEDING ? 1 : -1
  })
}

function setupTabs(
  props: TabsProps,
  ctx: DefineElementContext<TabsElement, TabsEmits>,
) {
  const baseId = createTabsId()
  const triggers: TabsTriggerRecord[] = []

  const context: TabsContextValue = {
    getValue: () => resolveValue(props),
    setValue: (value: string, nativeEvent?: Event) => {
      ctx.host.value = value
      ctx.emit.valueChange({ value, nativeEvent })
    },
    getOrientation: () => props.orientation || 'horizontal',
    isDisabled: () => Boolean(props.disabled),
    getTriggerId: value => `${baseId}-trigger-${value}`,
    getContentId: value => `${baseId}-content-${value}`,
    registerTrigger: record => {
      const index = triggers.findIndex(item => item.control === record.control)

      if (index >= 0) {
        triggers[index] = record
        return
      }

      triggers.push(record)
    },
    moveFocus: (currentValue, control, key, nativeEvent) => {
      const orientation = context.getOrientation()
      const enabledTriggers = sortByDomOrder(
        triggers.filter(item => !item.isDisabled()),
      )

      if (enabledTriggers.length === 0) return

      const currentIndex = Math.max(
        0,
        enabledTriggers.findIndex(item => {
          if (currentValue !== undefined) return item.value === currentValue
          return item.control === control
        }),
      )

      let nextIndex = currentIndex

      if (key === 'Home') {
        nextIndex = 0
      } else if (key === 'End') {
        nextIndex = enabledTriggers.length - 1
      } else if (
        orientation === 'horizontal' &&
        (key === 'ArrowRight' || key === 'ArrowLeft')
      ) {
        nextIndex =
          key === 'ArrowRight'
            ? (currentIndex + 1) % enabledTriggers.length
            : (currentIndex - 1 + enabledTriggers.length) %
              enabledTriggers.length
      } else if (
        orientation === 'vertical' &&
        (key === 'ArrowDown' || key === 'ArrowUp')
      ) {
        nextIndex =
          key === 'ArrowDown'
            ? (currentIndex + 1) % enabledTriggers.length
            : (currentIndex - 1 + enabledTriggers.length) %
              enabledTriggers.length
      } else {
        return
      }

      nativeEvent.preventDefault()

      const next = enabledTriggers[nextIndex]
      next.control.focus()
      context.setValue(next.value, nativeEvent)
    },
  }

  provideDOMContext(ctx.host, TabsContext, context)

  return (
    <Host
      data-slot="tabs-root"
      data-orientation={() => context.getOrientation()}
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

function setupTabsList(
  _props: object,
  ctx: DefineElementContext<TabsListElement>,
) {
  const result = resolveDOMContext(ctx.host, TabsContext)
  const tabs = result.found ? result.value : undefined

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
  const result = resolveDOMContext(ctx.host, TabsContext)
  const tabs = result.found ? result.value : undefined

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
          if (element) {
            control = element

            if (props.value) {
              tabs?.registerTrigger({
                value: props.value,
                control: element,
                isDisabled,
              })
            }
          }
        }}
        id={() => (props.value ? tabs?.getTriggerId(props.value) : undefined)}
        part="trigger"
        role="tab"
        prop:type={() => 'button'}
        aria-selected={() => String(isSelected())}
        aria-controls={() =>
          props.value ? tabs?.getContentId(props.value) : undefined
        }
        tabIndex={() => (isSelected() ? 0 : -1)}
        disabled={() => isDisabled()}
        onClick={event => {
          activate(event)
        }}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            activate(event)
            return
          }

          tabs?.moveFocus(props.value, control, event.key, event)
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

function setupTabsContent(
  props: TabsContentProps,
  ctx: DefineElementContext<TabsContentElement>,
) {
  const result = resolveDOMContext(ctx.host, TabsContext)
  const tabs = result.found ? result.value : undefined

  const isActive = () =>
    Boolean(props.value && tabs?.getValue() === props.value)

  return (
    <Host
      id={() => (props.value ? tabs?.getContentId(props.value) : undefined)}
      part="content"
      role="tabpanel"
      data-slot="tabs-content"
      data-state={() => (isActive() ? 'active' : 'inactive')}
      data-value={() => props.value}
      aria-labelledby={() =>
        props.value ? tabs?.getTriggerId(props.value) : undefined
      }
      tabIndex={() => 0}
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
