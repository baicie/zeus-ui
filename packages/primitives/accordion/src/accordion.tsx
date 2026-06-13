import type { Context } from '@zeus-js/runtime-dom'
import type { DefineElementContext, EventDefinition } from '@zeus-js/zeus'
import { provideDOMContext, resolveDOMContext } from '@zeus-js/runtime-dom'
import {
  createContext,
  defineElement,
  event,
  Host,
  prop,
  Slot,
} from '@zeus-js/zeus'

export type AccordionType = 'single' | 'multiple'
export type AccordionOrientation = 'vertical' | 'horizontal'

export interface AccordionProps {
  type?: AccordionType
  value?: string
  defaultValue?: string
  collapsible?: boolean
  disabled?: boolean
  orientation?: AccordionOrientation
}

export interface AccordionValueChangeDetail {
  value: string
  values: string[]
  nativeEvent?: Event
}

export interface AccordionElement extends HTMLElement {
  value?: string
}

interface AccordionEmits extends Record<string, EventDefinition<unknown>> {
  valueChange: EventDefinition<AccordionValueChangeDetail>
}

interface AccordionItemContextValue {
  getValue: () => string | undefined
  isDisabled: () => boolean
}

interface AccordionContextValue {
  getType: () => AccordionType
  getValues: () => string[]
  setItemOpen: (value: string, open: boolean, nativeEvent?: Event) => void
  isItemOpen: (value: string | undefined) => boolean
  isDisabled: () => boolean
  getOrientation: () => AccordionOrientation
  getTriggerId: (value: string) => string
  getContentId: (value: string) => string
}

const AccordionContext =
  createContext<AccordionContextValue>() as Context<AccordionContextValue>
const AccordionItemContext =
  createContext<AccordionItemContextValue>() as Context<AccordionItemContextValue>

let accordionId = 0

function createAccordionId(): string {
  accordionId += 1
  return `zw-accordion-${accordionId}`
}

function parseValues(value?: string): string[] {
  if (!value) return []
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

function serializeValues(values: string[]): string {
  return values.join(',')
}

function resolveValue(props: AccordionProps): string {
  if (props.value !== undefined) return props.value
  if (props.defaultValue !== undefined) return props.defaultValue
  return ''
}

function setupAccordion(
  props: AccordionProps,
  ctx: DefineElementContext<AccordionElement, AccordionEmits>,
) {
  const baseId = createAccordionId()
  const context: AccordionContextValue = {
    getType: () => props.type || 'single',
    getValues: () => parseValues(resolveValue(props)),
    setItemOpen: (itemValue, open, nativeEvent) => {
      if (props.disabled) return
      const type = context.getType()
      const currentValues = context.getValues()
      let nextValues: string[]
      if (type === 'single') {
        if (open) nextValues = [itemValue]
        else nextValues = props.collapsible ? [] : currentValues
      } else if (open) {
        nextValues = Array.from(new Set([...currentValues, itemValue]))
      } else {
        nextValues = currentValues.filter(v => v !== itemValue)
      }
      const value = serializeValues(nextValues)
      ctx.host.value = value
      ctx.emit.valueChange({ value, values: nextValues, nativeEvent })
    },
    isItemOpen: itemValue =>
      Boolean(itemValue && context.getValues().includes(itemValue)),
    isDisabled: () => Boolean(props.disabled),
    getOrientation: () => props.orientation || 'vertical',
    getTriggerId: value => `${baseId}-trigger-${value}`,
    getContentId: value => `${baseId}-content-${value}`,
  }
  /**
   * Web Component children are independent custom elements.
   *
   * Owner-tree provide/inject does not cross from <zw-accordion> into
   * <zw-accordion-item>. Use the DOM bridge instead.
   */
  provideDOMContext(ctx.host, AccordionContext, context)

  return (
    <Host
      data-slot="accordion-root"
      data-type={() => context.getType()}
      data-orientation={() => context.getOrientation()}
      data-disabled={() => (props.disabled ? '' : undefined)}
    >
      <Slot />
    </Host>
  )
}

export const Accordion = defineElement<
  AccordionProps,
  AccordionElement,
  AccordionEmits
>(
  'zw-accordion',
  {
    shadow: false,
    props: {
      type: prop(['single', 'multiple'], { default: 'single', reflect: true }),
      value: { type: String, reflect: true },
      defaultValue: { type: String, attr: 'default-value' },
      collapsible: prop(Boolean),
      disabled: prop(Boolean),
      orientation: prop(['vertical', 'horizontal'], {
        default: 'vertical',
        reflect: true,
      }),
    },
    emits: {
      valueChange: event<{
        value: string
        values: string[]
        nativeEvent?: Event
      }>(),
    },
    meta: { description: 'Headless accordion root primitive.' },
  },
  setupAccordion,
)

export interface AccordionItemProps {
  value?: string
  disabled?: boolean
}
export interface AccordionItemElement extends HTMLElement {}

function setupAccordionItem(
  props: AccordionItemProps,
  ctx: DefineElementContext<AccordionItemElement>,
) {
  const accordionResult = resolveDOMContext(ctx.host, AccordionContext)
  const accordion = accordionResult.found ? accordionResult.value! : undefined
  const item: AccordionItemContextValue = {
    getValue: () => props.value,
    isDisabled: () => Boolean(props.disabled || accordion?.isDisabled()),
  }
  provideDOMContext(ctx.host, AccordionItemContext, item)
  return (
    <Host
      part="item"
      data-slot="accordion-item"
      data-value={() => props.value}
      data-state={() =>
        accordion?.isItemOpen(props.value) ? 'open' : 'closed'
      }
      data-disabled={() => (item.isDisabled() ? '' : undefined)}
    >
      <Slot />
    </Host>
  )
}

export const AccordionItem = defineElement<
  AccordionItemProps,
  AccordionItemElement
>(
  'zw-accordion-item',
  {
    shadow: false,
    props: { value: String, disabled: prop(Boolean) },
    meta: { description: 'Headless accordion item primitive.' },
  },
  setupAccordionItem,
)

export interface AccordionTriggerElement extends HTMLElement {
  focus: () => void
}

function setupAccordionTrigger(
  _props: object,
  ctx: DefineElementContext<AccordionTriggerElement>,
) {
  const accordionResult = resolveDOMContext(ctx.host, AccordionContext)
  const accordion = accordionResult.found ? accordionResult.value! : undefined
  const itemResult = resolveDOMContext(ctx.host, AccordionItemContext)
  const item = itemResult.found ? itemResult.value! : undefined
  let control!: HTMLButtonElement
  const value = () => item?.getValue()
  const isOpen = () => accordion?.isItemOpen(value())
  const isDisabled = () => Boolean(item?.isDisabled())
  ctx.expose({
    focus() {
      control.focus()
    },
  })
  return (
    <Host
      part="trigger"
      data-slot="accordion-trigger"
      data-state={() => (isOpen() ? 'open' : 'closed')}
      data-disabled={() => (isDisabled() ? '' : undefined)}
    >
      <button
        ref={(e: HTMLButtonElement | null) => {
          if (e) control = e
        }}
        data-slot="accordion-trigger-button"
        prop:type={() => 'button'}
        disabled={() => isDisabled()}
        id={() => (value() ? accordion?.getTriggerId(value()!) : undefined)}
        aria-expanded={() => String(Boolean(isOpen()))}
        aria-controls={() =>
          value() ? accordion?.getContentId(value()!) : undefined
        }
        onClick={nativeEvent => {
          const v = value()
          if (v && !isDisabled())
            accordion?.setItemOpen(v, !isOpen(), nativeEvent)
        }}
      >
        <Slot />
      </button>
    </Host>
  )
}

export const AccordionTrigger = defineElement<object, AccordionTriggerElement>(
  'zw-accordion-trigger',
  {
    shadow: false,
    meta: { description: 'Headless accordion trigger primitive.' },
  },
  setupAccordionTrigger,
)

export interface AccordionContentProps {
  forceMount?: boolean
}
export interface AccordionContentElement extends HTMLElement {}

function setupAccordionContent(
  props: AccordionContentProps,
  ctx: DefineElementContext<AccordionContentElement>,
) {
  const accordionResult = resolveDOMContext(ctx.host, AccordionContext)
  const accordion = accordionResult.found ? accordionResult.value! : undefined
  const itemResult = resolveDOMContext(ctx.host, AccordionItemContext)
  const item = itemResult.found ? itemResult.value! : undefined
  const value = () => item?.getValue()
  const isOpen = () => accordion?.isItemOpen(value())
  return (
    <Host
      part="content"
      data-slot="accordion-content"
      data-state={() => (isOpen() ? 'open' : 'closed')}
      id={() => (value() ? accordion?.getContentId(value()!) : undefined)}
      role="region"
      aria-labelledby={() =>
        value() ? accordion?.getTriggerId(value()!) : undefined
      }
      hidden={() => (props.forceMount ? false : !isOpen())}
    >
      <Slot />
    </Host>
  )
}

export const AccordionContent = defineElement<
  AccordionContentProps,
  AccordionContentElement
>(
  'zw-accordion-content',
  {
    shadow: false,
    props: { forceMount: prop(Boolean, { attr: 'force-mount' }) },
    meta: { description: 'Headless accordion content primitive.' },
  },
  setupAccordionContent,
)
