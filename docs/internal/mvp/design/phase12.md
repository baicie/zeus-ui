下面给 **Phase 12：Disclosure / Feedback 组件第一批** 的详细设计与完整代码草案。

当前仓库结构已经适合继续扩组件：primitive 包统一导出 `./wc / ./react / ./vue / custom-elements.json / zeus.components.json`，并通过根 `rolldown.config.ts` 构建。
registry 已经按 `default/<name>.tsx -> components/ui/<name>.tsx` 组织，Phase 11 也是这么加的。
docs 现在由 `aiMetadata + registry.json` 自动生成，所以 Phase 12 只要补 metadata 和 registry，再跑 `pnpm docs:generate` 即可生成组件页。

---

# Phase 12 范围

```txt
新增组件：
  collapsible
  accordion
  tooltip
  progress
  avatar

暂不做：
  popover
  dropdown-menu
  toast
  command
  combobox
```

原因：`popover/dropdown/toast` 需要 portal、focus scope、floating positioning、stack manager，建议等 `tooltip` 的轻量定位能力验证后再做。

---

# 1. 新增 primitive 包

新增目录：

```txt
packages/primitives/collapsible
packages/primitives/accordion
packages/primitives/tooltip
packages/primitives/progress
packages/primitives/avatar
```

每个包都复制 Phase 11 primitive 的 `package.json / tsconfig.json` 模板，把 `<name>` 替换为组件名即可。

---

## `packages/primitives/collapsible/src/index.ts`

```ts
export * from './collapsible'
```

## `packages/primitives/collapsible/src/collapsible.tsx`

```tsx
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
      open: prop(Boolean, {
        reflect: true,
      }),
      defaultOpen: prop(Boolean, {
        attr: 'default-open',
      }),
      disabled: prop(Boolean),
    },
    emits: {
      openChange: event<{
        open: boolean
        nativeEvent?: Event
      }>(),
    },
    meta: {
      description: 'Headless collapsible root primitive.',
    },
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
    focus(): void {
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
        ref={(element: HTMLButtonElement | null) => {
          if (element) control = element
        }}
        part="trigger"
        data-slot="collapsible-trigger-button"
        prop:type={() => 'button'}
        disabled={() => isDisabled()}
        aria-expanded={() => String(Boolean(collapsible?.getOpen()))}
        aria-controls={() => collapsible?.getContentId()}
        onClick={nativeEvent => {
          if (!isDisabled()) {
            collapsible?.setOpen(!collapsible.getOpen(), nativeEvent)
          }
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
    props: {
      disabled: prop(Boolean),
    },
    meta: {
      description: 'Headless collapsible trigger primitive.',
    },
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
    props: {
      forceMount: prop(Boolean, {
        attr: 'force-mount',
      }),
    },
    meta: {
      description: 'Headless collapsible content primitive.',
    },
  },
  setupCollapsibleContent,
)
```

---

## `packages/primitives/accordion/src/index.ts`

```ts
export * from './accordion'
```

## `packages/primitives/accordion/src/accordion.tsx`

```tsx
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

const AccordionContext = createContext<AccordionContextValue>()

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
        if (open) {
          nextValues = [itemValue]
        } else {
          nextValues = props.collapsible ? [] : currentValues
        }
      } else if (open) {
        nextValues = Array.from(new Set([...currentValues, itemValue]))
      } else {
        nextValues = currentValues.filter(value => value !== itemValue)
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

  provide(AccordionContext, context)

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
      type: prop(['single', 'multiple'], {
        default: 'single',
        reflect: true,
      }),
      value: {
        type: String,
        reflect: true,
      },
      defaultValue: {
        type: String,
        attr: 'default-value',
      },
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
    meta: {
      description: 'Headless accordion root primitive.',
    },
  },
  setupAccordion,
)

interface AccordionItemContextValue {
  getValue: () => string | undefined
  isDisabled: () => boolean
}

const AccordionItemContext = createContext<AccordionItemContextValue>()

export interface AccordionItemProps {
  value?: string
  disabled?: boolean
}

export interface AccordionItemElement extends HTMLElement {}

function setupAccordionItem(props: AccordionItemProps) {
  const accordion = inject(AccordionContext)

  const item: AccordionItemContextValue = {
    getValue: () => props.value,
    isDisabled: () => Boolean(props.disabled || accordion?.isDisabled()),
  }

  provide(AccordionItemContext, item)

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
    props: {
      value: String,
      disabled: prop(Boolean),
    },
    meta: {
      description: 'Headless accordion item primitive.',
    },
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
  const accordion = inject(AccordionContext)
  const item = inject(AccordionItemContext)
  let control!: HTMLButtonElement

  const value = () => item?.getValue()
  const isOpen = () => accordion?.isItemOpen(value())
  const isDisabled = () => Boolean(item?.isDisabled())

  ctx.expose({
    focus(): void {
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
        ref={(element: HTMLButtonElement | null) => {
          if (element) control = element
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
          const itemValue = value()

          if (!itemValue || isDisabled()) return

          accordion?.setItemOpen(itemValue, !isOpen(), nativeEvent)
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
    meta: {
      description: 'Headless accordion trigger primitive.',
    },
  },
  setupAccordionTrigger,
)

export interface AccordionContentProps {
  forceMount?: boolean
}

export interface AccordionContentElement extends HTMLElement {}

function setupAccordionContent(props: AccordionContentProps) {
  const accordion = inject(AccordionContext)
  const item = inject(AccordionItemContext)

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
    props: {
      forceMount: prop(Boolean, {
        attr: 'force-mount',
      }),
    },
    meta: {
      description: 'Headless accordion content primitive.',
    },
  },
  setupAccordionContent,
)
```

---

## `packages/primitives/tooltip/src/index.ts`

```ts
export * from './tooltip'
```

## `packages/primitives/tooltip/src/tooltip.tsx`

```tsx
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
    show(): void {
      context.setOpen(true)
    },
    hide(): void {
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
      open: prop(Boolean, {
        reflect: true,
      }),
      defaultOpen: prop(Boolean, {
        attr: 'default-open',
      }),
      disabled: prop(Boolean),
      delayDuration: prop(Number, {
        attr: 'delay-duration',
        default: 300,
      }),
    },
    emits: {
      openChange: event<{
        open: boolean
        nativeEvent?: Event
      }>(),
    },
    meta: {
      description: 'Headless tooltip root primitive.',
    },
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

    openTimer = setTimeout(() => {
      tooltip?.setOpen(true, nativeEvent)
    }, tooltip?.getDelayDuration() ?? 300)
  }

  const close = (nativeEvent: Event) => {
    clearOpenTimer()
    tooltip?.setOpen(false, nativeEvent)
  }

  ctx.expose({
    focus(): void {
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
        ref={(element: HTMLSpanElement | null) => {
          if (element) control = element
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
    meta: {
      description: 'Headless tooltip trigger primitive.',
    },
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
      forceMount: prop(Boolean, {
        attr: 'force-mount',
      }),
    },
    meta: {
      description: 'Headless tooltip content primitive.',
    },
  },
  setupTooltipContent,
)
```

---

## `packages/primitives/progress/src/index.ts`

```ts
export * from './progress'
```

## `packages/primitives/progress/src/progress.tsx`

```tsx
import { defineElement, Host, prop, Slot } from '@zeus-js/zeus'

export interface ProgressProps {
  value?: number
  max?: number
  indeterminate?: boolean
  label?: string
}

export interface ProgressElement extends HTMLElement {
  value?: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function getMax(props: ProgressProps): number {
  return Math.max(1, props.max ?? 100)
}

function getValue(props: ProgressProps): number {
  return clamp(props.value ?? 0, 0, getMax(props))
}

function getPercent(props: ProgressProps): number {
  return Math.round((getValue(props) / getMax(props)) * 100)
}

export const Progress = defineElement<ProgressProps, ProgressElement>(
  'zw-progress',
  {
    shadow: false,
    props: {
      value: {
        type: Number,
        reflect: true,
      },
      max: prop(Number, {
        default: 100,
        reflect: true,
      }),
      indeterminate: prop(Boolean, {
        reflect: true,
      }),
      label: String,
    },
    meta: {
      description: 'Headless progress primitive.',
    },
  },
  props => (
    <Host
      part="root"
      data-slot="progress-root"
      data-state={() => (props.indeterminate ? 'indeterminate' : 'determinate')}
      data-value={() => String(getValue(props))}
      data-max={() => String(getMax(props))}
      data-percent={() => String(getPercent(props))}
      role="progressbar"
      aria-label={() => props.label}
      aria-valuemin={() => (props.indeterminate ? undefined : '0')}
      aria-valuemax={() =>
        props.indeterminate ? undefined : String(getMax(props))
      }
      aria-valuenow={() =>
        props.indeterminate ? undefined : String(getValue(props))
      }
      aria-valuetext={() =>
        props.indeterminate ? 'Loading' : `${getPercent(props)}%`
      }
    >
      <span
        part="indicator"
        data-slot="progress-indicator"
        data-value={() => String(getValue(props))}
        data-max={() => String(getMax(props))}
        data-percent={() => String(getPercent(props))}
      />
      <Slot />
    </Host>
  ),
)
```

---

## `packages/primitives/avatar/src/index.ts`

```ts
export * from './avatar'
```

## `packages/primitives/avatar/src/avatar.tsx`

```tsx
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

export type AvatarSize = 'sm' | 'md' | 'lg'
export type AvatarShape = 'circle' | 'square'

export interface AvatarProps {
  size?: AvatarSize
  shape?: AvatarShape
}

export interface AvatarElement extends HTMLElement {}

interface AvatarContextValue {
  getImageStatus: () => AvatarImageStatus
  setImageStatus: (status: AvatarImageStatus) => void
}

type AvatarImageStatus = 'idle' | 'loading' | 'loaded' | 'error'

const AvatarContext = createContext<AvatarContextValue>()

function setupAvatar(props: AvatarProps) {
  let imageStatus: AvatarImageStatus = 'idle'

  const context: AvatarContextValue = {
    getImageStatus: () => imageStatus,
    setImageStatus: status => {
      imageStatus = status
    },
  }

  provide(AvatarContext, context)

  return (
    <Host
      part="root"
      data-slot="avatar-root"
      data-size={() => props.size}
      data-shape={() => props.shape}
      data-image-status={() => imageStatus}
    >
      <Slot />
    </Host>
  )
}

export const Avatar = defineElement<AvatarProps, AvatarElement>(
  'zw-avatar',
  {
    shadow: false,
    props: {
      size: prop(['sm', 'md', 'lg'], {
        default: 'md',
        reflect: true,
      }),
      shape: prop(['circle', 'square'], {
        default: 'circle',
        reflect: true,
      }),
    },
    meta: {
      description: 'Headless avatar root primitive.',
    },
  },
  setupAvatar,
)

export interface AvatarImageProps {
  src?: string
  alt?: string
  loading?: 'eager' | 'lazy'
  referrerPolicy?: string
}

export interface AvatarImageLoadDetail {
  nativeEvent: Event
}

export interface AvatarImageErrorDetail {
  nativeEvent: Event
}

export interface AvatarImageElement extends HTMLElement {}

interface AvatarImageEmits extends Record<string, EventDefinition<unknown>> {
  imageLoad: EventDefinition<AvatarImageLoadDetail>
  imageError: EventDefinition<AvatarImageErrorDetail>
}

function setupAvatarImage(
  props: AvatarImageProps,
  ctx: DefineElementContext<AvatarImageElement, AvatarImageEmits>,
) {
  const avatar = inject(AvatarContext)

  return (
    <Host part="image" data-slot="avatar-image-root">
      <img
        part="image"
        data-slot="avatar-image"
        src={() => props.src}
        alt={() => props.alt || ''}
        loading={() => props.loading}
        referrerPolicy={() => props.referrerPolicy}
        onLoad={nativeEvent => {
          avatar?.setImageStatus('loaded')
          ctx.emit.imageLoad({ nativeEvent })
        }}
        onError={nativeEvent => {
          avatar?.setImageStatus('error')
          ctx.emit.imageError({ nativeEvent })
        }}
      />
    </Host>
  )
}

export const AvatarImage = defineElement<
  AvatarImageProps,
  AvatarImageElement,
  AvatarImageEmits
>(
  'zw-avatar-image',
  {
    shadow: false,
    props: {
      src: String,
      alt: String,
      loading: prop(['eager', 'lazy'], {
        default: 'lazy',
      }),
      referrerPolicy: prop(String, {
        attr: 'referrerpolicy',
      }),
    },
    emits: {
      imageLoad: event<{ nativeEvent: Event }>(),
      imageError: event<{ nativeEvent: Event }>(),
    },
    meta: {
      description: 'Headless avatar image primitive.',
    },
  },
  setupAvatarImage,
)

export interface AvatarFallbackProps {
  delayMs?: number
}

export interface AvatarFallbackElement extends HTMLElement {}

function setupAvatarFallback(props: AvatarFallbackProps) {
  const avatar = inject(AvatarContext)
  const shouldShow = () => avatar?.getImageStatus() !== 'loaded'

  return (
    <Host
      part="fallback"
      data-slot="avatar-fallback"
      data-delay-ms={() => String(props.delayMs ?? 0)}
      hidden={() => !shouldShow()}
    >
      <Slot />
    </Host>
  )
}

export const AvatarFallback = defineElement<
  AvatarFallbackProps,
  AvatarFallbackElement
>(
  'zw-avatar-fallback',
  {
    shadow: false,
    props: {
      delayMs: prop(Number, {
        attr: 'delay-ms',
        default: 0,
      }),
    },
    meta: {
      description: 'Headless avatar fallback primitive.',
    },
  },
  setupAvatarFallback,
)
```

---

# 2. Registry source

新增：

```txt
packages/registry/default/collapsible.tsx
packages/registry/default/accordion.tsx
packages/registry/default/tooltip.tsx
packages/registry/default/progress.tsx
packages/registry/default/avatar.tsx
```

---

## `packages/registry/default/collapsible.tsx`

```tsx
import {
  Collapsible as CollapsiblePrimitive,
  CollapsibleContent as CollapsibleContentPrimitive,
  CollapsibleTrigger as CollapsibleTriggerPrimitive,
} from '@zeus-web/collapsible/react'
import * as React from 'react'

import { cn } from '@/lib/utils'

export const Collapsible = CollapsiblePrimitive

export const CollapsibleTrigger = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<typeof CollapsibleTriggerPrimitive>
>(({ className, ...props }, ref) => (
  <CollapsibleTriggerPrimitive
    ref={ref}
    className={cn(
      '[&_[data-slot=collapsible-trigger-button]]:inline-flex [&_[data-slot=collapsible-trigger-button]]:items-center',
      '[&_[data-slot=collapsible-trigger-button]]:rounded-md [&_[data-slot=collapsible-trigger-button]]:text-sm',
      '[&_[data-slot=collapsible-trigger-button]]:font-medium [&_[data-slot=collapsible-trigger-button]]:transition-colors',
      '[&_[data-slot=collapsible-trigger-button]]:focus-visible:outline-none [&_[data-slot=collapsible-trigger-button]]:focus-visible:ring-1 [&_[data-slot=collapsible-trigger-button]]:focus-visible:ring-ring',
      className,
    )}
    {...props}
  />
))

CollapsibleTrigger.displayName = 'CollapsibleTrigger'

export const CollapsibleContent = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<typeof CollapsibleContentPrimitive>
>(({ className, ...props }, ref) => (
  <CollapsibleContentPrimitive
    ref={ref}
    className={cn(
      'data-[state=closed]:hidden data-[state=open]:block',
      className,
    )}
    {...props}
  />
))

CollapsibleContent.displayName = 'CollapsibleContent'
```

---

## `packages/registry/default/accordion.tsx`

```tsx
import {
  Accordion as AccordionPrimitive,
  AccordionContent as AccordionContentPrimitive,
  AccordionItem as AccordionItemPrimitive,
  AccordionTrigger as AccordionTriggerPrimitive,
} from '@zeus-web/accordion/react'
import * as React from 'react'

import { cn } from '@/lib/utils'

export const Accordion = AccordionPrimitive

export const AccordionItem = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<typeof AccordionItemPrimitive>
>(({ className, ...props }, ref) => (
  <AccordionItemPrimitive
    ref={ref}
    className={cn('border-b', className)}
    {...props}
  />
))

AccordionItem.displayName = 'AccordionItem'

export const AccordionTrigger = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<typeof AccordionTriggerPrimitive>
>(({ className, ...props }, ref) => (
  <AccordionTriggerPrimitive
    ref={ref}
    className={cn(
      '[&_[data-slot=accordion-trigger-button]]:flex [&_[data-slot=accordion-trigger-button]]:w-full',
      '[&_[data-slot=accordion-trigger-button]]:items-center [&_[data-slot=accordion-trigger-button]]:justify-between',
      '[&_[data-slot=accordion-trigger-button]]:py-4 [&_[data-slot=accordion-trigger-button]]:text-sm',
      '[&_[data-slot=accordion-trigger-button]]:font-medium [&_[data-slot=accordion-trigger-button]]:transition-all',
      '[&_[data-slot=accordion-trigger-button]]:hover:underline',
      className,
    )}
    {...props}
  />
))

AccordionTrigger.displayName = 'AccordionTrigger'

export const AccordionContent = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<typeof AccordionContentPrimitive>
>(({ className, ...props }, ref) => (
  <AccordionContentPrimitive
    ref={ref}
    className={cn(
      'overflow-hidden text-sm data-[state=closed]:hidden data-[state=open]:block',
      '[&>*]:pb-4',
      className,
    )}
    {...props}
  />
))

AccordionContent.displayName = 'AccordionContent'
```

---

## `packages/registry/default/tooltip.tsx`

```tsx
import {
  Tooltip as TooltipPrimitive,
  TooltipContent as TooltipContentPrimitive,
  TooltipTrigger as TooltipTriggerPrimitive,
} from '@zeus-web/tooltip/react'
import * as React from 'react'

import { cn } from '@/lib/utils'

export const Tooltip = TooltipPrimitive

export const TooltipTrigger = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<typeof TooltipTriggerPrimitive>
>(({ className, ...props }, ref) => (
  <TooltipTriggerPrimitive
    ref={ref}
    className={cn('inline-flex', className)}
    {...props}
  />
))

TooltipTrigger.displayName = 'TooltipTrigger'

export const TooltipContent = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<typeof TooltipContentPrimitive>
>(({ className, side = 'top', ...props }, ref) => (
  <TooltipContentPrimitive
    ref={ref}
    side={side}
    className={cn(
      'z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground shadow-md',
      'data-[state=closed]:hidden data-[state=open]:block',
      'data-[side=top]:mb-2 data-[side=bottom]:mt-2 data-[side=left]:mr-2 data-[side=right]:ml-2',
      className,
    )}
    {...props}
  />
))

TooltipContent.displayName = 'TooltipContent'
```

---

## `packages/registry/default/progress.tsx`

```tsx
import { Progress as ProgressPrimitive } from '@zeus-web/progress/react'
import * as React from 'react'

import { cn } from '@/lib/utils'

export interface ProgressProps extends React.ComponentPropsWithoutRef<
  typeof ProgressPrimitive
> {}

export const Progress = React.forwardRef<HTMLElement, ProgressProps>(
  ({ className, ...props }, ref) => (
    <ProgressPrimitive
      ref={ref}
      className={cn(
        'relative h-2 w-full overflow-hidden rounded-full bg-primary/20',
        '[&_[data-slot=progress-indicator]]:block [&_[data-slot=progress-indicator]]:h-full',
        '[&_[data-slot=progress-indicator]]:bg-primary [&_[data-slot=progress-indicator]]:transition-all',
        'data-[state=indeterminate]:[&_[data-slot=progress-indicator]]:w-1/3',
        className,
      )}
      {...props}
    />
  ),
)

Progress.displayName = 'Progress'
```

---

## `packages/registry/default/avatar.tsx`

```tsx
import {
  Avatar as AvatarPrimitive,
  AvatarFallback as AvatarFallbackPrimitive,
  AvatarImage as AvatarImagePrimitive,
} from '@zeus-web/avatar/react'
import * as React from 'react'

import { cn } from '@/lib/utils'

export const Avatar = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive
    ref={ref}
    className={cn(
      'relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full',
      'data-[shape=square]:rounded-md',
      'data-[size=sm]:h-8 data-[size=sm]:w-8',
      'data-[size=lg]:h-12 data-[size=lg]:w-12',
      className,
    )}
    {...props}
  />
))

Avatar.displayName = 'Avatar'

export const AvatarImage = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<typeof AvatarImagePrimitive>
>(({ className, ...props }, ref) => (
  <AvatarImagePrimitive
    ref={ref}
    className={cn(
      '[&_[data-slot=avatar-image]]:aspect-square [&_[data-slot=avatar-image]]:h-full',
      '[&_[data-slot=avatar-image]]:w-full [&_[data-slot=avatar-image]]:object-cover',
      className,
    )}
    {...props}
  />
))

AvatarImage.displayName = 'AvatarImage'

export const AvatarFallback = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<typeof AvatarFallbackPrimitive>
>(({ className, ...props }, ref) => (
  <AvatarFallbackPrimitive
    ref={ref}
    className={cn(
      'flex h-full w-full items-center justify-center rounded-full bg-muted text-sm font-medium',
      className,
    )}
    {...props}
  />
))

AvatarFallback.displayName = 'AvatarFallback'
```

---

# 3. Registry JSON 追加 items

在 `packages/registry/registry.json` 的 `items` 里追加：

```json
{
  "name": "collapsible",
  "type": "registry:ui",
  "description": "Collapsible styled component.",
  "dependencies": [
    "@zeus-web/collapsible",
    "class-variance-authority",
    "clsx",
    "tailwind-merge"
  ],
  "files": [
    {
      "path": "default/lib/utils.ts",
      "target": "lib/utils.ts",
      "type": "registry:lib"
    },
    {
      "path": "default/collapsible.tsx",
      "target": "components/ui/collapsible.tsx",
      "type": "registry:ui"
    }
  ]
},
{
  "name": "accordion",
  "type": "registry:ui",
  "description": "Accordion styled component.",
  "dependencies": [
    "@zeus-web/accordion",
    "class-variance-authority",
    "clsx",
    "tailwind-merge"
  ],
  "files": [
    {
      "path": "default/lib/utils.ts",
      "target": "lib/utils.ts",
      "type": "registry:lib"
    },
    {
      "path": "default/accordion.tsx",
      "target": "components/ui/accordion.tsx",
      "type": "registry:ui"
    }
  ]
},
{
  "name": "tooltip",
  "type": "registry:ui",
  "description": "Tooltip styled component.",
  "dependencies": [
    "@zeus-web/tooltip",
    "class-variance-authority",
    "clsx",
    "tailwind-merge"
  ],
  "files": [
    {
      "path": "default/lib/utils.ts",
      "target": "lib/utils.ts",
      "type": "registry:lib"
    },
    {
      "path": "default/tooltip.tsx",
      "target": "components/ui/tooltip.tsx",
      "type": "registry:ui"
    }
  ]
},
{
  "name": "progress",
  "type": "registry:ui",
  "description": "Progress styled component.",
  "dependencies": [
    "@zeus-web/progress",
    "class-variance-authority",
    "clsx",
    "tailwind-merge"
  ],
  "files": [
    {
      "path": "default/lib/utils.ts",
      "target": "lib/utils.ts",
      "type": "registry:lib"
    },
    {
      "path": "default/progress.tsx",
      "target": "components/ui/progress.tsx",
      "type": "registry:ui"
    }
  ]
},
{
  "name": "avatar",
  "type": "registry:ui",
  "description": "Avatar styled component.",
  "dependencies": [
    "@zeus-web/avatar",
    "class-variance-authority",
    "clsx",
    "tailwind-merge"
  ],
  "files": [
    {
      "path": "default/lib/utils.ts",
      "target": "lib/utils.ts",
      "type": "registry:lib"
    },
    {
      "path": "default/avatar.tsx",
      "target": "components/ui/avatar.tsx",
      "type": "registry:ui"
    }
  ]
}
```

---

# 4. AI types / validate 更新

## `packages/ai/src/types.ts`

在 `ZeusWebAiComponentName` 追加：

```ts
  | 'collapsible'
  | 'accordion'
  | 'tooltip'
  | 'progress'
  | 'avatar'
```

## `packages/ai/src/validate.ts`

在 `requiredComponents` 追加：

```ts
  'collapsible',
  'accordion',
  'tooltip',
  'progress',
  'avatar',
```

---

# 5. AI metadata 追加组件

在 `packages/ai/src/metadata.ts` 的 `components` 末尾追加：

```ts
{
  name: 'collapsible',
  description:
    'Styled collapsible component family built on zw-collapsible primitives.',
  primitivePackage: '@zeus-web/collapsible',
  registryCommand: 'zweb add collapsible',
  installCommand:
    'pnpm add @zeus-web/collapsible class-variance-authority clsx tailwind-merge',
  reactImport:
    "import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@zeus-web/collapsible/react'",
  webComponentImport: "import '@zeus-web/collapsible/wc'",
  styledImport:
    "import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'",
  sourceTarget: 'components/ui/collapsible.tsx',
  dependencies: ['@zeus-web/collapsible', ...sharedDependencies],
  props: [
    {
      name: 'open',
      type: 'boolean',
      description: 'Controlled open state.',
    },
    {
      name: 'defaultOpen',
      type: 'boolean',
      description: 'Initial open state.',
    },
    {
      name: 'disabled',
      type: 'boolean',
      description: 'Disables trigger interaction.',
    },
  ],
  events: [
    {
      name: 'open-change',
      reactName: 'onOpenChange',
      description: 'Emitted when open state changes.',
      detail: { open: 'boolean', nativeEvent: 'Event' },
    },
  ],
  slots: [{ name: 'default', description: 'Trigger and content children.' }],
  examples: [
    {
      title: 'React styled usage',
      code: [
        "import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'",
        '',
        'export function Example() {',
        '  return (',
        '    <Collapsible>',
        '      <CollapsibleTrigger>Toggle</CollapsibleTrigger>',
        '      <CollapsibleContent>Content</CollapsibleContent>',
        '    </Collapsible>',
        '  )',
        '}',
      ].join('\n'),
    },
  ],
  styling: {
    usesTailwind: true,
    themeTokens: ['ring-ring'],
    internalSelectors: [
      '[data-slot=collapsible-trigger-button]',
      '[data-slot=collapsible-content]',
    ],
  },
  aiRules: {
    do: [
      'Use Collapsible for simple show/hide content.',
      'Use CollapsibleTrigger and CollapsibleContent together.',
    ],
    dont: [
      'Do not use Collapsible when multiple related sections should coordinate; use Accordion instead.',
    ],
  },
},
{
  name: 'accordion',
  description:
    'Styled accordion component family built on zw-accordion primitives.',
  primitivePackage: '@zeus-web/accordion',
  registryCommand: 'zweb add accordion',
  installCommand:
    'pnpm add @zeus-web/accordion class-variance-authority clsx tailwind-merge',
  reactImport:
    "import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@zeus-web/accordion/react'",
  webComponentImport: "import '@zeus-web/accordion/wc'",
  styledImport:
    "import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'",
  sourceTarget: 'components/ui/accordion.tsx',
  dependencies: ['@zeus-web/accordion', ...sharedDependencies],
  props: [
    {
      name: 'type',
      type: 'AccordionType',
      description: 'Accordion selection mode.',
      values: ['single', 'multiple'],
      default: 'single',
    },
    {
      name: 'value',
      type: 'string',
      description: 'Controlled selected value. Multiple mode uses comma-separated values.',
    },
    {
      name: 'defaultValue',
      type: 'string',
      description: 'Initial selected value.',
    },
    {
      name: 'collapsible',
      type: 'boolean',
      description: 'Allows closing the active item in single mode.',
    },
  ],
  events: [
    {
      name: 'value-change',
      reactName: 'onValueChange',
      description: 'Emitted when open item values change.',
      detail: { value: 'string', values: 'string[]', nativeEvent: 'Event' },
    },
  ],
  slots: [{ name: 'default', description: 'AccordionItem children.' }],
  examples: [
    {
      title: 'React styled usage',
      code: [
        "import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'",
        '',
        'export function Example() {',
        '  return (',
        '    <Accordion defaultValue="item-1" collapsible>',
        '      <AccordionItem value="item-1">',
        '        <AccordionTrigger>Question</AccordionTrigger>',
        '        <AccordionContent>Answer</AccordionContent>',
        '      </AccordionItem>',
        '    </Accordion>',
        '  )',
        '}',
      ].join('\n'),
    },
  ],
  styling: {
    usesTailwind: true,
    themeTokens: ['border', 'ring-ring'],
    internalSelectors: [
      '[data-slot=accordion-item]',
      '[data-slot=accordion-trigger-button]',
      '[data-slot=accordion-content]',
    ],
  },
  aiRules: {
    do: [
      'Use Accordion for grouped expandable sections.',
      'Keep AccordionItem values unique.',
    ],
    dont: [
      'Do not use Accordion as a tab replacement.',
      'Do not omit AccordionItem value.',
    ],
  },
},
{
  name: 'tooltip',
  description:
    'Styled tooltip component family built on zw-tooltip primitives.',
  primitivePackage: '@zeus-web/tooltip',
  registryCommand: 'zweb add tooltip',
  installCommand:
    'pnpm add @zeus-web/tooltip class-variance-authority clsx tailwind-merge',
  reactImport:
    "import { Tooltip, TooltipContent, TooltipTrigger } from '@zeus-web/tooltip/react'",
  webComponentImport: "import '@zeus-web/tooltip/wc'",
  styledImport:
    "import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'",
  sourceTarget: 'components/ui/tooltip.tsx',
  dependencies: ['@zeus-web/tooltip', ...sharedDependencies],
  props: [
    {
      name: 'open',
      type: 'boolean',
      description: 'Controlled open state.',
    },
    {
      name: 'defaultOpen',
      type: 'boolean',
      description: 'Initial open state.',
    },
    {
      name: 'delayDuration',
      type: 'number',
      description: 'Delay in milliseconds before opening.',
      default: '300',
    },
  ],
  events: [
    {
      name: 'open-change',
      reactName: 'onOpenChange',
      description: 'Emitted when open state changes.',
      detail: { open: 'boolean', nativeEvent: 'Event' },
    },
  ],
  slots: [{ name: 'default', description: 'Tooltip trigger and content.' }],
  examples: [
    {
      title: 'React styled usage',
      code: [
        "import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'",
        '',
        'export function Example() {',
        '  return (',
        '    <Tooltip>',
        '      <TooltipTrigger>Hover me</TooltipTrigger>',
        '      <TooltipContent>Tooltip content</TooltipContent>',
        '    </Tooltip>',
        '  )',
        '}',
      ].join('\n'),
    },
  ],
  styling: {
    usesTailwind: true,
    themeTokens: ['bg-primary', 'text-primary-foreground'],
    internalSelectors: [
      '[data-slot=tooltip-trigger-control]',
      '[data-slot=tooltip-content]',
    ],
  },
  aiRules: {
    do: [
      'Use Tooltip for short supplemental information.',
      'Keep tooltip content concise.',
    ],
    dont: [
      'Do not put interactive controls inside TooltipContent.',
      'Do not rely on Tooltip for essential information.',
    ],
  },
},
{
  name: 'progress',
  description: 'Styled progress component built on the zw-progress primitive.',
  primitivePackage: '@zeus-web/progress',
  registryCommand: 'zweb add progress',
  installCommand:
    'pnpm add @zeus-web/progress class-variance-authority clsx tailwind-merge',
  reactImport: "import { Progress } from '@zeus-web/progress/react'",
  webComponentImport: "import '@zeus-web/progress/wc'",
  styledImport: "import { Progress } from '@/components/ui/progress'",
  sourceTarget: 'components/ui/progress.tsx',
  dependencies: ['@zeus-web/progress', ...sharedDependencies],
  props: [
    {
      name: 'value',
      type: 'number',
      description: 'Current progress value.',
    },
    {
      name: 'max',
      type: 'number',
      description: 'Maximum progress value.',
      default: '100',
    },
    {
      name: 'indeterminate',
      type: 'boolean',
      description: 'Whether progress is indeterminate.',
    },
    {
      name: 'label',
      type: 'string',
      description: 'Accessible progress label.',
    },
  ],
  events: [],
  slots: [{ name: 'default', description: 'Optional content.' }],
  examples: [
    {
      title: 'React styled usage',
      code: [
        "import { Progress } from '@/components/ui/progress'",
        '',
        'export function Example() {',
        '  return <Progress value={60} label="Upload progress" />',
        '}',
      ].join('\n'),
    },
  ],
  styling: {
    usesTailwind: true,
    themeTokens: ['bg-primary', 'bg-primary/20'],
    internalSelectors: [
      '[data-slot=progress-root]',
      '[data-slot=progress-indicator]',
    ],
  },
  aiRules: {
    do: ['Use Progress to represent task completion.'],
    dont: ['Do not use Progress as a generic loading spinner.'],
  },
},
{
  name: 'avatar',
  description: 'Styled avatar component family built on zw-avatar primitives.',
  primitivePackage: '@zeus-web/avatar',
  registryCommand: 'zweb add avatar',
  installCommand:
    'pnpm add @zeus-web/avatar class-variance-authority clsx tailwind-merge',
  reactImport:
    "import { Avatar, AvatarFallback, AvatarImage } from '@zeus-web/avatar/react'",
  webComponentImport: "import '@zeus-web/avatar/wc'",
  styledImport:
    "import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'",
  sourceTarget: 'components/ui/avatar.tsx',
  dependencies: ['@zeus-web/avatar', ...sharedDependencies],
  props: [
    {
      name: 'size',
      type: 'AvatarSize',
      description: 'Avatar size.',
      values: ['sm', 'md', 'lg'],
      default: 'md',
    },
    {
      name: 'shape',
      type: 'AvatarShape',
      description: 'Avatar shape.',
      values: ['circle', 'square'],
      default: 'circle',
    },
  ],
  events: [
    {
      name: 'image-load',
      reactName: 'onImageLoad',
      description: 'Emitted when avatar image loads.',
      detail: { nativeEvent: 'Event' },
    },
    {
      name: 'image-error',
      reactName: 'onImageError',
      description: 'Emitted when avatar image fails to load.',
      detail: { nativeEvent: 'Event' },
    },
  ],
  slots: [{ name: 'default', description: 'AvatarImage and AvatarFallback children.' }],
  examples: [
    {
      title: 'React styled usage',
      code: [
        "import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'",
        '',
        'export function Example() {',
        '  return (',
        '    <Avatar>',
        '      <AvatarImage src="/avatar.png" alt="User" />',
        '      <AvatarFallback>ZW</AvatarFallback>',
        '    </Avatar>',
        '  )',
        '}',
      ].join('\n'),
    },
  ],
  styling: {
    usesTailwind: true,
    themeTokens: ['bg-muted'],
    internalSelectors: [
      '[data-slot=avatar-root]',
      '[data-slot=avatar-image]',
      '[data-slot=avatar-fallback]',
    ],
  },
  aiRules: {
    do: [
      'Use AvatarImage with meaningful alt text.',
      'Always provide AvatarFallback.',
    ],
    dont: [
      'Do not use Avatar for decorative icons.',
      'Do not omit fallback content.',
    ],
  },
},
```

---

# 6. Docs sidebar 更新

当前 `componentDocs` 已经维护 Phase 11 组件列表。

在 `apps/docs/.vitepress/data/site.ts` 的 `componentDocs` 末尾追加：

```ts
{
  name: 'collapsible',
  title: 'Collapsible',
  packageName: '@zeus-web/collapsible',
  addCommand: 'zweb add collapsible',
  route: '/components/collapsible',
  description: 'Collapsible component family built on zw-collapsible primitives.',
},
{
  name: 'accordion',
  title: 'Accordion',
  packageName: '@zeus-web/accordion',
  addCommand: 'zweb add accordion',
  route: '/components/accordion',
  description: 'Accordion component family built on zw-accordion primitives.',
},
{
  name: 'tooltip',
  title: 'Tooltip',
  packageName: '@zeus-web/tooltip',
  addCommand: 'zweb add tooltip',
  route: '/components/tooltip',
  description: 'Tooltip component family built on zw-tooltip primitives.',
},
{
  name: 'progress',
  title: 'Progress',
  packageName: '@zeus-web/progress',
  addCommand: 'zweb add progress',
  route: '/components/progress',
  description: 'Progress component built on the zw-progress primitive.',
},
{
  name: 'avatar',
  title: 'Avatar',
  packageName: '@zeus-web/avatar',
  addCommand: 'zweb add avatar',
  route: '/components/avatar',
  description: 'Avatar component family built on zw-avatar primitives.',
},
```

---

# 7. Contract tests

## `packages/primitives/__tests__/phase12-contract.spec.ts`

```ts
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const workspaceRoot = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../../..')

const phase12Primitives = [
  'collapsible',
  'accordion',
  'tooltip',
  'progress',
  'avatar',
]

function readFile(path: string): string {
  return readFileSync(resolve(workspaceRoot, path), 'utf-8')
}

describe('phase 12 primitive contract', () => {
  it('adds all phase 12 primitive packages', () => {
    for (const name of phase12Primitives) {
      expect(
        existsSync(
          resolve(workspaceRoot, `packages/primitives/${name}/package.json`),
        ),
      ).toBe(true)

      expect(
        existsSync(
          resolve(workspaceRoot, `packages/primitives/${name}/src/index.ts`),
        ),
      ).toBe(true)
    }
  })

  it('uses zeus defineElement for all phase 12 primitives', () => {
    for (const name of phase12Primitives) {
      const source = readFile(`packages/primitives/${name}/src/${name}.tsx`)

      expect(source).toContain('defineElement')
      expect(source).toContain('shadow: false')
    }
  })

  it('adds aria relationships for disclosure primitives', () => {
    for (const name of ['collapsible', 'accordion']) {
      const source = readFile(`packages/primitives/${name}/src/${name}.tsx`)

      expect(source).toContain('aria-expanded')
      expect(source).toContain('aria-controls')
      expect(source).toContain('hidden')
    }
  })

  it('keeps tooltip lightweight and accessible', () => {
    const source = readFile('packages/primitives/tooltip/src/tooltip.tsx')

    expect(source).toContain('role="tooltip"')
    expect(source).toContain('aria-describedby')
    expect(source).toContain("nativeEvent.key === 'Escape'")
    expect(source).not.toContain('floating-ui')
    expect(source).not.toContain('document.addEventListener')
  })

  it('adds progressbar semantics', () => {
    const source = readFile('packages/primitives/progress/src/progress.tsx')

    expect(source).toContain('role="progressbar"')
    expect(source).toContain('aria-valuenow')
    expect(source).toContain('aria-valuemax')
  })

  it('adds avatar image load/error events', () => {
    const source = readFile('packages/primitives/avatar/src/avatar.tsx')

    expect(source).toContain('imageLoad')
    expect(source).toContain('imageError')
    expect(source).toContain('AvatarFallback')
  })
})
```

## `packages/registry/__tests__/phase12-registry.spec.ts`

```ts
import type { Registry } from '../src'

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'
import { validateRegistry } from '../src'

const phase12Items = [
  'collapsible',
  'accordion',
  'tooltip',
  'progress',
  'avatar',
]

describe('phase 12 registry contract', () => {
  const registry = JSON.parse(
    readFileSync(
      resolve(process.cwd(), 'packages/registry/registry.json'),
      'utf-8',
    ),
  ) as Registry

  it('keeps registry valid', () => {
    expect(validateRegistry(registry)).toEqual({
      valid: true,
      errors: [],
    })
  })

  it('registers all phase 12 items', () => {
    for (const name of phase12Items) {
      const item = registry.items.find(candidate => candidate.name === name)

      expect(item).toBeDefined()
      expect(item?.dependencies).toContain(`@zeus-web/${name}`)
      expect(
        item?.files.some(file => file.target === `components/ui/${name}.tsx`),
      ).toBe(true)
    }
  })
})
```

记得把 `packages/registry/package.json` 的 test 改成包含 phase11/phase12：

```json
{
  "scripts": {
    "test": "vitest --root ../.. --project unit packages/registry/__tests__/registry.spec.ts packages/registry/__tests__/phase11-registry.spec.ts packages/registry/__tests__/phase12-registry.spec.ts"
  }
}
```

---

# 8. `check-docs.ts` 组件列表同步

你之前 Phase 11 后需要把 docs check 的组件列表集中化。Phase 12 继续追加：

```ts
const componentDocs = [
  'button',
  'input',
  'checkbox',
  'switch',
  'tabs',
  'dialog',
  'label',
  'textarea',
  'radio-group',
  'select',
  'card',
  'badge',
  'separator',
  'skeleton',
  'alert',
  'collapsible',
  'accordion',
  'tooltip',
  'progress',
  'avatar',
]
```

---

# 9. 生成文档

执行：

```bash
pnpm docs:generate
```

新增生成：

```txt
apps/docs/components/collapsible.md
apps/docs/components/accordion.md
apps/docs/components/tooltip.md
apps/docs/components/progress.md
apps/docs/components/avatar.md
```

---

# 10. 验收命令

```bash
pnpm --filter @zeus-web/collapsible check
pnpm --filter @zeus-web/accordion check
pnpm --filter @zeus-web/tooltip check
pnpm --filter @zeus-web/progress check
pnpm --filter @zeus-web/avatar check

pnpm --filter @zeus-web/registry test
pnpm test
pnpm check
pnpm build
pnpm check:exports
pnpm check:build-output

pnpm docs:generate
pnpm docs:check-generated
pnpm docs:check
pnpm docs:build
pnpm site:check
```

---

# 建议提交

```txt
feat(primitives): add phase 12 disclosure and feedback primitives
feat(registry): add phase 12 styled components
feat(ai): add phase 12 component metadata
test(primitives): add phase 12 primitive contract
test(registry): add phase 12 registry contract
docs: refresh generated component docs
```

Phase 12 完成后，组件数量会从 15 个扩到 20 个，已经覆盖基础表单、展示、折叠、提示、头像和进度。下一阶段再做 `popover / dropdown-menu / toast` 更合理。
