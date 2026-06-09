下面给 **Phase 10：Accessibility & Interaction Hardening** 的详细设计与完整代码。

当前 primitives 已经有基础语义，但还不完整：

- `DialogContent` 现在只有 `role="dialog"`、`aria-modal` 和 `Escape` 关闭，没有 `aria-labelledby / aria-describedby`、焦点回收、Tab 焦点环。
- `TabsTrigger` 现在有 `role="tab"`、`aria-selected`、`tabIndex`、Enter/Space 激活，但没有 Arrow/Home/End roving focus。
- `Button` 已有 `aria-disabled / aria-pressed`，但 loading 时没有 `aria-busy`，也缺少 icon-only 场景用的 `aria-label` 显式 prop。
- `Input / Checkbox / Switch` 已有基础 `aria-invalid / aria-checked`，但缺少 `aria-label / aria-describedby` 这类可组合无障碍能力。

---

# Phase 10 目标

```txt
Phase 10：Accessibility & Interaction Hardening

P0:
  Dialog:
    - aria-labelledby / aria-describedby
    - trigger aria-controls / aria-haspopup
    - Escape close
    - Tab / Shift+Tab focus trap
    - close 后 return focus
    - show/close 方法保持可用

  Tabs:
    - trigger/content id 关联
    - aria-controls / aria-labelledby
    - ArrowLeft / ArrowRight / ArrowUp / ArrowDown
    - Home / End
    - roving tabindex

P1:
  Button:
    - aria-label prop
    - loading => aria-busy
    - disabled/loading 统一阻止 press

  Input:
    - id / aria-label / aria-describedby / aria-errormessage
    - autocomplete

  Checkbox/Switch:
    - aria-label / aria-describedby
    - aria-required
    - 保持 checked-change / focus-change

P2:
  增加 a11y contract 测试，防止后续回退。
```

---

# 1. 替换 `packages/primitives/dialog/src/dialog.tsx`

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

const DialogContext = createContext<DialogContextValue>()

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

  provide(DialogContext, context)

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
  const dialog = inject(DialogContext)
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
  const dialog = inject(DialogContext)
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
  const dialog = inject(DialogContext)
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
  () => {
    const dialog = inject(DialogContext)

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
  () => {
    const dialog = inject(DialogContext)

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
```

---

# 2. 替换 `packages/primitives/tabs/src/tabs.tsx`

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

const TabsContext = createContext<TabsContextValue>()

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

  provide(TabsContext, context)

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

function setupTabsContent(props: TabsContentProps) {
  const tabs = inject(TabsContext)
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
```

---

# 3. 替换 `packages/primitives/button/src/button.tsx`

```tsx
import type { DefineElementContext, EventDefinition } from '@zeus-js/zeus'
import { defineElement, event, Host, prop, Slot } from '@zeus-js/zeus'

export type ButtonVariant =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'

export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

export type ButtonType = 'button' | 'submit' | 'reset'

export interface ButtonProps {
  variant?: ButtonVariant
  size?: ButtonSize
  type?: ButtonType
  disabled?: boolean
  loading?: boolean
  pressed?: boolean
  name?: string
  value?: string
  ariaLabel?: string
}

export interface ButtonPressDetail {
  nativeEvent: MouseEvent
}

export interface ButtonElement extends HTMLElement {
  focus: () => void
  blur: () => void
  click: () => void
}

interface ButtonEmits extends Record<string, EventDefinition<unknown>> {
  press: EventDefinition<ButtonPressDetail>
}

function setup(
  props: ButtonProps,
  ctx: DefineElementContext<ButtonElement, ButtonEmits>,
) {
  let control!: HTMLButtonElement

  const isDisabled = () => Boolean(props.disabled || props.loading)

  const handleClick = (nativeEvent: MouseEvent) => {
    if (isDisabled()) {
      nativeEvent.preventDefault()
      nativeEvent.stopPropagation()
      return
    }

    ctx.emit.press({ nativeEvent })
  }

  ctx.expose({
    focus(): void {
      control.focus()
    },
    blur(): void {
      control.blur()
    },
    click(): void {
      control.click()
    },
  })

  return (
    <Host
      data-slot="button-root"
      data-variant={() => props.variant}
      data-size={() => props.size}
      data-disabled={() => (isDisabled() ? '' : undefined)}
      data-loading={() => (props.loading ? '' : undefined)}
      data-pressed={() => (props.pressed ? '' : undefined)}
    >
      <button
        ref={(element: HTMLButtonElement | null) => {
          if (element) control = element
        }}
        part="button"
        data-slot="button"
        prop:type={() => props.type || 'button'}
        disabled={() => isDisabled()}
        aria-label={() => props.ariaLabel}
        aria-disabled={() => (isDisabled() ? 'true' : undefined)}
        aria-busy={() => (props.loading ? 'true' : undefined)}
        aria-pressed={() =>
          props.pressed === undefined
            ? undefined
            : String(Boolean(props.pressed))
        }
        name={() => props.name}
        value={() => props.value}
        onClick={handleClick}
      >
        <span part="prefix" data-slot="button-prefix">
          <Slot name="prefix" />
        </span>

        <span part="label" data-slot="button-label">
          <Slot />
        </span>

        <span part="suffix" data-slot="button-suffix">
          <Slot name="suffix" />
        </span>
      </button>
    </Host>
  )
}

export const Button = defineElement<ButtonProps, ButtonElement, ButtonEmits>(
  'zw-button',
  {
    shadow: false,
    props: {
      variant: prop(
        ['default', 'primary', 'secondary', 'outline', 'ghost', 'danger'],
        {
          default: 'default',
          reflect: true,
        },
      ),
      size: prop(['sm', 'md', 'lg', 'icon'], {
        default: 'md',
        reflect: true,
      }),
      type: prop(['button', 'submit', 'reset'], {
        default: 'button',
      }),
      disabled: prop(Boolean),
      loading: prop(Boolean),
      pressed: prop(Boolean, {
        reflect: true,
      }),
      name: String,
      value: String,
      ariaLabel: prop(String, {
        attr: 'aria-label',
      }),
    },
    emits: {
      press: event<{
        nativeEvent: MouseEvent
      }>(),
    },
    meta: {
      description: 'Headless button primitive.',
    },
  },
  setup,
)
```

---

# 4. 替换 `packages/primitives/input/src/input.tsx`

```tsx
import type { DefineElementContext, EventDefinition } from '@zeus-js/zeus'
import { defineElement, event, Host, prop, Slot } from '@zeus-js/zeus'

export type InputType =
  | 'text'
  | 'email'
  | 'password'
  | 'search'
  | 'tel'
  | 'url'
  | 'number'

export type InputSize = 'sm' | 'md' | 'lg'

export interface InputProps {
  id?: string
  value?: string
  defaultValue?: string
  type?: InputType
  size?: InputSize
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  required?: boolean
  invalid?: boolean
  name?: string
  autocomplete?: string
  ariaLabel?: string
  ariaDescribedby?: string
  ariaErrormessage?: string
  formatter?: (value: string) => string
}

export interface InputValueChangeDetail {
  value: string
  nativeEvent: Event
}

export interface InputFocusChangeDetail {
  focused: boolean
  nativeEvent: FocusEvent
}

export interface InputElement extends HTMLElement {
  value?: string
  focus: () => void
  blur: () => void
  select: () => void
}

interface InputEmits extends Record<string, EventDefinition<unknown>> {
  valueChange: EventDefinition<InputValueChangeDetail>
  focusChange: EventDefinition<InputFocusChangeDetail>
}

function resolveInputValue(props: InputProps): string {
  if (props.value !== undefined) return props.value
  if (props.defaultValue !== undefined) return props.defaultValue
  return ''
}

function setup(
  props: InputProps,
  ctx: DefineElementContext<InputElement, InputEmits>,
) {
  let control!: HTMLInputElement

  const formatValue = (value: string) =>
    typeof props.formatter === 'function' ? props.formatter(value) : value

  const handleInput = (nativeEvent: Event) => {
    const value = formatValue(control.value)

    control.value = value
    ctx.host.value = value
    ctx.emit.valueChange({ value, nativeEvent })
  }

  ctx.expose({
    focus(): void {
      control.focus()
    },
    blur(): void {
      control.blur()
    },
    select(): void {
      control.select()
    },
  })

  return (
    <Host
      data-slot="input-root"
      data-size={() => props.size}
      data-disabled={() => (props.disabled ? '' : undefined)}
      data-invalid={() => (props.invalid ? '' : undefined)}
    >
      <label part="root" for={() => props.id}>
        <span part="prefix" data-slot="input-prefix">
          <Slot name="prefix" />
        </span>

        <input
          ref={(element: HTMLInputElement | null) => {
            if (element) control = element
          }}
          id={() => props.id}
          part="control"
          data-slot="input"
          prop:type={() => props.type || 'text'}
          prop:value={() => resolveInputValue(props)}
          placeholder={() => props.placeholder}
          disabled={() => Boolean(props.disabled)}
          readOnly={() => Boolean(props.readonly)}
          required={() => Boolean(props.required)}
          name={() => props.name}
          autoComplete={() => props.autocomplete}
          aria-label={() => props.ariaLabel}
          aria-describedby={() => props.ariaDescribedby}
          aria-errormessage={() => props.ariaErrormessage}
          aria-invalid={() => (props.invalid ? 'true' : undefined)}
          onInput={handleInput}
          onFocus={nativeEvent => {
            ctx.emit.focusChange({ focused: true, nativeEvent })
          }}
          onBlur={nativeEvent => {
            ctx.emit.focusChange({ focused: false, nativeEvent })
          }}
        />

        <span part="suffix" data-slot="input-suffix">
          <Slot name="suffix" />
        </span>
      </label>

      <div part="message" data-slot="input-message">
        <Slot name="message" />
      </div>
    </Host>
  )
}

export const Input = defineElement<InputProps, InputElement, InputEmits>(
  'zw-input',
  {
    shadow: false,
    props: {
      id: String,
      value: {
        type: String,
        reflect: true,
      },
      defaultValue: {
        type: String,
        attr: 'default-value',
      },
      type: prop(
        ['text', 'email', 'password', 'search', 'tel', 'url', 'number'],
        {
          default: 'text',
          reflect: true,
        },
      ),
      size: prop(['sm', 'md', 'lg'], {
        default: 'md',
        reflect: true,
      }),
      placeholder: String,
      disabled: prop(Boolean),
      readonly: prop(Boolean, {
        attr: 'readonly',
      }),
      required: prop(Boolean),
      invalid: prop(Boolean),
      name: String,
      autocomplete: prop(String, {
        attr: 'autocomplete',
      }),
      ariaLabel: prop(String, {
        attr: 'aria-label',
      }),
      ariaDescribedby: prop(String, {
        attr: 'aria-describedby',
      }),
      ariaErrormessage: prop(String, {
        attr: 'aria-errormessage',
      }),
      formatter: Function,
    },
    emits: {
      valueChange: event<{ value: string; nativeEvent: Event }>(),
      focusChange: event<{
        focused: boolean
        nativeEvent: FocusEvent
      }>(),
    },
    meta: {
      description: 'Headless input primitive.',
    },
  },
  setup,
)
```

---

# 5. 替换 `packages/primitives/checkbox/src/checkbox.tsx`

```tsx
import type { DefineElementContext, EventDefinition } from '@zeus-js/zeus'
import { defineElement, event, Host, prop, Slot } from '@zeus-js/zeus'

export type CheckboxSize = 'sm' | 'md' | 'lg'

export interface CheckboxProps {
  checked?: boolean
  defaultChecked?: boolean
  indeterminate?: boolean
  size?: CheckboxSize
  disabled?: boolean
  required?: boolean
  invalid?: boolean
  name?: string
  value?: string
  ariaLabel?: string
  ariaDescribedby?: string
}

export interface CheckboxCheckedChangeDetail {
  checked: boolean
  nativeEvent: Event
}

export interface CheckboxFocusChangeDetail {
  focused: boolean
  nativeEvent: FocusEvent
}

export interface CheckboxElement extends HTMLElement {
  checked?: boolean
  indeterminate?: boolean
  focus: () => void
  blur: () => void
}

interface CheckboxEmits extends Record<string, EventDefinition<unknown>> {
  checkedChange: EventDefinition<CheckboxCheckedChangeDetail>
  focusChange: EventDefinition<CheckboxFocusChangeDetail>
}

function resolveChecked(props: CheckboxProps): boolean {
  if (props.checked !== undefined) return Boolean(props.checked)
  if (props.defaultChecked !== undefined) return Boolean(props.defaultChecked)
  return false
}

function setup(
  props: CheckboxProps,
  ctx: DefineElementContext<CheckboxElement, CheckboxEmits>,
) {
  let control!: HTMLInputElement

  const handleChange = (nativeEvent: Event) => {
    const checked = control.checked

    ctx.host.checked = checked
    ctx.emit.checkedChange({ checked, nativeEvent })
  }

  ctx.expose({
    focus(): void {
      control.focus()
    },
    blur(): void {
      control.blur()
    },
  })

  return (
    <Host
      data-slot="checkbox-root"
      data-state={() =>
        props.indeterminate
          ? 'indeterminate'
          : resolveChecked(props)
            ? 'checked'
            : 'unchecked'
      }
      data-size={() => props.size}
      data-disabled={() => (props.disabled ? '' : undefined)}
      data-invalid={() => (props.invalid ? '' : undefined)}
    >
      <label part="root">
        <input
          ref={(element: HTMLInputElement | null) => {
            if (element) control = element
          }}
          part="control"
          data-slot="checkbox-control"
          prop:type={() => 'checkbox'}
          prop:checked={() => resolveChecked(props)}
          prop:indeterminate={() => Boolean(props.indeterminate)}
          disabled={() => Boolean(props.disabled)}
          required={() => Boolean(props.required)}
          name={() => props.name}
          value={() => props.value}
          aria-label={() => props.ariaLabel}
          aria-describedby={() => props.ariaDescribedby}
          aria-required={() => (props.required ? 'true' : undefined)}
          aria-checked={() =>
            props.indeterminate ? 'mixed' : String(resolveChecked(props))
          }
          aria-invalid={() => (props.invalid ? 'true' : undefined)}
          onChange={handleChange}
          onFocus={nativeEvent => {
            ctx.emit.focusChange({ focused: true, nativeEvent })
          }}
          onBlur={nativeEvent => {
            ctx.emit.focusChange({ focused: false, nativeEvent })
          }}
        />

        <span part="indicator" data-slot="checkbox-indicator">
          <Slot name="indicator" />
        </span>

        <span part="label" data-slot="checkbox-label">
          <Slot />
        </span>
      </label>
    </Host>
  )
}

export const Checkbox = defineElement<
  CheckboxProps,
  CheckboxElement,
  CheckboxEmits
>(
  'zw-checkbox',
  {
    shadow: false,
    props: {
      checked: prop(Boolean, {
        reflect: true,
      }),
      defaultChecked: prop(Boolean, {
        attr: 'default-checked',
      }),
      indeterminate: prop(Boolean, {
        reflect: true,
      }),
      size: prop(['sm', 'md', 'lg'], {
        default: 'md',
        reflect: true,
      }),
      disabled: prop(Boolean),
      required: prop(Boolean),
      invalid: prop(Boolean),
      name: String,
      value: String,
      ariaLabel: prop(String, {
        attr: 'aria-label',
      }),
      ariaDescribedby: prop(String, {
        attr: 'aria-describedby',
      }),
    },
    emits: {
      checkedChange: event<{
        checked: boolean
        nativeEvent: Event
      }>(),
      focusChange: event<{
        focused: boolean
        nativeEvent: FocusEvent
      }>(),
    },
    meta: {
      description: 'Headless checkbox primitive.',
    },
  },
  setup,
)
```

---

# 6. 替换 `packages/primitives/switch/src/switch.tsx`

```tsx
import type { DefineElementContext, EventDefinition } from '@zeus-js/zeus'
import { defineElement, event, Host, prop, Slot } from '@zeus-js/zeus'

export type SwitchSize = 'sm' | 'md' | 'lg'

export interface SwitchProps {
  checked?: boolean
  defaultChecked?: boolean
  size?: SwitchSize
  disabled?: boolean
  required?: boolean
  invalid?: boolean
  name?: string
  value?: string
  ariaLabel?: string
  ariaDescribedby?: string
}

export interface SwitchCheckedChangeDetail {
  checked: boolean
  nativeEvent: Event
}

export interface SwitchFocusChangeDetail {
  focused: boolean
  nativeEvent: FocusEvent
}

export interface SwitchElement extends HTMLElement {
  checked?: boolean
  focus: () => void
  blur: () => void
}

interface SwitchEmits extends Record<string, EventDefinition<unknown>> {
  checkedChange: EventDefinition<SwitchCheckedChangeDetail>
  focusChange: EventDefinition<SwitchFocusChangeDetail>
}

function resolveChecked(props: SwitchProps): boolean {
  if (props.checked !== undefined) return Boolean(props.checked)
  if (props.defaultChecked !== undefined) return Boolean(props.defaultChecked)
  return false
}

function setup(
  props: SwitchProps,
  ctx: DefineElementContext<SwitchElement, SwitchEmits>,
) {
  let control!: HTMLInputElement

  const handleChange = (nativeEvent: Event) => {
    const checked = control.checked

    ctx.host.checked = checked
    ctx.emit.checkedChange({ checked, nativeEvent })
  }

  ctx.expose({
    focus(): void {
      control.focus()
    },
    blur(): void {
      control.blur()
    },
  })

  return (
    <Host
      data-slot="switch-root"
      data-state={() => (resolveChecked(props) ? 'checked' : 'unchecked')}
      data-size={() => props.size}
      data-disabled={() => (props.disabled ? '' : undefined)}
      data-invalid={() => (props.invalid ? '' : undefined)}
    >
      <label part="root">
        <input
          ref={(element: HTMLInputElement | null) => {
            if (element) control = element
          }}
          part="control"
          data-slot="switch-control"
          prop:type={() => 'checkbox'}
          prop:checked={() => resolveChecked(props)}
          role="switch"
          disabled={() => Boolean(props.disabled)}
          required={() => Boolean(props.required)}
          name={() => props.name}
          value={() => props.value}
          aria-label={() => props.ariaLabel}
          aria-describedby={() => props.ariaDescribedby}
          aria-required={() => (props.required ? 'true' : undefined)}
          aria-checked={() => String(resolveChecked(props))}
          aria-invalid={() => (props.invalid ? 'true' : undefined)}
          onChange={handleChange}
          onFocus={nativeEvent => {
            ctx.emit.focusChange({ focused: true, nativeEvent })
          }}
          onBlur={nativeEvent => {
            ctx.emit.focusChange({ focused: false, nativeEvent })
          }}
        />

        <span part="track" data-slot="switch-track">
          <span part="thumb" data-slot="switch-thumb" />
        </span>

        <span part="label" data-slot="switch-label">
          <Slot />
        </span>
      </label>
    </Host>
  )
}

export const Switch = defineElement<SwitchProps, SwitchElement, SwitchEmits>(
  'zw-switch',
  {
    shadow: false,
    props: {
      checked: prop(Boolean, {
        reflect: true,
      }),
      defaultChecked: prop(Boolean, {
        attr: 'default-checked',
      }),
      size: prop(['sm', 'md', 'lg'], {
        default: 'md',
        reflect: true,
      }),
      disabled: prop(Boolean),
      required: prop(Boolean),
      invalid: prop(Boolean),
      name: String,
      value: String,
      ariaLabel: prop(String, {
        attr: 'aria-label',
      }),
      ariaDescribedby: prop(String, {
        attr: 'aria-describedby',
      }),
    },
    emits: {
      checkedChange: event<{
        checked: boolean
        nativeEvent: Event
      }>(),
      focusChange: event<{
        focused: boolean
        nativeEvent: FocusEvent
      }>(),
    },
    meta: {
      description: 'Headless switch primitive.',
    },
  },
  setup,
)
```

---

# 7. 新增 a11y contract 测试

新增文件：

```txt
packages/primitives/__tests__/a11y-contract.spec.ts
```

```ts
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const workspaceRoot = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../../..')

function readPrimitive(name: string): string {
  return readFileSync(
    resolve(workspaceRoot, `packages/primitives/${name}/src/${name}.tsx`),
    'utf-8',
  )
}

describe('primitive accessibility contract', () => {
  it('hardens dialog aria relationships and focus management', () => {
    const source = readPrimitive('dialog')

    expect(source).toContain('aria-haspopup')
    expect(source).toContain('aria-controls')
    expect(source).toContain('aria-labelledby')
    expect(source).toContain('aria-describedby')
    expect(source).toContain('trapFocus')
    expect(source).toContain('returnFocus')
    expect(source).toContain("event.key === 'Escape'")
  })

  it('hardens tabs roving focus and aria relationships', () => {
    const source = readPrimitive('tabs')

    expect(source).toContain('aria-controls')
    expect(source).toContain('aria-labelledby')
    expect(source).toContain('registerTrigger')
    expect(source).toContain('moveFocus')
    expect(source).toContain("key === 'Home'")
    expect(source).toContain("key === 'End'")
    expect(source).toContain("key === 'ArrowRight'")
    expect(source).toContain("key === 'ArrowDown'")
  })

  it('supports accessible icon-only and loading buttons', () => {
    const source = readPrimitive('button')

    expect(source).toContain('ariaLabel')
    expect(source).toContain("attr: 'aria-label'")
    expect(source).toContain('aria-busy')
  })

  it('supports input aria description fields', () => {
    const source = readPrimitive('input')

    expect(source).toContain('ariaLabel')
    expect(source).toContain('ariaDescribedby')
    expect(source).toContain('ariaErrormessage')
    expect(source).toContain("attr: 'aria-describedby'")
    expect(source).toContain("attr: 'aria-errormessage'")
  })

  it('supports checkbox and switch aria composition props', () => {
    const checkbox = readPrimitive('checkbox')
    const switchSource = readPrimitive('switch')

    for (const source of [checkbox, switchSource]) {
      expect(source).toContain('ariaLabel')
      expect(source).toContain('ariaDescribedby')
      expect(source).toContain('aria-required')
      expect(source).toContain("attr: 'aria-label'")
      expect(source).toContain("attr: 'aria-describedby'")
    }
  })
})
```

---

# 8. 建议同步更新 AI metadata

Phase 10 加了这些公开 prop：

```txt
Button:
  aria-label

Input:
  id
  autocomplete
  aria-label
  aria-describedby
  aria-errormessage

Checkbox:
  aria-label
  aria-describedby

Switch:
  aria-label
  aria-describedby
```

建议在 `packages/ai/src/metadata.ts` 的对应组件 `props` 里补充这些项。示例：

```ts
{
  name: 'aria-label',
  type: 'string',
  description: 'Accessible label for icon-only or unlabeled controls.',
},
{
  name: 'aria-describedby',
  type: 'string',
  description: 'ID reference for additional accessible description.',
},
```

如果做了 Phase 9.3 的自动文档生成，补完 metadata 后执行：

```bash
pnpm docs:generate
```

---

# 9. Phase 10 验收命令

```bash
pnpm --filter @zeus-web/button test
pnpm --filter @zeus-web/input test
pnpm --filter @zeus-web/checkbox test
pnpm --filter @zeus-web/switch test
pnpm --filter @zeus-web/tabs test
pnpm --filter @zeus-web/dialog test

pnpm test
pnpm check
pnpm build
pnpm check:exports
pnpm check:build-output

pnpm docs:generate
pnpm docs:check
pnpm docs:build
pnpm site:check
```

验收标准：

```txt
1. Dialog 有 aria-controls / aria-labelledby / aria-describedby。
2. Dialog Escape 能关闭。
3. Dialog Tab / Shift+Tab 能保持焦点在 content 内。
4. Dialog close 后尝试 return focus 到 trigger。
5. Tabs 有 trigger/content id 关联。
6. Tabs 支持 Arrow / Home / End 键盘导航。
7. Button loading 时有 aria-busy。
8. Button 支持 aria-label。
9. Input/Checkbox/Switch 支持 aria-label / aria-describedby。
10. 新增 a11y contract 测试通过。
```

建议提交：

```txt
feat(primitives): harden accessibility interactions
test(primitives): add accessibility contract coverage
docs: refresh generated component docs
```
