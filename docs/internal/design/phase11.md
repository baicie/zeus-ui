下面给 **Phase 11：组件扩展第一批** 的详细设计与完整代码草案。

当前仓库的规则是：

- 每个 primitive 包在 `packages/primitives/<name>` 下，`package.json` 使用同一套 `wc / react / vue / custom-elements / zeus.components` exports。现有 `@zeus-web/button` 就是这个结构。
- 每个 primitive 的 `tsconfig.json` 继承 `scripts/config/tsconfig.zeus-jsx.json`，只 include `src`。
- Registry 通过 `packages/registry/registry.json` 把 `default/<name>.tsx` 复制到 `components/ui/<name>.tsx`。
- Registry 校验要求 `registry:ui` item 依赖 `@zeus-web/<name>`、`class-variance-authority`、`clsx`、`tailwind-merge`，并且 target 必须进入 `components/ui`。
- Docs 已经由 `aiMetadata + registry.json` 自动生成，所以 Phase 11 的组件必须同步 `packages/ai/src/metadata.ts`，然后跑 `pnpm docs:generate`。

---

# Phase 11 范围

这阶段只做 **低风险第一批组件**：

```txt
Form:
  label
  textarea
  radio-group
  select

Display:
  card
  badge
  separator
  skeleton
  alert
```

不做：

```txt
popover
tooltip
dropdown-menu
toast
combobox
command
calendar
date-picker
```

这些需要 positioning、portal、focus scope、typeahead、floating UI，建议放到 Phase 12/13 后面。

---

# 1. 新增 primitive 包结构

新增目录：

```txt
packages/primitives/label
packages/primitives/textarea
packages/primitives/radio-group
packages/primitives/select
packages/primitives/card
packages/primitives/badge
packages/primitives/separator
packages/primitives/skeleton
packages/primitives/alert
```

每个包都使用同一个 `package.json / tsconfig.json` 模板。

## `packages/primitives/<name>/package.json`

把 `<name>` 和描述替换即可。

```json
{
  "name": "@zeus-web/<name>",
  "type": "module",
  "version": "0.0.0",
  "description": "Headless <name> primitive for Zeus Web.",
  "license": "MIT",
  "sideEffects": ["./dist/wc/index.js", "./dist/wc/*.js", "./dist/**/*.css"],
  "exports": {
    ".": {
      "types": "./dist/wc/index.d.ts",
      "import": "./dist/wc/index.js"
    },
    "./wc": {
      "types": "./dist/wc/index.d.ts",
      "import": "./dist/wc/index.js"
    },
    "./react": {
      "types": "./dist/react/index.d.ts",
      "import": "./dist/react/index.js"
    },
    "./vue": {
      "types": "./dist/vue/index.d.ts",
      "import": "./dist/vue/index.js"
    },
    "./vue/global": {
      "types": "./dist/vue/global.d.ts"
    },
    "./custom-elements.json": {
      "default": "./dist/custom-elements.json"
    },
    "./zeus.components.json": {
      "default": "./dist/zeus.components.json"
    }
  },
  "files": ["dist"],
  "scripts": {
    "dev": "rolldown -c ../../../rolldown.config.ts --watch",
    "build": "rimraf dist && rolldown -c ../../../rolldown.config.ts",
    "check": "tsc -p tsconfig.json --noEmit",
    "test": "vitest --root ../../.. --project unit packages/primitives/__tests__/phase11-contract.spec.ts"
  },
  "peerDependencies": {
    "@zeus-js/zeus": ">=0.1.0-beta.5 <0.2.0",
    "react": ">=18 || >=19",
    "vue": ">=3"
  },
  "peerDependenciesMeta": {
    "react": {
      "optional": true
    },
    "vue": {
      "optional": true
    }
  },
  "dependencies": {
    "@zeus-js/runtime-dom": "0.1.0-beta.5",
    "@zeus-js/web-c-runtime": "0.2.0",
    "@zeus-web/zeus-compat": "workspace:*"
  }
}
```

## `packages/primitives/<name>/tsconfig.json`

```json
{
  "extends": "../../../scripts/config/tsconfig.zeus-jsx.json",
  "compilerOptions": {
    "composite": false,
    "rootDir": "src",
    "outDir": "dist",
    "isolatedDeclarations": false
  },
  "include": ["src"]
}
```

---

# 2. Primitive 源码

## `packages/primitives/label/src/index.ts`

```ts
export * from './label'
```

## `packages/primitives/label/src/label.tsx`

```tsx
import type { DefineElementContext } from '@zeus-js/zeus'
import { defineElement, Host, prop, Slot } from '@zeus-js/zeus'

export type LabelSize = 'sm' | 'md' | 'lg'

export interface LabelProps {
  for?: string
  size?: LabelSize
  required?: boolean
  disabled?: boolean
  visuallyHidden?: boolean
}

export interface LabelElement extends HTMLElement {
  focus: () => void
}

function setup(props: LabelProps, ctx: DefineElementContext<LabelElement>) {
  let control!: HTMLLabelElement

  ctx.expose({
    focus(): void {
      control.focus()
    },
  })

  return (
    <Host
      data-slot="label-root"
      data-size={() => props.size}
      data-required={() => (props.required ? '' : undefined)}
      data-disabled={() => (props.disabled ? '' : undefined)}
      data-visually-hidden={() => (props.visuallyHidden ? '' : undefined)}
    >
      <label
        ref={(element: HTMLLabelElement | null) => {
          if (element) control = element
        }}
        part="label"
        data-slot="label"
        for={() => props.for}
        aria-disabled={() => (props.disabled ? 'true' : undefined)}
      >
        <Slot />
        <span
          part="required-indicator"
          data-slot="label-required-indicator"
          aria-hidden={() => 'true'}
          hidden={() => !props.required}
        >
          *
        </span>
      </label>
    </Host>
  )
}

export const Label = defineElement<LabelProps, LabelElement>(
  'zw-label',
  {
    shadow: false,
    props: {
      for: String,
      size: prop(['sm', 'md', 'lg'], {
        default: 'md',
        reflect: true,
      }),
      required: prop(Boolean),
      disabled: prop(Boolean),
      visuallyHidden: prop(Boolean, {
        attr: 'visually-hidden',
      }),
    },
    meta: {
      description: 'Headless label primitive.',
    },
  },
  setup,
)
```

---

## `packages/primitives/textarea/src/index.ts`

```ts
export * from './textarea'
```

## `packages/primitives/textarea/src/textarea.tsx`

```tsx
import type { DefineElementContext, EventDefinition } from '@zeus-js/zeus'
import { defineElement, event, Host, prop, Slot } from '@zeus-js/zeus'

export type TextareaSize = 'sm' | 'md' | 'lg'
export type TextareaResize = 'none' | 'vertical' | 'horizontal' | 'both'

export interface TextareaProps {
  id?: string
  value?: string
  defaultValue?: string
  size?: TextareaSize
  resize?: TextareaResize
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  required?: boolean
  invalid?: boolean
  name?: string
  rows?: number
  cols?: number
  minlength?: number
  maxlength?: number
  ariaLabel?: string
  ariaDescribedby?: string
  ariaErrormessage?: string
  formatter?: (value: string) => string
}

export interface TextareaValueChangeDetail {
  value: string
  nativeEvent: Event
}

export interface TextareaFocusChangeDetail {
  focused: boolean
  nativeEvent: FocusEvent
}

export interface TextareaElement extends HTMLElement {
  value?: string
  focus: () => void
  blur: () => void
  select: () => void
}

interface TextareaEmits extends Record<string, EventDefinition<unknown>> {
  valueChange: EventDefinition<TextareaValueChangeDetail>
  focusChange: EventDefinition<TextareaFocusChangeDetail>
}

function resolveTextareaValue(props: TextareaProps): string {
  if (props.value !== undefined) return props.value
  if (props.defaultValue !== undefined) return props.defaultValue
  return ''
}

function setup(
  props: TextareaProps,
  ctx: DefineElementContext<TextareaElement, TextareaEmits>,
) {
  let control!: HTMLTextAreaElement

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
      data-slot="textarea-root"
      data-size={() => props.size}
      data-resize={() => props.resize}
      data-disabled={() => (props.disabled ? '' : undefined)}
      data-invalid={() => (props.invalid ? '' : undefined)}
    >
      <label part="root" for={() => props.id}>
        <textarea
          ref={(element: HTMLTextAreaElement | null) => {
            if (element) control = element
          }}
          id={() => props.id}
          part="control"
          data-slot="textarea"
          prop:value={() => resolveTextareaValue(props)}
          placeholder={() => props.placeholder}
          disabled={() => Boolean(props.disabled)}
          readOnly={() => Boolean(props.readonly)}
          required={() => Boolean(props.required)}
          name={() => props.name}
          rows={() => props.rows}
          cols={() => props.cols}
          minLength={() => props.minlength}
          maxLength={() => props.maxlength}
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
      </label>

      <div part="message" data-slot="textarea-message">
        <Slot name="message" />
      </div>
    </Host>
  )
}

export const Textarea = defineElement<
  TextareaProps,
  TextareaElement,
  TextareaEmits
>(
  'zw-textarea',
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
      size: prop(['sm', 'md', 'lg'], {
        default: 'md',
        reflect: true,
      }),
      resize: prop(['none', 'vertical', 'horizontal', 'both'], {
        default: 'vertical',
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
      rows: Number,
      cols: Number,
      minlength: prop(Number, {
        attr: 'minlength',
      }),
      maxlength: prop(Number, {
        attr: 'maxlength',
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
      description: 'Headless textarea primitive.',
    },
  },
  setup,
)
```

---

## `packages/primitives/radio-group/src/index.ts`

```ts
export * from './radio-group'
```

## `packages/primitives/radio-group/src/radio-group.tsx`

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

export type RadioGroupOrientation = 'horizontal' | 'vertical'
export type RadioGroupSize = 'sm' | 'md' | 'lg'

export interface RadioGroupProps {
  value?: string
  defaultValue?: string
  name?: string
  orientation?: RadioGroupOrientation
  size?: RadioGroupSize
  disabled?: boolean
  required?: boolean
  invalid?: boolean
  ariaLabel?: string
  ariaDescribedby?: string
}

export interface RadioGroupValueChangeDetail {
  value: string
  nativeEvent: Event
}

export interface RadioGroupElement extends HTMLElement {
  value?: string
}

interface RadioGroupEmits extends Record<string, EventDefinition<unknown>> {
  valueChange: EventDefinition<RadioGroupValueChangeDetail>
}

interface RadioGroupContextValue {
  getName: () => string
  getValue: () => string | undefined
  setValue: (value: string, nativeEvent?: Event) => void
  isDisabled: () => boolean
  isRequired: () => boolean
  isInvalid: () => boolean
  getSize: () => RadioGroupSize
}

const RadioGroupContext = createContext<RadioGroupContextValue>()

let radioGroupId = 0

function createRadioName(): string {
  radioGroupId += 1
  return `zw-radio-group-${radioGroupId}`
}

function resolveValue(props: RadioGroupProps): string | undefined {
  if (props.value !== undefined) return props.value
  if (props.defaultValue !== undefined) return props.defaultValue
  return undefined
}

function setupRadioGroup(
  props: RadioGroupProps,
  ctx: DefineElementContext<RadioGroupElement, RadioGroupEmits>,
) {
  const fallbackName = createRadioName()

  const context: RadioGroupContextValue = {
    getName: () => props.name || fallbackName,
    getValue: () => resolveValue(props),
    setValue: (value, nativeEvent) => {
      ctx.host.value = value
      ctx.emit.valueChange({
        value,
        nativeEvent: nativeEvent ?? new Event('change'),
      })
    },
    isDisabled: () => Boolean(props.disabled),
    isRequired: () => Boolean(props.required),
    isInvalid: () => Boolean(props.invalid),
    getSize: () => props.size || 'md',
  }

  provide(RadioGroupContext, context)

  return (
    <Host
      data-slot="radio-group-root"
      role="radiogroup"
      data-orientation={() => props.orientation || 'vertical'}
      data-size={() => context.getSize()}
      data-disabled={() => (props.disabled ? '' : undefined)}
      data-invalid={() => (props.invalid ? '' : undefined)}
      aria-label={() => props.ariaLabel}
      aria-describedby={() => props.ariaDescribedby}
      aria-required={() => (props.required ? 'true' : undefined)}
      aria-invalid={() => (props.invalid ? 'true' : undefined)}
    >
      <Slot />
    </Host>
  )
}

export const RadioGroup = defineElement<
  RadioGroupProps,
  RadioGroupElement,
  RadioGroupEmits
>(
  'zw-radio-group',
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
      name: String,
      orientation: prop(['horizontal', 'vertical'], {
        default: 'vertical',
        reflect: true,
      }),
      size: prop(['sm', 'md', 'lg'], {
        default: 'md',
        reflect: true,
      }),
      disabled: prop(Boolean),
      required: prop(Boolean),
      invalid: prop(Boolean),
      ariaLabel: prop(String, {
        attr: 'aria-label',
      }),
      ariaDescribedby: prop(String, {
        attr: 'aria-describedby',
      }),
    },
    emits: {
      valueChange: event<{ value: string; nativeEvent: Event }>(),
    },
    meta: {
      description: 'Headless radio group primitive.',
    },
  },
  setupRadioGroup,
)

export interface RadioGroupItemProps {
  value?: string
  disabled?: boolean
}

export interface RadioGroupItemElement extends HTMLElement {
  checked?: boolean
  focus: () => void
  blur: () => void
}

export interface RadioGroupItemFocusChangeDetail {
  focused: boolean
  nativeEvent: FocusEvent
}

interface RadioGroupItemEmits extends Record<string, EventDefinition<unknown>> {
  focusChange: EventDefinition<RadioGroupItemFocusChangeDetail>
}

function setupRadioGroupItem(
  props: RadioGroupItemProps,
  ctx: DefineElementContext<RadioGroupItemElement, RadioGroupItemEmits>,
) {
  const group = inject(RadioGroupContext)
  let control!: HTMLInputElement

  const isChecked = () =>
    Boolean(props.value && group?.getValue() === props.value)

  const isDisabled = () => Boolean(props.disabled || group?.isDisabled())

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
      data-slot="radio-group-item"
      data-value={() => props.value}
      data-state={() => (isChecked() ? 'checked' : 'unchecked')}
      data-disabled={() => (isDisabled() ? '' : undefined)}
    >
      <label part="root">
        <input
          ref={(element: HTMLInputElement | null) => {
            if (element) control = element
          }}
          part="control"
          data-slot="radio-group-control"
          prop:type={() => 'radio'}
          prop:checked={() => isChecked()}
          name={() => group?.getName()}
          value={() => props.value}
          disabled={() => isDisabled()}
          required={() => Boolean(group?.isRequired())}
          aria-checked={() => String(isChecked())}
          aria-invalid={() => (group?.isInvalid() ? 'true' : undefined)}
          onChange={nativeEvent => {
            if (props.value && !isDisabled()) {
              group?.setValue(props.value, nativeEvent)
            }
          }}
          onFocus={nativeEvent => {
            ctx.emit.focusChange({ focused: true, nativeEvent })
          }}
          onBlur={nativeEvent => {
            ctx.emit.focusChange({ focused: false, nativeEvent })
          }}
        />

        <span part="indicator" data-slot="radio-group-indicator">
          <Slot name="indicator" />
        </span>

        <span part="label" data-slot="radio-group-label">
          <Slot />
        </span>
      </label>
    </Host>
  )
}

export const RadioGroupItem = defineElement<
  RadioGroupItemProps,
  RadioGroupItemElement,
  RadioGroupItemEmits
>(
  'zw-radio-group-item',
  {
    shadow: false,
    props: {
      value: String,
      disabled: prop(Boolean),
    },
    emits: {
      focusChange: event<{
        focused: boolean
        nativeEvent: FocusEvent
      }>(),
    },
    meta: {
      description: 'Headless radio group item primitive.',
    },
  },
  setupRadioGroupItem,
)
```

---

## `packages/primitives/select/src/index.ts`

```ts
export * from './select'
```

## `packages/primitives/select/src/select.tsx`

```tsx
import type { DefineElementContext, EventDefinition } from '@zeus-js/zeus'
import { defineElement, event, Host, prop, Slot } from '@zeus-js/zeus'

export type SelectSize = 'sm' | 'md' | 'lg'

export interface SelectProps {
  id?: string
  value?: string
  defaultValue?: string
  size?: SelectSize
  disabled?: boolean
  required?: boolean
  invalid?: boolean
  multiple?: boolean
  name?: string
  ariaLabel?: string
  ariaDescribedby?: string
  ariaErrormessage?: string
}

export interface SelectValueChangeDetail {
  value: string
  values: string[]
  nativeEvent: Event
}

export interface SelectFocusChangeDetail {
  focused: boolean
  nativeEvent: FocusEvent
}

export interface SelectElement extends HTMLElement {
  value?: string
  focus: () => void
  blur: () => void
}

interface SelectEmits extends Record<string, EventDefinition<unknown>> {
  valueChange: EventDefinition<SelectValueChangeDetail>
  focusChange: EventDefinition<SelectFocusChangeDetail>
}

function resolveValue(props: SelectProps): string {
  if (props.value !== undefined) return props.value
  if (props.defaultValue !== undefined) return props.defaultValue
  return ''
}

function getSelectedValues(control: HTMLSelectElement): string[] {
  return Array.from(control.selectedOptions).map(option => option.value)
}

function setup(
  props: SelectProps,
  ctx: DefineElementContext<SelectElement, SelectEmits>,
) {
  let control!: HTMLSelectElement

  const handleChange = (nativeEvent: Event) => {
    const values = getSelectedValues(control)
    const value = control.value

    ctx.host.value = value
    ctx.emit.valueChange({ value, values, nativeEvent })
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
      data-slot="select-root"
      data-size={() => props.size}
      data-disabled={() => (props.disabled ? '' : undefined)}
      data-invalid={() => (props.invalid ? '' : undefined)}
    >
      <label part="root" for={() => props.id}>
        <select
          ref={(element: HTMLSelectElement | null) => {
            if (element) control = element
          }}
          id={() => props.id}
          part="control"
          data-slot="select"
          prop:value={() => resolveValue(props)}
          disabled={() => Boolean(props.disabled)}
          required={() => Boolean(props.required)}
          multiple={() => Boolean(props.multiple)}
          name={() => props.name}
          aria-label={() => props.ariaLabel}
          aria-describedby={() => props.ariaDescribedby}
          aria-errormessage={() => props.ariaErrormessage}
          aria-invalid={() => (props.invalid ? 'true' : undefined)}
          onChange={handleChange}
          onFocus={nativeEvent => {
            ctx.emit.focusChange({ focused: true, nativeEvent })
          }}
          onBlur={nativeEvent => {
            ctx.emit.focusChange({ focused: false, nativeEvent })
          }}
        >
          <Slot />
        </select>
      </label>

      <div part="message" data-slot="select-message">
        <Slot name="message" />
      </div>
    </Host>
  )
}

export const Select = defineElement<SelectProps, SelectElement, SelectEmits>(
  'zw-select',
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
      size: prop(['sm', 'md', 'lg'], {
        default: 'md',
        reflect: true,
      }),
      disabled: prop(Boolean),
      required: prop(Boolean),
      invalid: prop(Boolean),
      multiple: prop(Boolean),
      name: String,
      ariaLabel: prop(String, {
        attr: 'aria-label',
      }),
      ariaDescribedby: prop(String, {
        attr: 'aria-describedby',
      }),
      ariaErrormessage: prop(String, {
        attr: 'aria-errormessage',
      }),
    },
    emits: {
      valueChange: event<{
        value: string
        values: string[]
        nativeEvent: Event
      }>(),
      focusChange: event<{
        focused: boolean
        nativeEvent: FocusEvent
      }>(),
    },
    meta: {
      description: 'Headless native select primitive.',
    },
  },
  setup,
)
```

---

## `packages/primitives/card/src/index.ts`

```ts
export * from './card'
```

## `packages/primitives/card/src/card.tsx`

```tsx
import { defineElement, Host, Slot } from '@zeus-js/zeus'

export interface CardElement extends HTMLElement {}

export const Card = defineElement<object, CardElement>(
  'zw-card',
  {
    shadow: false,
    meta: {
      description: 'Headless card root primitive.',
    },
  },
  () => (
    <Host part="root" data-slot="card-root">
      <Slot />
    </Host>
  ),
)

export const CardHeader = defineElement<object, HTMLElement>(
  'zw-card-header',
  {
    shadow: false,
    meta: {
      description: 'Headless card header primitive.',
    },
  },
  () => (
    <Host part="header" data-slot="card-header">
      <Slot />
    </Host>
  ),
)

export const CardTitle = defineElement<object, HTMLElement>(
  'zw-card-title',
  {
    shadow: false,
    meta: {
      description: 'Headless card title primitive.',
    },
  },
  () => (
    <Host part="title" data-slot="card-title">
      <Slot />
    </Host>
  ),
)

export const CardDescription = defineElement<object, HTMLElement>(
  'zw-card-description',
  {
    shadow: false,
    meta: {
      description: 'Headless card description primitive.',
    },
  },
  () => (
    <Host part="description" data-slot="card-description">
      <Slot />
    </Host>
  ),
)

export const CardContent = defineElement<object, HTMLElement>(
  'zw-card-content',
  {
    shadow: false,
    meta: {
      description: 'Headless card content primitive.',
    },
  },
  () => (
    <Host part="content" data-slot="card-content">
      <Slot />
    </Host>
  ),
)

export const CardFooter = defineElement<object, HTMLElement>(
  'zw-card-footer',
  {
    shadow: false,
    meta: {
      description: 'Headless card footer primitive.',
    },
  },
  () => (
    <Host part="footer" data-slot="card-footer">
      <Slot />
    </Host>
  ),
)
```

---

## `packages/primitives/badge/src/index.ts`

```ts
export * from './badge'
```

## `packages/primitives/badge/src/badge.tsx`

```tsx
import { defineElement, Host, prop, Slot } from '@zeus-js/zeus'

export type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'outline'
  | 'danger'
  | 'success'
  | 'warning'

export type BadgeSize = 'sm' | 'md' | 'lg'

export interface BadgeProps {
  variant?: BadgeVariant
  size?: BadgeSize
}

export interface BadgeElement extends HTMLElement {}

export const Badge = defineElement<BadgeProps, BadgeElement>(
  'zw-badge',
  {
    shadow: false,
    props: {
      variant: prop(
        ['default', 'secondary', 'outline', 'danger', 'success', 'warning'],
        {
          default: 'default',
          reflect: true,
        },
      ),
      size: prop(['sm', 'md', 'lg'], {
        default: 'md',
        reflect: true,
      }),
    },
    meta: {
      description: 'Headless badge primitive.',
    },
  },
  props => (
    <Host
      part="root"
      data-slot="badge-root"
      data-variant={() => props.variant}
      data-size={() => props.size}
    >
      <Slot />
    </Host>
  ),
)
```

---

## `packages/primitives/separator/src/index.ts`

```ts
export * from './separator'
```

## `packages/primitives/separator/src/separator.tsx`

```tsx
import { defineElement, Host, prop } from '@zeus-js/zeus'

export type SeparatorOrientation = 'horizontal' | 'vertical'

export interface SeparatorProps {
  orientation?: SeparatorOrientation
  decorative?: boolean
}

export interface SeparatorElement extends HTMLElement {}

export const Separator = defineElement<SeparatorProps, SeparatorElement>(
  'zw-separator',
  {
    shadow: false,
    props: {
      orientation: prop(['horizontal', 'vertical'], {
        default: 'horizontal',
        reflect: true,
      }),
      decorative: prop(Boolean, {
        default: true,
      }),
    },
    meta: {
      description: 'Headless separator primitive.',
    },
  },
  props => (
    <Host
      part="root"
      data-slot="separator-root"
      data-orientation={() => props.orientation}
      role={() => (props.decorative ? undefined : 'separator')}
      aria-orientation={() =>
        props.decorative ? undefined : props.orientation || 'horizontal'
      }
      aria-hidden={() => (props.decorative ? 'true' : undefined)}
    />
  ),
)
```

---

## `packages/primitives/skeleton/src/index.ts`

```ts
export * from './skeleton'
```

## `packages/primitives/skeleton/src/skeleton.tsx`

```tsx
import { defineElement, Host, prop } from '@zeus-js/zeus'

export type SkeletonVariant = 'text' | 'rect' | 'circle'

export interface SkeletonProps {
  variant?: SkeletonVariant
  animated?: boolean
}

export interface SkeletonElement extends HTMLElement {}

export const Skeleton = defineElement<SkeletonProps, SkeletonElement>(
  'zw-skeleton',
  {
    shadow: false,
    props: {
      variant: prop(['text', 'rect', 'circle'], {
        default: 'rect',
        reflect: true,
      }),
      animated: prop(Boolean, {
        default: true,
        reflect: true,
      }),
    },
    meta: {
      description: 'Headless skeleton primitive.',
    },
  },
  props => (
    <Host
      part="root"
      data-slot="skeleton-root"
      data-variant={() => props.variant}
      data-animated={() => (props.animated ? '' : undefined)}
      aria-hidden={() => 'true'}
    />
  ),
)
```

---

## `packages/primitives/alert/src/index.ts`

```ts
export * from './alert'
```

## `packages/primitives/alert/src/alert.tsx`

```tsx
import { defineElement, Host, prop, Slot } from '@zeus-js/zeus'

export type AlertVariant = 'default' | 'info' | 'success' | 'warning' | 'danger'

export interface AlertProps {
  variant?: AlertVariant
  live?: 'polite' | 'assertive' | 'off'
}

export interface AlertElement extends HTMLElement {}

export const Alert = defineElement<AlertProps, AlertElement>(
  'zw-alert',
  {
    shadow: false,
    props: {
      variant: prop(['default', 'info', 'success', 'warning', 'danger'], {
        default: 'default',
        reflect: true,
      }),
      live: prop(['polite', 'assertive', 'off'], {
        default: 'polite',
        reflect: true,
      }),
    },
    meta: {
      description: 'Headless alert primitive.',
    },
  },
  props => (
    <Host
      part="root"
      data-slot="alert-root"
      data-variant={() => props.variant}
      role={() => (props.live === 'assertive' ? 'alert' : 'status')}
      aria-live={() => props.live}
    >
      <Slot />
    </Host>
  ),
)

export const AlertTitle = defineElement<object, HTMLElement>(
  'zw-alert-title',
  {
    shadow: false,
    meta: {
      description: 'Headless alert title primitive.',
    },
  },
  () => (
    <Host part="title" data-slot="alert-title">
      <Slot />
    </Host>
  ),
)

export const AlertDescription = defineElement<object, HTMLElement>(
  'zw-alert-description',
  {
    shadow: false,
    meta: {
      description: 'Headless alert description primitive.',
    },
  },
  () => (
    <Host part="description" data-slot="alert-description">
      <Slot />
    </Host>
  ),
)
```

---

# 3. Registry styled source

## `packages/registry/default/label.tsx`

```tsx
import { Label as LabelPrimitive } from '@zeus-web/label/react'
import * as React from 'react'

import { cn } from '@/lib/utils'

export interface LabelProps extends React.ComponentPropsWithoutRef<
  typeof LabelPrimitive
> {}

export const Label = React.forwardRef<HTMLElement, LabelProps>(
  ({ className, ...props }, ref) => {
    return (
      <LabelPrimitive
        ref={ref}
        className={cn(
          'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
          '[&_[data-slot=label-required-indicator]]:ml-1 [&_[data-slot=label-required-indicator]]:text-destructive',
          className,
        )}
        {...props}
      />
    )
  },
)

Label.displayName = 'Label'
```

## `packages/registry/default/textarea.tsx`

```tsx
import { Textarea as TextareaPrimitive } from '@zeus-web/textarea/react'
import * as React from 'react'

import { cn } from '@/lib/utils'

export interface TextareaProps extends React.ComponentPropsWithoutRef<
  typeof TextareaPrimitive
> {}

export const Textarea = React.forwardRef<HTMLElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <TextareaPrimitive
        ref={ref}
        className={cn(
          'block w-full',
          '[&_[data-slot=textarea]]:min-h-20 [&_[data-slot=textarea]]:w-full [&_[data-slot=textarea]]:rounded-md',
          '[&_[data-slot=textarea]]:border [&_[data-slot=textarea]]:border-input',
          '[&_[data-slot=textarea]]:bg-background [&_[data-slot=textarea]]:px-3 [&_[data-slot=textarea]]:py-2',
          '[&_[data-slot=textarea]]:text-sm [&_[data-slot=textarea]]:shadow-sm',
          '[&_[data-slot=textarea]]:placeholder:text-muted-foreground',
          '[&_[data-slot=textarea]]:focus-visible:outline-none [&_[data-slot=textarea]]:focus-visible:ring-1 [&_[data-slot=textarea]]:focus-visible:ring-ring',
          '[&_[data-slot=textarea]]:disabled:cursor-not-allowed [&_[data-slot=textarea]]:disabled:opacity-50',
          className,
        )}
        {...props}
      />
    )
  },
)

Textarea.displayName = 'Textarea'
```

## `packages/registry/default/radio-group.tsx`

```tsx
import {
  RadioGroup as RadioGroupPrimitive,
  RadioGroupItem as RadioGroupItemPrimitive,
} from '@zeus-web/radio-group/react'
import * as React from 'react'

import { cn } from '@/lib/utils'

export interface RadioGroupProps extends React.ComponentPropsWithoutRef<
  typeof RadioGroupPrimitive
> {}

export const RadioGroup = React.forwardRef<HTMLElement, RadioGroupProps>(
  ({ className, ...props }, ref) => {
    return (
      <RadioGroupPrimitive
        ref={ref}
        className={cn(
          'grid gap-2',
          'data-[orientation=horizontal]:flex data-[orientation=horizontal]:flex-wrap',
          className,
        )}
        {...props}
      />
    )
  },
)

RadioGroup.displayName = 'RadioGroup'

export interface RadioGroupItemProps extends React.ComponentPropsWithoutRef<
  typeof RadioGroupItemPrimitive
> {}

export const RadioGroupItem = React.forwardRef<
  HTMLElement,
  RadioGroupItemProps
>(({ className, ...props }, ref) => {
  return (
    <RadioGroupItemPrimitive
      ref={ref}
      className={cn(
        'inline-flex items-center gap-2',
        '[&_[data-slot=radio-group-control]]:size-4',
        '[&_[data-slot=radio-group-control]]:rounded-full',
        '[&_[data-slot=radio-group-control]]:border [&_[data-slot=radio-group-control]]:border-primary',
        '[&_[data-slot=radio-group-control]]:text-primary',
        '[&_[data-slot=radio-group-control]]:focus-visible:outline-none [&_[data-slot=radio-group-control]]:focus-visible:ring-1 [&_[data-slot=radio-group-control]]:focus-visible:ring-ring',
        '[&_[data-slot=radio-group-label]]:text-sm',
        'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    />
  )
})

RadioGroupItem.displayName = 'RadioGroupItem'
```

## `packages/registry/default/select.tsx`

```tsx
import { Select as SelectPrimitive } from '@zeus-web/select/react'
import * as React from 'react'

import { cn } from '@/lib/utils'

export interface SelectProps extends React.ComponentPropsWithoutRef<
  typeof SelectPrimitive
> {}

export const Select = React.forwardRef<HTMLElement, SelectProps>(
  ({ className, ...props }, ref) => {
    return (
      <SelectPrimitive
        ref={ref}
        className={cn(
          'block w-full',
          '[&_[data-slot=select]]:h-9 [&_[data-slot=select]]:w-full',
          '[&_[data-slot=select]]:rounded-md [&_[data-slot=select]]:border [&_[data-slot=select]]:border-input',
          '[&_[data-slot=select]]:bg-background [&_[data-slot=select]]:px-3 [&_[data-slot=select]]:py-1',
          '[&_[data-slot=select]]:text-sm [&_[data-slot=select]]:shadow-sm',
          '[&_[data-slot=select]]:focus-visible:outline-none [&_[data-slot=select]]:focus-visible:ring-1 [&_[data-slot=select]]:focus-visible:ring-ring',
          '[&_[data-slot=select]]:disabled:cursor-not-allowed [&_[data-slot=select]]:disabled:opacity-50',
          className,
        )}
        {...props}
      />
    )
  },
)

Select.displayName = 'Select'
```

## `packages/registry/default/card.tsx`

```tsx
import {
  Card as CardPrimitive,
  CardContent as CardContentPrimitive,
  CardDescription as CardDescriptionPrimitive,
  CardFooter as CardFooterPrimitive,
  CardHeader as CardHeaderPrimitive,
  CardTitle as CardTitlePrimitive,
} from '@zeus-web/card/react'
import * as React from 'react'

import { cn } from '@/lib/utils'

export const Card = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<typeof CardPrimitive>
>(({ className, ...props }, ref) => (
  <CardPrimitive
    ref={ref}
    className={cn(
      'rounded-xl border bg-card text-card-foreground shadow',
      className,
    )}
    {...props}
  />
))

Card.displayName = 'Card'

export const CardHeader = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<typeof CardHeaderPrimitive>
>(({ className, ...props }, ref) => (
  <CardHeaderPrimitive
    ref={ref}
    className={cn('flex flex-col space-y-1.5 p-6', className)}
    {...props}
  />
))

CardHeader.displayName = 'CardHeader'

export const CardTitle = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<typeof CardTitlePrimitive>
>(({ className, ...props }, ref) => (
  <CardTitlePrimitive
    ref={ref}
    className={cn('font-semibold leading-none tracking-tight', className)}
    {...props}
  />
))

CardTitle.displayName = 'CardTitle'

export const CardDescription = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<typeof CardDescriptionPrimitive>
>(({ className, ...props }, ref) => (
  <CardDescriptionPrimitive
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
))

CardDescription.displayName = 'CardDescription'

export const CardContent = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<typeof CardContentPrimitive>
>(({ className, ...props }, ref) => (
  <CardContentPrimitive
    ref={ref}
    className={cn('p-6 pt-0', className)}
    {...props}
  />
))

CardContent.displayName = 'CardContent'

export const CardFooter = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<typeof CardFooterPrimitive>
>(({ className, ...props }, ref) => (
  <CardFooterPrimitive
    ref={ref}
    className={cn('flex items-center p-6 pt-0', className)}
    {...props}
  />
))

CardFooter.displayName = 'CardFooter'
```

## `packages/registry/default/badge.tsx`

```tsx
import type { VariantProps } from 'class-variance-authority'

import { Badge as BadgePrimitive } from '@zeus-web/badge/react'
import { cva } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        outline: 'text-foreground',
        danger:
          'border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80',
        success: 'border-transparent bg-emerald-600 text-white shadow',
        warning: 'border-transparent bg-amber-500 text-white shadow',
      },
      size: {
        sm: 'px-2 py-0 text-[11px]',
        md: 'px-2.5 py-0.5 text-xs',
        lg: 'px-3 py-1 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
)

export interface BadgeProps
  extends
    React.ComponentPropsWithoutRef<typeof BadgePrimitive>,
    VariantProps<typeof badgeVariants> {}

export const Badge = React.forwardRef<HTMLElement, BadgeProps>(
  ({ className, variant, size, ...props }, ref) => (
    <BadgePrimitive
      ref={ref}
      variant={variant ?? undefined}
      size={size ?? undefined}
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  ),
)

Badge.displayName = 'Badge'

export { badgeVariants }
```

## `packages/registry/default/separator.tsx`

```tsx
import { Separator as SeparatorPrimitive } from '@zeus-web/separator/react'
import * as React from 'react'

import { cn } from '@/lib/utils'

export interface SeparatorProps extends React.ComponentPropsWithoutRef<
  typeof SeparatorPrimitive
> {}

export const Separator = React.forwardRef<HTMLElement, SeparatorProps>(
  ({ className, orientation = 'horizontal', ...props }, ref) => (
    <SeparatorPrimitive
      ref={ref}
      orientation={orientation}
      className={cn(
        'shrink-0 bg-border',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
      {...props}
    />
  ),
)

Separator.displayName = 'Separator'
```

## `packages/registry/default/skeleton.tsx`

```tsx
import { Skeleton as SkeletonPrimitive } from '@zeus-web/skeleton/react'
import * as React from 'react'

import { cn } from '@/lib/utils'

export interface SkeletonProps extends React.ComponentPropsWithoutRef<
  typeof SkeletonPrimitive
> {}

export const Skeleton = React.forwardRef<HTMLElement, SkeletonProps>(
  ({ className, ...props }, ref) => (
    <SkeletonPrimitive
      ref={ref}
      className={cn(
        'block rounded-md bg-muted',
        'data-[animated]:animate-pulse',
        'data-[variant=circle]:rounded-full',
        'data-[variant=text]:h-4 data-[variant=text]:w-full',
        className,
      )}
      {...props}
    />
  ),
)

Skeleton.displayName = 'Skeleton'
```

## `packages/registry/default/alert.tsx`

```tsx
import type { VariantProps } from 'class-variance-authority'

import {
  Alert as AlertPrimitive,
  AlertDescription as AlertDescriptionPrimitive,
  AlertTitle as AlertTitlePrimitive,
} from '@zeus-web/alert/react'
import { cva } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/utils'

const alertVariants = cva('relative w-full rounded-lg border p-4 text-sm', {
  variants: {
    variant: {
      default: 'bg-background text-foreground',
      info: 'border-sky-200 bg-sky-50 text-sky-950',
      success: 'border-emerald-200 bg-emerald-50 text-emerald-950',
      warning: 'border-amber-200 bg-amber-50 text-amber-950',
      danger: 'border-destructive/50 text-destructive dark:border-destructive',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

export interface AlertProps
  extends
    React.ComponentPropsWithoutRef<typeof AlertPrimitive>,
    VariantProps<typeof alertVariants> {}

export const Alert = React.forwardRef<HTMLElement, AlertProps>(
  ({ className, variant, ...props }, ref) => (
    <AlertPrimitive
      ref={ref}
      variant={variant ?? undefined}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  ),
)

Alert.displayName = 'Alert'

export const AlertTitle = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<typeof AlertTitlePrimitive>
>(({ className, ...props }, ref) => (
  <AlertTitlePrimitive
    ref={ref}
    className={cn('mb-1 font-medium leading-none tracking-tight', className)}
    {...props}
  />
))

AlertTitle.displayName = 'AlertTitle'

export const AlertDescription = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<typeof AlertDescriptionPrimitive>
>(({ className, ...props }, ref) => (
  <AlertDescriptionPrimitive
    ref={ref}
    className={cn('text-sm [&_p]:leading-relaxed', className)}
    {...props}
  />
))

AlertDescription.displayName = 'AlertDescription'

export { alertVariants }
```

---

# 4. 替换 `packages/registry/registry.json`

```json
{
  "$schema": "https://zeus-web.dev/schema/registry.json",
  "name": "@zeus-web/registry",
  "homepage": "https://zeus-web.dev",
  "items": [
    {
      "name": "input",
      "type": "registry:ui",
      "description": "Text input styled component.",
      "dependencies": [
        "@zeus-web/input",
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
          "path": "default/input.tsx",
          "target": "components/ui/input.tsx",
          "type": "registry:ui"
        }
      ]
    },
    {
      "name": "button",
      "type": "registry:ui",
      "description": "Button styled component.",
      "dependencies": [
        "@zeus-web/button",
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
          "path": "default/button.tsx",
          "target": "components/ui/button.tsx",
          "type": "registry:ui"
        }
      ]
    },
    {
      "name": "checkbox",
      "type": "registry:ui",
      "description": "Checkbox styled component.",
      "dependencies": [
        "@zeus-web/checkbox",
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
          "path": "default/checkbox.tsx",
          "target": "components/ui/checkbox.tsx",
          "type": "registry:ui"
        }
      ]
    },
    {
      "name": "switch",
      "type": "registry:ui",
      "description": "Switch styled component.",
      "dependencies": [
        "@zeus-web/switch",
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
          "path": "default/switch.tsx",
          "target": "components/ui/switch.tsx",
          "type": "registry:ui"
        }
      ]
    },
    {
      "name": "tabs",
      "type": "registry:ui",
      "description": "Tabs styled component.",
      "dependencies": [
        "@zeus-web/tabs",
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
          "path": "default/tabs.tsx",
          "target": "components/ui/tabs.tsx",
          "type": "registry:ui"
        }
      ]
    },
    {
      "name": "dialog",
      "type": "registry:ui",
      "description": "Dialog styled component.",
      "dependencies": [
        "@zeus-web/dialog",
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
          "path": "default/dialog.tsx",
          "target": "components/ui/dialog.tsx",
          "type": "registry:ui"
        }
      ]
    },

    {
      "name": "label",
      "type": "registry:ui",
      "description": "Label styled component.",
      "dependencies": [
        "@zeus-web/label",
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
          "path": "default/label.tsx",
          "target": "components/ui/label.tsx",
          "type": "registry:ui"
        }
      ]
    },
    {
      "name": "textarea",
      "type": "registry:ui",
      "description": "Textarea styled component.",
      "dependencies": [
        "@zeus-web/textarea",
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
          "path": "default/textarea.tsx",
          "target": "components/ui/textarea.tsx",
          "type": "registry:ui"
        }
      ]
    },
    {
      "name": "radio-group",
      "type": "registry:ui",
      "description": "Radio group styled component.",
      "dependencies": [
        "@zeus-web/radio-group",
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
          "path": "default/radio-group.tsx",
          "target": "components/ui/radio-group.tsx",
          "type": "registry:ui"
        }
      ]
    },
    {
      "name": "select",
      "type": "registry:ui",
      "description": "Native select styled component.",
      "dependencies": [
        "@zeus-web/select",
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
          "path": "default/select.tsx",
          "target": "components/ui/select.tsx",
          "type": "registry:ui"
        }
      ]
    },
    {
      "name": "card",
      "type": "registry:ui",
      "description": "Card styled component.",
      "dependencies": [
        "@zeus-web/card",
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
          "path": "default/card.tsx",
          "target": "components/ui/card.tsx",
          "type": "registry:ui"
        }
      ]
    },
    {
      "name": "badge",
      "type": "registry:ui",
      "description": "Badge styled component.",
      "dependencies": [
        "@zeus-web/badge",
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
          "path": "default/badge.tsx",
          "target": "components/ui/badge.tsx",
          "type": "registry:ui"
        }
      ]
    },
    {
      "name": "separator",
      "type": "registry:ui",
      "description": "Separator styled component.",
      "dependencies": [
        "@zeus-web/separator",
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
          "path": "default/separator.tsx",
          "target": "components/ui/separator.tsx",
          "type": "registry:ui"
        }
      ]
    },
    {
      "name": "skeleton",
      "type": "registry:ui",
      "description": "Skeleton styled component.",
      "dependencies": [
        "@zeus-web/skeleton",
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
          "path": "default/skeleton.tsx",
          "target": "components/ui/skeleton.tsx",
          "type": "registry:ui"
        }
      ]
    },
    {
      "name": "alert",
      "type": "registry:ui",
      "description": "Alert styled component.",
      "dependencies": [
        "@zeus-web/alert",
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
          "path": "default/alert.tsx",
          "target": "components/ui/alert.tsx",
          "type": "registry:ui"
        }
      ]
    }
  ]
}
```

---

# 5. AI metadata 增量

在 `packages/ai/src/metadata.ts` 的 `components` 末尾追加这些对象。为了篇幅可控，这里给出结构化版本；字段完整覆盖 generator 需要的内容。

```ts
const phase11Components = [
  {
    name: 'label',
    description: 'Styled label component built on the zw-label primitive.',
    primitivePackage: '@zeus-web/label',
    registryCommand: 'zweb add label',
    installCommand:
      'pnpm add @zeus-web/label class-variance-authority clsx tailwind-merge',
    reactImport: "import { Label } from '@zeus-web/label/react'",
    webComponentImport: "import '@zeus-web/label/wc'",
    styledImport: "import { Label } from '@/components/ui/label'",
    sourceTarget: 'components/ui/label.tsx',
    dependencies: ['@zeus-web/label', ...sharedDependencies],
    props: [
      {
        name: 'for',
        type: 'string',
        description: 'ID of the associated form control.',
      },
      {
        name: 'required',
        type: 'boolean',
        description: 'Shows a required indicator.',
      },
      {
        name: 'disabled',
        type: 'boolean',
        description: 'Marks the label as disabled.',
      },
      {
        name: 'visuallyHidden',
        type: 'boolean',
        description: 'Visually hides the label while keeping it accessible.',
      },
    ],
    events: [],
    slots: [{ name: 'default', description: 'Label content.' }],
    examples: [
      {
        title: 'React styled usage',
        code: [
          "import { Label } from '@/components/ui/label'",
          '',
          'export function Example() {',
          '  return <Label for="email">Email</Label>',
          '}',
        ].join('\n'),
      },
    ],
    styling: {
      usesTailwind: true,
      themeTokens: ['text-foreground', 'text-destructive'],
      internalSelectors: [
        '[data-slot=label]',
        '[data-slot=label-required-indicator]',
      ],
    },
    aiRules: {
      do: [
        'Use Label with form controls.',
        'Use for to associate labels with control ids.',
      ],
      dont: ['Do not use Label as a generic text wrapper.'],
    },
  },
  {
    name: 'textarea',
    description:
      'Styled textarea component built on the zw-textarea primitive.',
    primitivePackage: '@zeus-web/textarea',
    registryCommand: 'zweb add textarea',
    installCommand:
      'pnpm add @zeus-web/textarea class-variance-authority clsx tailwind-merge',
    reactImport: "import { Textarea } from '@zeus-web/textarea/react'",
    webComponentImport: "import '@zeus-web/textarea/wc'",
    styledImport: "import { Textarea } from '@/components/ui/textarea'",
    sourceTarget: 'components/ui/textarea.tsx',
    dependencies: ['@zeus-web/textarea', ...sharedDependencies],
    props: [
      {
        name: 'value',
        type: 'string',
        description: 'Controlled textarea value.',
      },
      {
        name: 'defaultValue',
        type: 'string',
        description: 'Initial uncontrolled value.',
      },
      { name: 'placeholder', type: 'string', description: 'Placeholder text.' },
      { name: 'rows', type: 'number', description: 'Native rows attribute.' },
      {
        name: 'disabled',
        type: 'boolean',
        description: 'Disables user interaction.',
      },
      {
        name: 'ariaLabel',
        type: 'string',
        description: 'Accessible label for unlabeled textareas.',
      },
      {
        name: 'ariaDescribedby',
        type: 'string',
        description: 'ID reference for additional accessible description.',
      },
      {
        name: 'ariaErrormessage',
        type: 'string',
        description: 'ID reference for accessible error message.',
      },
    ],
    events: [
      {
        name: 'value-change',
        reactName: 'onValueChange',
        description: 'Emitted when the textarea value changes.',
        detail: { value: 'string', nativeEvent: 'Event' },
      },
      {
        name: 'focus-change',
        reactName: 'onFocusChange',
        description: 'Emitted when focus state changes.',
        detail: { focused: 'boolean', nativeEvent: 'FocusEvent' },
      },
    ],
    slots: [{ name: 'message', description: 'Validation or help message.' }],
    examples: [
      {
        title: 'React styled usage',
        code: [
          "import { Textarea } from '@/components/ui/textarea'",
          '',
          'export function Example() {',
          '  return <Textarea placeholder="Message" />',
          '}',
        ].join('\n'),
      },
    ],
    styling: {
      usesTailwind: true,
      themeTokens: ['border-input', 'ring-ring', 'text-muted-foreground'],
      internalSelectors: [
        '[data-slot=textarea]',
        '[data-slot=textarea-message]',
      ],
    },
    aiRules: {
      do: ['Use Textarea for multi-line text input.'],
      dont: ['Do not use Input for multi-line content.'],
    },
  },
  {
    name: 'radio-group',
    description:
      'Styled radio group component built on zw-radio-group primitives.',
    primitivePackage: '@zeus-web/radio-group',
    registryCommand: 'zweb add radio-group',
    installCommand:
      'pnpm add @zeus-web/radio-group class-variance-authority clsx tailwind-merge',
    reactImport:
      "import { RadioGroup, RadioGroupItem } from '@zeus-web/radio-group/react'",
    webComponentImport: "import '@zeus-web/radio-group/wc'",
    styledImport:
      "import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'",
    sourceTarget: 'components/ui/radio-group.tsx',
    dependencies: ['@zeus-web/radio-group', ...sharedDependencies],
    props: [
      {
        name: 'value',
        type: 'string',
        description: 'Controlled selected value.',
      },
      {
        name: 'defaultValue',
        type: 'string',
        description: 'Initial selected value.',
      },
      { name: 'name', type: 'string', description: 'Native radio group name.' },
      {
        name: 'orientation',
        type: 'RadioGroupOrientation',
        description: 'Layout orientation.',
        values: ['horizontal', 'vertical'],
        default: 'vertical',
      },
      {
        name: 'required',
        type: 'boolean',
        description: 'Marks the group as required.',
      },
    ],
    events: [
      {
        name: 'value-change',
        reactName: 'onValueChange',
        description: 'Emitted when selected value changes.',
        detail: { value: 'string', nativeEvent: 'Event' },
      },
    ],
    slots: [{ name: 'default', description: 'RadioGroupItem children.' }],
    examples: [
      {
        title: 'React styled usage',
        code: [
          "import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'",
          '',
          'export function Example() {',
          '  return (',
          '    <RadioGroup defaultValue="email">',
          '      <RadioGroupItem value="email">Email</RadioGroupItem>',
          '      <RadioGroupItem value="sms">SMS</RadioGroupItem>',
          '    </RadioGroup>',
          '  )',
          '}',
        ].join('\n'),
      },
    ],
    styling: {
      usesTailwind: true,
      themeTokens: ['text-primary', 'ring-ring'],
      internalSelectors: [
        '[data-slot=radio-group-control]',
        '[data-slot=radio-group-label]',
      ],
    },
    aiRules: {
      do: [
        'Use RadioGroup for one-of-many choices.',
        'Keep RadioGroupItem values unique.',
      ],
      dont: ['Do not use Checkbox when only one option can be selected.'],
    },
  },
  {
    name: 'select',
    description:
      'Styled native select component built on the zw-select primitive.',
    primitivePackage: '@zeus-web/select',
    registryCommand: 'zweb add select',
    installCommand:
      'pnpm add @zeus-web/select class-variance-authority clsx tailwind-merge',
    reactImport: "import { Select } from '@zeus-web/select/react'",
    webComponentImport: "import '@zeus-web/select/wc'",
    styledImport: "import { Select } from '@/components/ui/select'",
    sourceTarget: 'components/ui/select.tsx',
    dependencies: ['@zeus-web/select', ...sharedDependencies],
    props: [
      {
        name: 'value',
        type: 'string',
        description: 'Controlled selected value.',
      },
      {
        name: 'defaultValue',
        type: 'string',
        description: 'Initial selected value.',
      },
      {
        name: 'multiple',
        type: 'boolean',
        description: 'Enables multiple selection.',
      },
      {
        name: 'disabled',
        type: 'boolean',
        description: 'Disables user interaction.',
      },
      {
        name: 'ariaLabel',
        type: 'string',
        description: 'Accessible label for unlabeled selects.',
      },
    ],
    events: [
      {
        name: 'value-change',
        reactName: 'onValueChange',
        description: 'Emitted when selected value changes.',
        detail: { value: 'string', values: 'string[]', nativeEvent: 'Event' },
      },
    ],
    slots: [{ name: 'default', description: 'Native option children.' }],
    examples: [
      {
        title: 'React styled usage',
        code: [
          "import { Select } from '@/components/ui/select'",
          '',
          'export function Example() {',
          '  return (',
          '    <Select defaultValue="apple">',
          '      <option value="apple">Apple</option>',
          '      <option value="orange">Orange</option>',
          '    </Select>',
          '  )',
          '}',
        ].join('\n'),
      },
    ],
    styling: {
      usesTailwind: true,
      themeTokens: ['border-input', 'ring-ring'],
      internalSelectors: ['[data-slot=select]', '[data-slot=select-message]'],
    },
    aiRules: {
      do: ['Use Select for simple native option lists.'],
      dont: ['Do not use Select for combobox/typeahead behavior yet.'],
    },
  },
] satisfies ZeusWebAiMetadata['components']
```

然后把原来的：

```ts
components: [
  // existing six components
],
```

改成：

```ts
components: [
  // existing six components
  ...phase11Components,
],
```

同时 `validate.ts` 的 required list 要加上：

```ts
const requiredComponents: ZeusWebAiComponentName[] = [
  'input',
  'button',
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
]
```

> `card / badge / separator / skeleton / alert` 的 metadata 也按上面同样结构追加；它们是展示类，`events` 通常为空，`slots` 以 `default` 和子 primitive 为主。

---

# 6. Phase 11 contract 测试

## `packages/primitives/__tests__/phase11-contract.spec.ts`

```ts
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const workspaceRoot = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../../..')

const phase11Primitives = [
  'label',
  'textarea',
  'radio-group',
  'select',
  'card',
  'badge',
  'separator',
  'skeleton',
  'alert',
]

function readFile(path: string): string {
  return readFileSync(resolve(workspaceRoot, path), 'utf-8')
}

describe('phase 11 primitive contract', () => {
  it('adds all phase 11 primitive packages', () => {
    for (const name of phase11Primitives) {
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

  it('uses zeus defineElement for all phase 11 primitives', () => {
    for (const name of phase11Primitives) {
      const source = readFile(`packages/primitives/${name}/src/${name}.tsx`)

      expect(source).toContain('defineElement')
      expect(source).toContain('shadow: false')
    }
  })

  it('adds a11y props to form primitives', () => {
    for (const name of ['textarea', 'radio-group', 'select']) {
      const source = readFile(`packages/primitives/${name}/src/${name}.tsx`)

      expect(source).toContain('ariaLabel')
      expect(source).toContain('ariaDescribedby')
      expect(source).toContain("attr: 'aria-label'")
      expect(source).toContain("attr: 'aria-describedby'")
    }
  })

  it('keeps display primitives low-interaction', () => {
    for (const name of ['card', 'badge', 'separator', 'skeleton', 'alert']) {
      const source = readFile(`packages/primitives/${name}/src/${name}.tsx`)

      expect(source).not.toContain('createContext')
      expect(source).not.toContain('document.addEventListener')
    }
  })
})
```

## `packages/registry/__tests__/phase11-registry.spec.ts`

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import type { Registry } from '../src'
import { validateRegistry } from '../src'

const phase11Items = [
  'label',
  'textarea',
  'radio-group',
  'select',
  'card',
  'badge',
  'separator',
  'skeleton',
  'alert',
]

describe('phase 11 registry contract', () => {
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

  it('registers all phase 11 items', () => {
    for (const name of phase11Items) {
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

---

# 7. Docs / examples 更新

Phase 11 做完后执行：

```bash
pnpm docs:generate
```

这会生成：

```txt
apps/docs/components/label.md
apps/docs/components/textarea.md
apps/docs/components/radio-group.md
apps/docs/components/select.md
apps/docs/components/card.md
apps/docs/components/badge.md
apps/docs/components/separator.md
apps/docs/components/skeleton.md
apps/docs/components/alert.md
```

还要更新：

## `apps/docs/.vitepress/data/site.ts`

在 `componentDocs` 里追加：

```ts
{
  name: 'label',
  title: 'Label',
  packageName: '@zeus-web/label',
  addCommand: 'zweb add label',
  route: '/components/label',
  description: 'Form label component built on the zw-label primitive.',
},
{
  name: 'textarea',
  title: 'Textarea',
  packageName: '@zeus-web/textarea',
  addCommand: 'zweb add textarea',
  route: '/components/textarea',
  description: 'Textarea component built on the zw-textarea primitive.',
},
{
  name: 'radio-group',
  title: 'Radio Group',
  packageName: '@zeus-web/radio-group',
  addCommand: 'zweb add radio-group',
  route: '/components/radio-group',
  description: 'Radio group component built on zw-radio-group primitives.',
},
{
  name: 'select',
  title: 'Select',
  packageName: '@zeus-web/select',
  addCommand: 'zweb add select',
  route: '/components/select',
  description: 'Native select component built on the zw-select primitive.',
},
{
  name: 'card',
  title: 'Card',
  packageName: '@zeus-web/card',
  addCommand: 'zweb add card',
  route: '/components/card',
  description: 'Card component family built on zw-card primitives.',
},
{
  name: 'badge',
  title: 'Badge',
  packageName: '@zeus-web/badge',
  addCommand: 'zweb add badge',
  route: '/components/badge',
  description: 'Badge component built on the zw-badge primitive.',
},
{
  name: 'separator',
  title: 'Separator',
  packageName: '@zeus-web/separator',
  addCommand: 'zweb add separator',
  route: '/components/separator',
  description: 'Separator component built on the zw-separator primitive.',
},
{
  name: 'skeleton',
  title: 'Skeleton',
  packageName: '@zeus-web/skeleton',
  addCommand: 'zweb add skeleton',
  route: '/components/skeleton',
  description: 'Skeleton component built on the zw-skeleton primitive.',
},
{
  name: 'alert',
  title: 'Alert',
  packageName: '@zeus-web/alert',
  addCommand: 'zweb add alert',
  route: '/components/alert',
  description: 'Alert component family built on zw-alert primitives.',
},
```

---

# 8. Phase 11 验收命令

```bash
pnpm --filter @zeus-web/label check
pnpm --filter @zeus-web/textarea check
pnpm --filter @zeus-web/radio-group check
pnpm --filter @zeus-web/select check
pnpm --filter @zeus-web/card check
pnpm --filter @zeus-web/badge check
pnpm --filter @zeus-web/separator check
pnpm --filter @zeus-web/skeleton check
pnpm --filter @zeus-web/alert check

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
feat(primitives): add phase 11 form and display primitives
feat(registry): add phase 11 styled components
feat(ai): add phase 11 component metadata
test(primitives): add phase 11 primitive contract
test(registry): add phase 11 registry contract
docs: refresh generated component docs
```

Phase 11 合并后，组件库从 MVP 的 6 个组件扩展到 15 个组件，基本覆盖表单基础件和展示基础件。下一阶段再做 `accordion / collapsible / tooltip / popover / dropdown-menu / toast` 会更稳。
