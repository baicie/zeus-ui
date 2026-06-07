下面给的是 **Phase 3 最终版设计 + 可直接覆盖/新增的完整代码**。
基于当前 `mvp` 分支，`input` 已经是正确模板：源码使用 `@zeus-js/zeus` 的 `defineElement / Host / Slot / prop / event`，并且通过共享 `rolldown.config.ts` 接入 `@zeus-js/bundler-plugin/rolldown + output-wc/react/vue`。

# Phase 3 目标

```txt
Phase 3：Headless Primitives MVP

新增/完善：
- @zeus-web/button
- @zeus-web/checkbox
- @zeus-web/switch
- @zeus-web/tabs
- @zeus-web/dialog

同时完善：
- @zeus-web/headless 聚合 WC 注册入口
- @zeus-web/react 聚合 React wrappers
- @zeus-web/vue 聚合 Vue wrappers
- 每个 primitive 都有 analyzer 测试
```

这阶段不做 styled registry、不做 Tailwind 主题，只做 **headless primitives + 多端输出产物**。

---

# 1. Primitive 包标准

每个 primitive 包结构统一：

```txt
packages/primitives/<name>/
  package.json
  tsconfig.json
  src/
    index.ts
    <name>.tsx
  __tests__/
    <name>.spec.ts
```

`package.json` 统一使用这个模板，以 `button` 为例：

```json
{
  "name": "@zeus-web/button",
  "type": "module",
  "version": "0.0.0",
  "description": "Headless button primitive for Zeus Web.",
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
    "test": "vitest --root ../../.. --project unit packages/primitives/button/__tests__/button.spec.ts"
  },
  "peerDependencies": {
    "@zeus-js/zeus": ">=0.1.0-beta.4 <0.2.0",
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
    "@zeus-js/runtime-dom": "0.1.0-beta.4",
    "@zeus-js/web-c-runtime": "0.2.0",
    "@zeus-web/zeus-compat": "workspace:*"
  }
}
```

其他包替换：

```txt
@zeus-web/button → @zeus-web/checkbox / switch / tabs / dialog
button.spec.ts   → checkbox.spec.ts / switch.spec.ts / tabs.spec.ts / dialog.spec.ts
```

`tsconfig.json` 全部一致：

```json
{
  "extends": "../../../scripts/tsconfig.base.json",
  "compilerOptions": {
    "composite": false,
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"]
}
```

---

# 2. `@zeus-web/button`

## `packages/primitives/button/src/index.ts`

```ts
export {
  Button,
  type ButtonElement,
  type ButtonPressDetail,
  type ButtonProps,
  type ButtonSize,
  type ButtonType,
  type ButtonVariant,
} from './button'
```

## `packages/primitives/button/src/button.tsx`

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
        aria-disabled={() => (isDisabled() ? 'true' : undefined)}
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

## `packages/primitives/button/__tests__/button.spec.ts`

```ts
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { analyzeFile } from '@zeus-js/component-analyzer'
import { describe, expect, it } from 'vitest'

const workspaceRoot = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../../..')

const source = readFileSync(
  resolve(workspaceRoot, 'packages/primitives/button/src/button.tsx'),
  'utf-8',
)

describe('button primitive protocol', () => {
  it('infers props, events, methods, slots, and css parts from source', () => {
    const result = analyzeFile({
      file: 'packages/primitives/button/src/button.tsx',
      code: source,
    })

    expect(result.diagnostics).toEqual([])
    expect(result.components).toHaveLength(1)

    expect(result.components[0]).toMatchObject({
      tag: 'zw-button',
      props: {
        disabled: {
          type: 'boolean',
          default: false,
          reflect: true,
        },
        loading: {
          type: 'boolean',
          default: false,
          reflect: true,
        },
        variant: {
          type: 'string',
          values: [
            'default',
            'primary',
            'secondary',
            'outline',
            'ghost',
            'danger',
          ],
          default: 'default',
          reflect: true,
        },
        size: {
          type: 'string',
          values: ['sm', 'md', 'lg', 'icon'],
          default: 'md',
          reflect: true,
        },
      },
      events: {
        press: {
          name: 'press',
          reactName: 'onPress',
          detail: {
            nativeEvent: 'MouseEvent',
          },
        },
      },
      methods: {
        focus: {
          name: 'focus',
          returns: 'void',
        },
        blur: {
          name: 'blur',
          returns: 'void',
        },
        click: {
          name: 'click',
          returns: 'void',
        },
      },
      slots: {
        default: {
          name: 'default',
        },
        prefix: {
          name: 'prefix',
        },
        suffix: {
          name: 'suffix',
        },
      },
      cssParts: ['button', 'label', 'prefix', 'suffix'],
    })
  })
})
```

---

# 3. `@zeus-web/checkbox`

## `packages/primitives/checkbox/src/index.ts`

```ts
export {
  Checkbox,
  type CheckboxCheckedChangeDetail,
  type CheckboxElement,
  type CheckboxFocusChangeDetail,
  type CheckboxProps,
  type CheckboxSize,
} from './checkbox'
```

## `packages/primitives/checkbox/src/checkbox.tsx`

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

## `packages/primitives/checkbox/__tests__/checkbox.spec.ts`

```ts
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { analyzeFile } from '@zeus-js/component-analyzer'
import { describe, expect, it } from 'vitest'

const workspaceRoot = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../../..')

const source = readFileSync(
  resolve(workspaceRoot, 'packages/primitives/checkbox/src/checkbox.tsx'),
  'utf-8',
)

describe('checkbox primitive protocol', () => {
  it('infers props, events, models, methods, slots, and css parts from source', () => {
    const result = analyzeFile({
      file: 'packages/primitives/checkbox/src/checkbox.tsx',
      code: source,
    })

    expect(result.diagnostics).toEqual([])
    expect(result.components).toHaveLength(1)

    expect(result.components[0]).toMatchObject({
      tag: 'zw-checkbox',
      props: {
        checked: {
          type: 'boolean',
          default: false,
          reflect: true,
        },
        indeterminate: {
          type: 'boolean',
          default: false,
          reflect: true,
        },
        size: {
          type: 'string',
          values: ['sm', 'md', 'lg'],
          default: 'md',
          reflect: true,
        },
      },
      events: {
        checkedChange: {
          name: 'checked-change',
          reactName: 'onCheckedChange',
          detail: {
            checked: 'boolean',
            nativeEvent: 'Event',
          },
        },
        focusChange: {
          name: 'focus-change',
          reactName: 'onFocusChange',
          detail: {
            focused: 'boolean',
            nativeEvent: 'FocusEvent',
          },
        },
      },
      models: [
        {
          prop: 'checked',
          event: 'checked-change',
          eventPath: 'detail.checked',
        },
      ],
      methods: {
        focus: {
          name: 'focus',
          returns: 'void',
        },
        blur: {
          name: 'blur',
          returns: 'void',
        },
      },
      slots: {
        default: {
          name: 'default',
        },
        indicator: {
          name: 'indicator',
        },
      },
      cssParts: ['control', 'indicator', 'label', 'root'],
    })
  })
})
```

---

# 4. `@zeus-web/switch`

## `packages/primitives/switch/src/index.ts`

```ts
export {
  Switch,
  type SwitchCheckedChangeDetail,
  type SwitchElement,
  type SwitchFocusChangeDetail,
  type SwitchProps,
  type SwitchSize,
} from './switch'
```

## `packages/primitives/switch/src/switch.tsx`

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

## `packages/primitives/switch/__tests__/switch.spec.ts`

```ts
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { analyzeFile } from '@zeus-js/component-analyzer'
import { describe, expect, it } from 'vitest'

const workspaceRoot = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../../..')

const source = readFileSync(
  resolve(workspaceRoot, 'packages/primitives/switch/src/switch.tsx'),
  'utf-8',
)

describe('switch primitive protocol', () => {
  it('infers props, events, models, methods, slots, and css parts from source', () => {
    const result = analyzeFile({
      file: 'packages/primitives/switch/src/switch.tsx',
      code: source,
    })

    expect(result.diagnostics).toEqual([])
    expect(result.components).toHaveLength(1)

    expect(result.components[0]).toMatchObject({
      tag: 'zw-switch',
      props: {
        checked: {
          type: 'boolean',
          default: false,
          reflect: true,
        },
        size: {
          type: 'string',
          values: ['sm', 'md', 'lg'],
          default: 'md',
          reflect: true,
        },
      },
      events: {
        checkedChange: {
          name: 'checked-change',
          reactName: 'onCheckedChange',
          detail: {
            checked: 'boolean',
            nativeEvent: 'Event',
          },
        },
        focusChange: {
          name: 'focus-change',
          reactName: 'onFocusChange',
          detail: {
            focused: 'boolean',
            nativeEvent: 'FocusEvent',
          },
        },
      },
      models: [
        {
          prop: 'checked',
          event: 'checked-change',
          eventPath: 'detail.checked',
        },
      ],
      methods: {
        focus: {
          name: 'focus',
          returns: 'void',
        },
        blur: {
          name: 'blur',
          returns: 'void',
        },
      },
      slots: {
        default: {
          name: 'default',
        },
      },
      cssParts: ['control', 'label', 'root', 'thumb', 'track'],
    })
  })
})
```

---

# 5. `@zeus-web/tabs`

## `packages/primitives/tabs/src/index.ts`

```ts
export {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  type TabsContentElement,
  type TabsContentProps,
  type TabsElement,
  type TabsListElement,
  type TabsOrientation,
  type TabsProps,
  type TabsTriggerElement,
  type TabsTriggerProps,
  type TabsValueChangeDetail,
} from './tabs'
```

## `packages/primitives/tabs/src/tabs.tsx`

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
```

## `packages/primitives/tabs/__tests__/tabs.spec.ts`

```ts
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { analyzeFile } from '@zeus-js/component-analyzer'
import { describe, expect, it } from 'vitest'

const workspaceRoot = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../../..')

const source = readFileSync(
  resolve(workspaceRoot, 'packages/primitives/tabs/src/tabs.tsx'),
  'utf-8',
)

describe('tabs primitive protocol', () => {
  it('infers tabs component family from source', () => {
    const result = analyzeFile({
      file: 'packages/primitives/tabs/src/tabs.tsx',
      code: source,
    })

    expect(result.diagnostics).toEqual([])

    expect(result.components.map(item => item.tag)).toEqual([
      'zw-tabs',
      'zw-tabs-list',
      'zw-tabs-trigger',
      'zw-tabs-content',
    ])

    expect(result.components[0]).toMatchObject({
      tag: 'zw-tabs',
      props: {
        orientation: {
          type: 'string',
          values: ['horizontal', 'vertical'],
          default: 'horizontal',
          reflect: true,
        },
        disabled: {
          type: 'boolean',
          default: false,
          reflect: true,
        },
      },
      events: {
        valueChange: {
          name: 'value-change',
          reactName: 'onValueChange',
          detail: {
            value: 'string',
            nativeEvent: 'Event',
          },
        },
      },
      models: [
        {
          prop: 'value',
          event: 'value-change',
          eventPath: 'detail.value',
        },
      ],
      slots: {
        default: {
          name: 'default',
        },
      },
    })

    expect(result.components[2]).toMatchObject({
      tag: 'zw-tabs-trigger',
      props: {
        value: {
          type: 'string',
        },
        disabled: {
          type: 'boolean',
          default: false,
          reflect: true,
        },
      },
      methods: {
        focus: {
          name: 'focus',
          returns: 'void',
        },
      },
      slots: {
        default: {
          name: 'default',
        },
      },
      cssParts: ['trigger'],
    })

    expect(result.components[3]).toMatchObject({
      tag: 'zw-tabs-content',
      props: {
        value: {
          type: 'string',
        },
      },
      slots: {
        default: {
          name: 'default',
        },
      },
      cssParts: ['content'],
    })
  })
})
```

---

# 6. `@zeus-web/dialog`

## `packages/primitives/dialog/src/index.ts`

```ts
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  type DialogCloseElement,
  type DialogCloseProps,
  type DialogContentElement,
  type DialogContentProps,
  type DialogDescriptionElement,
  type DialogElement,
  type DialogOpenChangeDetail,
  type DialogProps,
  type DialogTitleElement,
  type DialogTriggerElement,
  type DialogTriggerProps,
} from './dialog'
```

## `packages/primitives/dialog/src/dialog.tsx`

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
}

const DialogContext = createContext<DialogContextValue>()

function resolveOpen(props: DialogProps): boolean {
  if (props.open !== undefined) return Boolean(props.open)
  if (props.defaultOpen !== undefined) return Boolean(props.defaultOpen)
  return false
}

function setupDialog(
  props: DialogProps,
  ctx: DefineElementContext<DialogElement, DialogEmits>,
) {
  const context: DialogContextValue = {
    getOpen: () => resolveOpen(props),
    setOpen: (open, nativeEvent) => {
      ctx.host.open = open
      ctx.emit.openChange({ open, nativeEvent })
    },
    isModal: () => props.modal !== false,
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
          if (element) control = element
        }}
        part="trigger"
        prop:type={() => 'button'}
        disabled={() => Boolean(props.disabled)}
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
          if (element) panel = element
        }}
        part="content"
        role="dialog"
        aria-modal={() => String(Boolean(dialog?.isModal()))}
        tabIndex={() => -1}
        onKeyDown={event => {
          if (event.key === 'Escape') {
            dialog?.setOpen(false, event)
          }
        }}
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
  () => (
    <Host part="title" data-slot="dialog-title">
      <Slot />
    </Host>
  ),
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
  () => (
    <Host part="description" data-slot="dialog-description">
      <Slot />
    </Host>
  ),
)
```

## `packages/primitives/dialog/__tests__/dialog.spec.ts`

```ts
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { analyzeFile } from '@zeus-js/component-analyzer'
import { describe, expect, it } from 'vitest'

const workspaceRoot = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../../..')

const source = readFileSync(
  resolve(workspaceRoot, 'packages/primitives/dialog/src/dialog.tsx'),
  'utf-8',
)

describe('dialog primitive protocol', () => {
  it('infers dialog component family from source', () => {
    const result = analyzeFile({
      file: 'packages/primitives/dialog/src/dialog.tsx',
      code: source,
    })

    expect(result.diagnostics).toEqual([])

    expect(result.components.map(item => item.tag)).toEqual([
      'zw-dialog',
      'zw-dialog-trigger',
      'zw-dialog-content',
      'zw-dialog-close',
      'zw-dialog-title',
      'zw-dialog-description',
    ])

    expect(result.components[0]).toMatchObject({
      tag: 'zw-dialog',
      props: {
        open: {
          type: 'boolean',
          default: false,
          reflect: true,
        },
        modal: {
          type: 'boolean',
          default: true,
          reflect: true,
        },
      },
      events: {
        openChange: {
          name: 'open-change',
          reactName: 'onOpenChange',
          detail: {
            open: 'boolean',
            nativeEvent: 'Event',
          },
        },
      },
      models: [
        {
          prop: 'open',
          event: 'open-change',
          eventPath: 'detail.open',
        },
      ],
      methods: {
        show: {
          name: 'show',
          returns: 'void',
        },
        close: {
          name: 'close',
          returns: 'void',
        },
      },
      slots: {
        default: {
          name: 'default',
        },
      },
    })

    expect(result.components[2]).toMatchObject({
      tag: 'zw-dialog-content',
      props: {
        forceMount: {
          type: 'boolean',
          default: false,
          reflect: true,
        },
      },
      methods: {
        focus: {
          name: 'focus',
          returns: 'void',
        },
      },
      slots: {
        default: {
          name: 'default',
        },
      },
      cssParts: ['content'],
    })

    expect(result.components[4]).toMatchObject({
      tag: 'zw-dialog-title',
      slots: {
        default: {
          name: 'default',
        },
      },
      cssParts: ['title'],
    })
  })
})
```

---

# 7. 聚合包

当前 `@zeus-web/headless` 只导 type，不会注册任何 WC。Phase 3 应该修成聚合注册入口。

## `packages/headless/src/index.ts`

```ts
// Aggregated headless Web Components for Zeus Web.
//
// This entry imports all MVP primitive WC entries for side effects.
// Use individual primitive WC entries for smaller bundles:
//
//   import '@zeus-web/button/wc'
//   import '@zeus-web/input/wc'

import '@zeus-web/button/wc'
import '@zeus-web/checkbox/wc'
import '@zeus-web/dialog/wc'
import '@zeus-web/input/wc'
import '@zeus-web/switch/wc'
import '@zeus-web/tabs/wc'

export type { ButtonElement } from '@zeus-web/button'
export type { CheckboxElement } from '@zeus-web/checkbox'

export type {
  DialogCloseElement,
  DialogContentElement,
  DialogDescriptionElement,
  DialogElement,
  DialogTitleElement,
  DialogTriggerElement,
} from '@zeus-web/dialog'

export type { InputElement } from '@zeus-web/input'
export type { SwitchElement } from '@zeus-web/switch'

export type {
  TabsContentElement,
  TabsElement,
  TabsListElement,
  TabsTriggerElement,
} from '@zeus-web/tabs'
```

## `packages/headless/package.json`

```json
{
  "name": "@zeus-web/headless",
  "type": "module",
  "version": "0.0.0",
  "description": "Aggregated headless Web Components for Zeus Web.",
  "license": "MIT",
  "sideEffects": ["./dist/index.js"],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "dev": "tsup src/index.ts --format esm --dts --clean --watch",
    "build": "tsup src/index.ts --format esm --dts --clean",
    "check": "tsc -p tsconfig.json --noEmit",
    "test": "vitest --root ../.. --project unit packages/headless/__tests__/headless.spec.ts"
  },
  "dependencies": {
    "@zeus-web/button": "workspace:*",
    "@zeus-web/checkbox": "workspace:*",
    "@zeus-web/dialog": "workspace:*",
    "@zeus-web/input": "workspace:*",
    "@zeus-web/switch": "workspace:*",
    "@zeus-web/tabs": "workspace:*"
  }
}
```

## `packages/headless/__tests__/headless.spec.ts`

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('@zeus-web/headless entry', () => {
  it('imports all MVP primitive wc entries by side effect', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'packages/headless/src/index.ts'),
      'utf-8',
    )

    expect(source).toContain("import '@zeus-web/button/wc'")
    expect(source).toContain("import '@zeus-web/checkbox/wc'")
    expect(source).toContain("import '@zeus-web/dialog/wc'")
    expect(source).toContain("import '@zeus-web/input/wc'")
    expect(source).toContain("import '@zeus-web/switch/wc'")
    expect(source).toContain("import '@zeus-web/tabs/wc'")
  })
})
```

---

# 8. React / Vue 聚合包

## `packages/react/src/index.ts`

```ts
// React wrappers for Zeus Web primitives.
// Re-exports all primitives from their react output entry points.

export * from '@zeus-web/button/react'
export * from '@zeus-web/checkbox/react'
export * from '@zeus-web/dialog/react'
export * from '@zeus-web/input/react'
export * from '@zeus-web/switch/react'
export * from '@zeus-web/tabs/react'
```

## `packages/vue/src/index.ts`

```ts
// Vue wrappers for Zeus Web primitives.
// Re-exports all primitives from their vue output entry points.

export * from '@zeus-web/button/vue'
export * from '@zeus-web/checkbox/vue'
export * from '@zeus-web/dialog/vue'
export * from '@zeus-web/input/vue'
export * from '@zeus-web/switch/vue'
export * from '@zeus-web/tabs/vue'
```

`packages/react/package.json` 和 `packages/vue/package.json` 的 dependencies 要包含：

```json
{
  "dependencies": {
    "@zeus-web/button": "workspace:*",
    "@zeus-web/checkbox": "workspace:*",
    "@zeus-web/dialog": "workspace:*",
    "@zeus-web/input": "workspace:*",
    "@zeus-web/switch": "workspace:*",
    "@zeus-web/tabs": "workspace:*"
  }
}
```

---

# 9. Phase 3 验收

必须跑：

```bash
pnpm check
pnpm test
pnpm check:exports
pnpm build
pnpm check:build-output
```

单包验证：

```bash
pnpm --filter @zeus-web/button test
pnpm --filter @zeus-web/checkbox test
pnpm --filter @zeus-web/switch test
pnpm --filter @zeus-web/tabs test
pnpm --filter @zeus-web/dialog test
```

构建单包：

```bash
pnpm build button
pnpm build checkbox
pnpm build switch
pnpm build tabs
pnpm build dialog
```

Phase 3 完成标准：

```txt
1. button / checkbox / switch / tabs / dialog 均能通过 analyzer 测试。
2. 每个 primitive 构建后都有 wc/react/vue/custom-elements/zeus.components 产物。
3. @zeus-web/headless 能通过 side-effect import 注册全部 MVP WC。
4. @zeus-web/react 能 re-export 全部 React wrappers。
5. @zeus-web/vue 能 re-export 全部 Vue wrappers。
6. check:exports 继续禁止手写 src/wc.ts / src/react.ts / src/vue.ts。
```

提交建议：

```txt
feat(button): add headless button primitive
feat(selection): add checkbox and switch primitives
feat(tabs): add headless tabs primitive family
feat(dialog): add headless dialog primitive family
feat(headless): aggregate MVP primitive wc entries
```
