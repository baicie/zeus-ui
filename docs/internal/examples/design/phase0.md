下面给 **Phase 0：Showcase 规范与共享元数据基建** 的完整设计与代码。
这个阶段 **不开始写 React/Vue 页面实现**，只做后续两个 Router Showcase 的基础契约。

当前仓库已经具备做这个的基础：workspace 已覆盖 `examples/*`，根脚本也有 `examples:check / site:check` 等检查入口。

---

# Phase 0 目标

```txt
目标：
1. 固化 React/Vue Showcase 的路由规范。
2. 固化每个组件页的标准展示模板。
3. 抽出 React/Vue 共用的组件元数据。
4. 建立 metadata contract test。
5. 接入一个轻量 CI 检查，保证后续新增组件不会忘记 route/test/metadata。
```

Phase 0 产物：

```txt
docs/internal/design/showcase-apps.md

examples/showcase-shared/
  package.json
  tsconfig.json
  src/
    types.ts
    components.ts
    icons.ts
    themes.ts
    routes.ts
    validate.ts
    index.ts
    __tests__/
      metadata.spec.ts

scripts/checks/check-showcase-metadata.ts

package.json scripts 增加：
  check:showcase-metadata
  site:check 接入 check:showcase-metadata
```

---

# 1. 新增文档：`docs/internal/design/showcase-apps.md`

````md
# Zeus Web Router Showcase Apps

## Goal

The showcase apps are production-grade component laboratories for Zeus Web.

They are not simple demos. They must verify:

```txt
component behavior
component variants
controlled and uncontrolled usage
events
icons
theme tokens
accessibility
real-world composition
unit tests
e2e tests
```
````

## Apps

```txt
examples/react-showcase
examples/vue-showcase
examples/showcase-shared
```

## Responsibilities

### React Showcase

React Showcase verifies the registry-first production workflow:

```txt
zweb init
zweb add --all
local generated registry components
@zeus-web/icons/react
@zeus-web/themes/*
```

It should use a router-based app structure.

Recommended router:

```txt
@tanstack/react-router
```

Reasons:

```txt
typed routes
explicit route tree
production-like architecture
good fit for component laboratory pages
```

### Vue Showcase

Vue Showcase verifies the per-component Vue wrapper workflow:

```txt
@zeus-web/<component>/vue
@zeus-web/icons/vue
@zeus-web/themes/*
vue-router
```

Recommended router:

```txt
vue-router
```

## Route shape

Both React and Vue apps must expose the same route structure:

```txt
/
  Overview
/components
  Component index
/components/button
/components/input
/components/checkbox
/components/switch
/components/tabs
/components/dialog
/components/label
/components/textarea
/components/radio-group
/components/select
/components/card
/components/badge
/components/separator
/components/skeleton
/components/alert
/components/collapsible
/components/accordion
/components/tooltip
/components/progress
/components/avatar
/icons
/themes
/playground
```

## Component page contract

Every component page must follow this layout:

```txt
Header
  - component name
  - package name
  - React import
  - Vue import
  - Web Component import
  - registry command

Sections
  1. Basic
  2. Variants
  3. States
  4. Controlled
  5. Uncontrolled
  6. Events
  7. With icons
  8. Theme tokens
  9. Accessibility
  10. Production pattern
```

A component may omit sections that are not meaningful, but every page must include at least:

```txt
basic
states
theme
accessibility
production
```

## Required metadata

The shared package must define:

```txt
component list
route list
icon list
theme list
deferred component list
validation function
```

The metadata must be framework-agnostic.

## Current component scope

```txt
button
input
checkbox
switch
tabs
dialog
label
textarea
radio-group
select
card
badge
separator
skeleton
alert
collapsible
accordion
tooltip
progress
avatar
```

## Deferred scope

Overlay components are deferred from `0.1.0-beta.0`:

```txt
popover
dropdown
toast
```

Follow-up overlay infrastructure:

```txt
@zeus-web/portal
@zeus-web/dismissable-layer
@zeus-web/popper
```

Before any deferred overlay is enabled, it must update all of:

```txt
primitive package
registry item
AI metadata
docs
examples
unit tests
e2e tests
component coverage checks
showcase metadata
```

## Phase 0 acceptance criteria

```txt
examples/showcase-shared exists
shared metadata covers every current registry component
metadata validation passes
root check:showcase-metadata works
site:check includes showcase metadata check
docs/internal/design/showcase-apps.md exists
```

## Later phases

### Phase 1

Create `examples/react-showcase` router shell.

### Phase 2

Create `examples/vue-showcase` router shell.

### Phase 3

Implement P0 component pages:

```txt
button
input
checkbox
switch
tabs
dialog
```

### Phase 4

Implement remaining component pages.

### Phase 5

Add icon and theme pages.

### Phase 6

Add playground composition pages.

### Phase 7

Add unit tests and e2e tests.

### Phase 8

Integrate showcase checks into CI.

````

---

# 2. 新增包：`examples/showcase-shared/package.json`

```json
{
  "name": "@zeus-web/example-showcase-shared",
  "type": "module",
  "version": "0.0.0",
  "private": true,
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "import": "./src/index.ts"
    }
  },
  "scripts": {
    "check": "tsc -p tsconfig.json --noEmit",
    "test": "vitest --root ../.. --project unit examples/showcase-shared/src/__tests__/metadata.spec.ts"
  }
}
````

---

# 3. 新增：`examples/showcase-shared/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "noEmit": true
  },
  "include": ["src/**/*.ts"]
}
```

---

# 4. 新增：`examples/showcase-shared/src/types.ts`

```ts
export type ShowcaseFramework = 'react' | 'vue' | 'web-component'

export type ShowcaseComponentGroup =
  | 'Actions'
  | 'Forms'
  | 'Layout'
  | 'Feedback'
  | 'Disclosure'
  | 'Navigation'
  | 'Media'

export type ShowcaseSection =
  | 'basic'
  | 'variants'
  | 'sizes'
  | 'states'
  | 'controlled'
  | 'uncontrolled'
  | 'events'
  | 'icons'
  | 'theme'
  | 'accessibility'
  | 'production'

export interface ShowcaseImportSpec {
  react?: string
  vue?: string
  webComponent?: string
  registry?: string
}

export interface ShowcaseEventSpec {
  name: string
  reactName?: string
  vueName?: string
  description: string
}

export interface ShowcaseComponent {
  name: string
  title: string
  routePath: `/components/${string}`
  packageName: `@zeus-web/${string}`
  group: ShowcaseComponentGroup
  description: string
  registryCommand: string
  imports: ShowcaseImportSpec
  sections: ShowcaseSection[]
  states: string[]
  events: ShowcaseEventSpec[]
  themeTokens: string[]
  iconExamples: string[]
  productionPatterns: string[]
}

export interface ShowcaseTheme {
  name: string
  label: string
  cssImport: string
  description: string
}

export interface ShowcaseIcon {
  name: string
  label: string
  tags: string[]
}

export interface ShowcaseRoute {
  path: string
  label: string
  description: string
  group: 'Overview' | 'Components' | 'Foundations' | 'Playground'
  componentName?: string
}

export interface ShowcaseValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}
```

---

# 5. 新增：`examples/showcase-shared/src/components.ts`

```ts
import type { ShowcaseComponent } from './types'

const baseSections = [
  'basic',
  'states',
  'theme',
  'accessibility',
  'production',
] as const

const formSections = [
  'basic',
  'states',
  'controlled',
  'uncontrolled',
  'events',
  'theme',
  'accessibility',
  'production',
] as const

export const showcaseComponents: ShowcaseComponent[] = [
  {
    name: 'button',
    title: 'Button',
    routePath: '/components/button',
    packageName: '@zeus-web/button',
    group: 'Actions',
    description:
      'Action component for commands, form submission, toolbar controls and icon buttons.',
    registryCommand: 'zweb add button',
    imports: {
      react: "import { Button } from '@/components/ui/button'",
      vue: "import { Button } from '@zeus-web/button/vue'",
      webComponent: "import '@zeus-web/button/wc'",
      registry: 'zweb add button',
    },
    sections: [
      'basic',
      'variants',
      'sizes',
      'states',
      'events',
      'icons',
      'theme',
      'accessibility',
      'production',
    ],
    states: [
      'default',
      'primary',
      'secondary',
      'outline',
      'ghost',
      'danger',
      'disabled',
      'loading',
      'icon-only',
    ],
    events: [
      {
        name: 'press',
        reactName: 'onPress',
        vueName: 'press',
        description: 'Emitted when the button is activated and not disabled.',
      },
    ],
    themeTokens: [
      'primary',
      'primary-foreground',
      'ring',
      'border',
      'destructive',
    ],
    iconExamples: ['check', 'plus', 'trash', 'loader'],
    productionPatterns: [
      'Form actions',
      'Toolbar action',
      'Destructive confirmation',
      'Icon-only button',
    ],
  },
  {
    name: 'input',
    title: 'Input',
    routePath: '/components/input',
    packageName: '@zeus-web/input',
    group: 'Forms',
    description: 'Single-line text input for forms, filters and search fields.',
    registryCommand: 'zweb add input',
    imports: {
      react: "import { Input } from '@/components/ui/input'",
      vue: "import { Input } from '@zeus-web/input/vue'",
      webComponent: "import '@zeus-web/input/wc'",
      registry: 'zweb add input',
    },
    sections: [...formSections, 'icons'],
    states: [
      'default',
      'disabled',
      'readonly',
      'invalid',
      'with-prefix',
      'with-suffix',
    ],
    events: [
      {
        name: 'value-change',
        reactName: 'onValueChange',
        vueName: 'value-change',
        description: 'Emitted when the input value changes.',
      },
      {
        name: 'focus-change',
        reactName: 'onFocusChange',
        vueName: 'focus-change',
        description: 'Emitted when focus state changes.',
      },
    ],
    themeTokens: ['input', 'ring', 'muted-foreground', 'destructive'],
    iconExamples: ['search', 'eye', 'eye-off'],
    productionPatterns: ['Search input', 'Login field', 'Settings field'],
  },
  {
    name: 'checkbox',
    title: 'Checkbox',
    routePath: '/components/checkbox',
    packageName: '@zeus-web/checkbox',
    group: 'Forms',
    description:
      'Boolean choice control with checked and indeterminate states.',
    registryCommand: 'zweb add checkbox',
    imports: {
      react: "import { Checkbox } from '@/components/ui/checkbox'",
      vue: "import { Checkbox } from '@zeus-web/checkbox/vue'",
      webComponent: "import '@zeus-web/checkbox/wc'",
      registry: 'zweb add checkbox',
    },
    sections: formSections,
    states: ['unchecked', 'checked', 'indeterminate', 'disabled', 'required'],
    events: [
      {
        name: 'checked-change',
        reactName: 'onCheckedChange',
        vueName: 'checked-change',
        description: 'Emitted when checked state changes.',
      },
    ],
    themeTokens: ['primary', 'primary-foreground', 'ring'],
    iconExamples: ['check', 'minus'],
    productionPatterns: [
      'Terms checkbox',
      'Bulk selection',
      'Indeterminate table selection',
    ],
  },
  {
    name: 'switch',
    title: 'Switch',
    routePath: '/components/switch',
    packageName: '@zeus-web/switch',
    group: 'Forms',
    description: 'On/off setting control.',
    registryCommand: 'zweb add switch',
    imports: {
      react: "import { Switch } from '@/components/ui/switch'",
      vue: "import { Switch } from '@zeus-web/switch/vue'",
      webComponent: "import '@zeus-web/switch/wc'",
      registry: 'zweb add switch',
    },
    sections: formSections,
    states: ['off', 'on', 'disabled', 'required'],
    events: [
      {
        name: 'checked-change',
        reactName: 'onCheckedChange',
        vueName: 'checked-change',
        description: 'Emitted when checked state changes.',
      },
    ],
    themeTokens: ['primary', 'input', 'ring'],
    iconExamples: ['sun', 'moon'],
    productionPatterns: [
      'Notification settings',
      'Feature flag toggle',
      'Theme preference',
    ],
  },
  {
    name: 'tabs',
    title: 'Tabs',
    routePath: '/components/tabs',
    packageName: '@zeus-web/tabs',
    group: 'Navigation',
    description: 'Tabbed navigation with triggers and content panels.',
    registryCommand: 'zweb add tabs',
    imports: {
      react:
        "import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'",
      vue: "import { Tabs, TabsList, TabsTrigger, TabsContent } from '@zeus-web/tabs/vue'",
      webComponent: "import '@zeus-web/tabs/wc'",
      registry: 'zweb add tabs',
    },
    sections: [
      'basic',
      'variants',
      'states',
      'controlled',
      'uncontrolled',
      'events',
      'theme',
      'accessibility',
      'production',
    ],
    states: ['horizontal', 'vertical', 'disabled-trigger', 'controlled'],
    events: [
      {
        name: 'value-change',
        reactName: 'onValueChange',
        vueName: 'value-change',
        description: 'Emitted when active tab changes.',
      },
    ],
    themeTokens: ['muted', 'muted-foreground', 'ring'],
    iconExamples: ['settings', 'user'],
    productionPatterns: [
      'Settings page',
      'Dashboard panels',
      'Profile details',
    ],
  },
  {
    name: 'dialog',
    title: 'Dialog',
    routePath: '/components/dialog',
    packageName: '@zeus-web/dialog',
    group: 'Feedback',
    description: 'Modal dialog for focused tasks and confirmations.',
    registryCommand: 'zweb add dialog',
    imports: {
      react:
        "import { Dialog, DialogTrigger, DialogContent, DialogTitle } from '@/components/ui/dialog'",
      vue: "import { Dialog, DialogTrigger, DialogContent, DialogTitle } from '@zeus-web/dialog/vue'",
      webComponent: "import '@zeus-web/dialog/wc'",
      registry: 'zweb add dialog',
    },
    sections: [
      'basic',
      'states',
      'controlled',
      'uncontrolled',
      'events',
      'theme',
      'accessibility',
      'production',
    ],
    states: ['closed', 'open', 'modal', 'non-modal'],
    events: [
      {
        name: 'open-change',
        reactName: 'onOpenChange',
        vueName: 'open-change',
        description: 'Emitted when open state changes.',
      },
    ],
    themeTokens: ['background', 'foreground', 'ring', 'border'],
    iconExamples: ['x', 'alert-triangle'],
    productionPatterns: [
      'Create project dialog',
      'Confirmation dialog',
      'Edit settings modal',
    ],
  },
  {
    name: 'label',
    title: 'Label',
    routePath: '/components/label',
    packageName: '@zeus-web/label',
    group: 'Forms',
    description: 'Accessible form label with required and disabled states.',
    registryCommand: 'zweb add label',
    imports: {
      react: "import { Label } from '@/components/ui/label'",
      vue: "import { Label } from '@zeus-web/label/vue'",
      webComponent: "import '@zeus-web/label/wc'",
      registry: 'zweb add label',
    },
    sections: baseSections,
    states: ['default', 'required', 'disabled', 'visually-hidden'],
    events: [],
    themeTokens: ['foreground', 'destructive', 'muted-foreground'],
    iconExamples: ['info'],
    productionPatterns: [
      'Form label',
      'Required field label',
      'Accessible hidden label',
    ],
  },
  {
    name: 'textarea',
    title: 'Textarea',
    routePath: '/components/textarea',
    packageName: '@zeus-web/textarea',
    group: 'Forms',
    description:
      'Multi-line text input with validation and help message support.',
    registryCommand: 'zweb add textarea',
    imports: {
      react: "import { Textarea } from '@/components/ui/textarea'",
      vue: "import { Textarea } from '@zeus-web/textarea/vue'",
      webComponent: "import '@zeus-web/textarea/wc'",
      registry: 'zweb add textarea',
    },
    sections: formSections,
    states: ['default', 'disabled', 'invalid', 'with-message'],
    events: [
      {
        name: 'value-change',
        reactName: 'onValueChange',
        vueName: 'value-change',
        description: 'Emitted when value changes.',
      },
    ],
    themeTokens: ['input', 'ring', 'muted-foreground', 'destructive'],
    iconExamples: ['info'],
    productionPatterns: ['Feedback form', 'Deployment note', 'Support message'],
  },
  {
    name: 'radio-group',
    title: 'Radio Group',
    routePath: '/components/radio-group',
    packageName: '@zeus-web/radio-group',
    group: 'Forms',
    description: 'Single-selection control group.',
    registryCommand: 'zweb add radio-group',
    imports: {
      react:
        "import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'",
      vue: "import { RadioGroup, RadioGroupItem } from '@zeus-web/radio-group/vue'",
      webComponent: "import '@zeus-web/radio-group/wc'",
      registry: 'zweb add radio-group',
    },
    sections: formSections,
    states: ['vertical', 'horizontal', 'disabled', 'required'],
    events: [
      {
        name: 'value-change',
        reactName: 'onValueChange',
        vueName: 'value-change',
        description: 'Emitted when selected value changes.',
      },
    ],
    themeTokens: ['primary', 'ring', 'muted-foreground'],
    iconExamples: ['circle-check'],
    productionPatterns: [
      'Plan selection',
      'Notification frequency',
      'Environment selection',
    ],
  },
  {
    name: 'select',
    title: 'Select',
    routePath: '/components/select',
    packageName: '@zeus-web/select',
    group: 'Forms',
    description: 'Native select primitive styled with Zeus Web tokens.',
    registryCommand: 'zweb add select',
    imports: {
      react: "import { Select } from '@/components/ui/select'",
      vue: "import { Select } from '@zeus-web/select/vue'",
      webComponent: "import '@zeus-web/select/wc'",
      registry: 'zweb add select',
    },
    sections: formSections,
    states: ['default', 'disabled', 'invalid'],
    events: [
      {
        name: 'value-change',
        reactName: 'onValueChange',
        vueName: 'value-change',
        description: 'Emitted when selected value changes.',
      },
    ],
    themeTokens: ['input', 'ring', 'background', 'foreground'],
    iconExamples: ['chevron-down'],
    productionPatterns: ['Environment select', 'Role select', 'Status filter'],
  },
  {
    name: 'card',
    title: 'Card',
    routePath: '/components/card',
    packageName: '@zeus-web/card',
    group: 'Layout',
    description: 'Surface container for grouped content.',
    registryCommand: 'zweb add card',
    imports: {
      react:
        "import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'",
      vue: "import { Card, CardHeader, CardTitle, CardContent } from '@zeus-web/card/vue'",
      webComponent: "import '@zeus-web/card/wc'",
      registry: 'zweb add card',
    },
    sections: baseSections,
    states: ['default', 'interactive', 'muted'],
    events: [],
    themeTokens: ['card', 'card-foreground', 'border'],
    iconExamples: ['info', 'settings'],
    productionPatterns: ['Dashboard metric', 'Settings panel', 'Profile card'],
  },
  {
    name: 'badge',
    title: 'Badge',
    routePath: '/components/badge',
    packageName: '@zeus-web/badge',
    group: 'Feedback',
    description: 'Small status label.',
    registryCommand: 'zweb add badge',
    imports: {
      react: "import { Badge } from '@/components/ui/badge'",
      vue: "import { Badge } from '@zeus-web/badge/vue'",
      webComponent: "import '@zeus-web/badge/wc'",
      registry: 'zweb add badge',
    },
    sections: [
      'basic',
      'variants',
      'states',
      'icons',
      'theme',
      'accessibility',
      'production',
    ],
    states: ['default', 'secondary', 'outline', 'danger'],
    events: [],
    themeTokens: ['primary', 'secondary', 'destructive', 'border'],
    iconExamples: ['check', 'x', 'alert-triangle'],
    productionPatterns: ['Status badge', 'Plan badge', 'Environment label'],
  },
  {
    name: 'separator',
    title: 'Separator',
    routePath: '/components/separator',
    packageName: '@zeus-web/separator',
    group: 'Layout',
    description: 'Visual or semantic content separator.',
    registryCommand: 'zweb add separator',
    imports: {
      react: "import { Separator } from '@/components/ui/separator'",
      vue: "import { Separator } from '@zeus-web/separator/vue'",
      webComponent: "import '@zeus-web/separator/wc'",
      registry: 'zweb add separator',
    },
    sections: baseSections,
    states: ['horizontal', 'vertical', 'decorative'],
    events: [],
    themeTokens: ['border'],
    iconExamples: [],
    productionPatterns: [
      'Settings group divider',
      'Toolbar divider',
      'Sidebar separator',
    ],
  },
  {
    name: 'skeleton',
    title: 'Skeleton',
    routePath: '/components/skeleton',
    packageName: '@zeus-web/skeleton',
    group: 'Feedback',
    description: 'Loading placeholder for content.',
    registryCommand: 'zweb add skeleton',
    imports: {
      react: "import { Skeleton } from '@/components/ui/skeleton'",
      vue: "import { Skeleton } from '@zeus-web/skeleton/vue'",
      webComponent: "import '@zeus-web/skeleton/wc'",
      registry: 'zweb add skeleton',
    },
    sections: [
      'basic',
      'variants',
      'states',
      'theme',
      'accessibility',
      'production',
    ],
    states: ['text', 'avatar', 'card', 'table'],
    events: [],
    themeTokens: ['muted'],
    iconExamples: [],
    productionPatterns: [
      'Loading card',
      'Loading table row',
      'Loading profile',
    ],
  },
  {
    name: 'alert',
    title: 'Alert',
    routePath: '/components/alert',
    packageName: '@zeus-web/alert',
    group: 'Feedback',
    description: 'Inline contextual feedback.',
    registryCommand: 'zweb add alert',
    imports: {
      react:
        "import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'",
      vue: "import { Alert, AlertTitle, AlertDescription } from '@zeus-web/alert/vue'",
      webComponent: "import '@zeus-web/alert/wc'",
      registry: 'zweb add alert',
    },
    sections: [
      'basic',
      'variants',
      'states',
      'icons',
      'theme',
      'accessibility',
      'production',
    ],
    states: ['info', 'success', 'warning', 'danger'],
    events: [],
    themeTokens: ['background', 'foreground', 'destructive', 'border'],
    iconExamples: ['info', 'circle-check', 'alert-triangle', 'circle-x'],
    productionPatterns: ['Form error', 'System notice', 'Deployment warning'],
  },
  {
    name: 'collapsible',
    title: 'Collapsible',
    routePath: '/components/collapsible',
    packageName: '@zeus-web/collapsible',
    group: 'Disclosure',
    description: 'Expandable content region.',
    registryCommand: 'zweb add collapsible',
    imports: {
      react:
        "import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'",
      vue: "import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@zeus-web/collapsible/vue'",
      webComponent: "import '@zeus-web/collapsible/wc'",
      registry: 'zweb add collapsible',
    },
    sections: [
      'basic',
      'states',
      'controlled',
      'uncontrolled',
      'events',
      'theme',
      'accessibility',
      'production',
    ],
    states: ['closed', 'open', 'disabled'],
    events: [
      {
        name: 'open-change',
        reactName: 'onOpenChange',
        vueName: 'open-change',
        description: 'Emitted when open state changes.',
      },
    ],
    themeTokens: ['border', 'muted'],
    iconExamples: ['chevron-down', 'chevron-up'],
    productionPatterns: [
      'Advanced settings',
      'Expandable log details',
      'FAQ item',
    ],
  },
  {
    name: 'accordion',
    title: 'Accordion',
    routePath: '/components/accordion',
    packageName: '@zeus-web/accordion',
    group: 'Disclosure',
    description: 'Stacked expandable sections.',
    registryCommand: 'zweb add accordion',
    imports: {
      react:
        "import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'",
      vue: "import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@zeus-web/accordion/vue'",
      webComponent: "import '@zeus-web/accordion/wc'",
      registry: 'zweb add accordion',
    },
    sections: [
      'basic',
      'states',
      'controlled',
      'uncontrolled',
      'events',
      'theme',
      'accessibility',
      'production',
    ],
    states: ['single', 'multiple', 'collapsible', 'disabled'],
    events: [
      {
        name: 'value-change',
        reactName: 'onValueChange',
        vueName: 'value-change',
        description: 'Emitted when selected item changes.',
      },
    ],
    themeTokens: ['border', 'muted', 'ring'],
    iconExamples: ['chevron-down', 'chevron-up'],
    productionPatterns: [
      'FAQ',
      'Settings sections',
      'Documentation navigation',
    ],
  },
  {
    name: 'tooltip',
    title: 'Tooltip',
    routePath: '/components/tooltip',
    packageName: '@zeus-web/tooltip',
    group: 'Feedback',
    description: 'Small contextual help on hover or focus.',
    registryCommand: 'zweb add tooltip',
    imports: {
      react:
        "import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'",
      vue: "import { Tooltip, TooltipTrigger, TooltipContent } from '@zeus-web/tooltip/vue'",
      webComponent: "import '@zeus-web/tooltip/wc'",
      registry: 'zweb add tooltip',
    },
    sections: [
      'basic',
      'states',
      'controlled',
      'uncontrolled',
      'theme',
      'accessibility',
      'production',
    ],
    states: ['closed', 'open', 'delay', 'disabled'],
    events: [],
    themeTokens: ['popover', 'popover-foreground', 'ring'],
    iconExamples: ['info', 'help-circle'],
    productionPatterns: ['Icon help', 'Truncated text help', 'Form hint'],
  },
  {
    name: 'progress',
    title: 'Progress',
    routePath: '/components/progress',
    packageName: '@zeus-web/progress',
    group: 'Feedback',
    description: 'Progress indicator for known completion values.',
    registryCommand: 'zweb add progress',
    imports: {
      react: "import { Progress } from '@/components/ui/progress'",
      vue: "import { Progress } from '@zeus-web/progress/vue'",
      webComponent: "import '@zeus-web/progress/wc'",
      registry: 'zweb add progress',
    },
    sections: [
      'basic',
      'variants',
      'states',
      'theme',
      'accessibility',
      'production',
    ],
    states: ['0', '25', '50', '75', '100', 'indeterminate'],
    events: [],
    themeTokens: ['primary', 'muted'],
    iconExamples: ['loader'],
    productionPatterns: [
      'Upload progress',
      'Deployment progress',
      'Profile completion',
    ],
  },
  {
    name: 'avatar',
    title: 'Avatar',
    routePath: '/components/avatar',
    packageName: '@zeus-web/avatar',
    group: 'Media',
    description: 'User image with fallback state.',
    registryCommand: 'zweb add avatar',
    imports: {
      react:
        "import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'",
      vue: "import { Avatar, AvatarImage, AvatarFallback } from '@zeus-web/avatar/vue'",
      webComponent: "import '@zeus-web/avatar/wc'",
      registry: 'zweb add avatar',
    },
    sections: [
      'basic',
      'variants',
      'states',
      'theme',
      'accessibility',
      'production',
    ],
    states: ['image', 'fallback', 'group', 'loading-error'],
    events: [],
    themeTokens: ['muted', 'muted-foreground'],
    iconExamples: ['user'],
    productionPatterns: ['User profile', 'Assignee list', 'Team member card'],
  },
]

export const deferredComponents = ['popover', 'dropdown', 'toast'] as const
```

---

# 6. 新增：`examples/showcase-shared/src/icons.ts`

```ts
import type { ShowcaseIcon } from './types'

export const showcaseIcons: ShowcaseIcon[] = [
  { name: 'check', label: 'Check', tags: ['status', 'form', 'action'] },
  { name: 'x', label: 'X', tags: ['close', 'remove', 'dialog'] },
  { name: 'plus', label: 'Plus', tags: ['add', 'create', 'action'] },
  { name: 'minus', label: 'Minus', tags: ['remove', 'collapse', 'action'] },
  {
    name: 'chevron-down',
    label: 'Chevron down',
    tags: ['navigation', 'disclosure'],
  },
  {
    name: 'chevron-up',
    label: 'Chevron up',
    tags: ['navigation', 'disclosure'],
  },
  { name: 'chevron-left', label: 'Chevron left', tags: ['navigation'] },
  { name: 'chevron-right', label: 'Chevron right', tags: ['navigation'] },
  { name: 'search', label: 'Search', tags: ['input', 'navigation'] },
  { name: 'menu', label: 'Menu', tags: ['navigation', 'layout'] },
  { name: 'settings', label: 'Settings', tags: ['navigation', 'preferences'] },
  { name: 'user', label: 'User', tags: ['avatar', 'profile'] },
  { name: 'copy', label: 'Copy', tags: ['clipboard', 'action'] },
  { name: 'external-link', label: 'External link', tags: ['navigation'] },
  { name: 'info', label: 'Info', tags: ['feedback', 'help'] },
  {
    name: 'alert-triangle',
    label: 'Alert triangle',
    tags: ['warning', 'feedback'],
  },
  {
    name: 'circle-check',
    label: 'Circle check',
    tags: ['success', 'feedback'],
  },
  { name: 'circle-x', label: 'Circle x', tags: ['error', 'feedback'] },
  { name: 'loader', label: 'Loader', tags: ['loading', 'progress'] },
  { name: 'sun', label: 'Sun', tags: ['theme', 'light'] },
  { name: 'moon', label: 'Moon', tags: ['theme', 'dark'] },
  { name: 'eye', label: 'Eye', tags: ['visibility', 'input'] },
  { name: 'eye-off', label: 'Eye off', tags: ['visibility', 'input'] },
  { name: 'trash', label: 'Trash', tags: ['delete', 'danger'] },
]
```

---

# 7. 新增：`examples/showcase-shared/src/themes.ts`

```ts
import type { ShowcaseTheme } from './types'

export const showcaseThemes: ShowcaseTheme[] = [
  {
    name: 'default',
    label: 'Default',
    cssImport: '@zeus-web/themes/default.css',
    description: 'Default Zeus Web theme.',
  },
  {
    name: 'slate',
    label: 'Slate',
    cssImport: '@zeus-web/themes/slate.css',
    description: 'Cool neutral theme.',
  },
  {
    name: 'zinc',
    label: 'Zinc',
    cssImport: '@zeus-web/themes/zinc.css',
    description: 'Modern neutral theme.',
  },
  {
    name: 'neutral',
    label: 'Neutral',
    cssImport: '@zeus-web/themes/neutral.css',
    description: 'Balanced neutral theme.',
  },
  {
    name: 'stone',
    label: 'Stone',
    cssImport: '@zeus-web/themes/stone.css',
    description: 'Warm neutral theme.',
  },
]

export const semanticTokens = [
  'background',
  'foreground',
  'card',
  'card-foreground',
  'popover',
  'popover-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'destructive-foreground',
  'border',
  'input',
  'ring',
] as const
```

---

# 8. 新增：`examples/showcase-shared/src/routes.ts`

```ts
import { showcaseComponents } from './components'
import type { ShowcaseRoute } from './types'

export const foundationRoutes: ShowcaseRoute[] = [
  {
    path: '/',
    label: 'Overview',
    description: 'Showcase overview and current beta scope.',
    group: 'Overview',
  },
  {
    path: '/components',
    label: 'Components',
    description: 'All component pages.',
    group: 'Components',
  },
  {
    path: '/icons',
    label: 'Icons',
    description: 'Icon grid, import snippets and visual states.',
    group: 'Foundations',
  },
  {
    path: '/themes',
    label: 'Themes',
    description: 'Theme tokens and visual previews.',
    group: 'Foundations',
  },
  {
    path: '/playground',
    label: 'Playground',
    description: 'Production-like composed pages.',
    group: 'Playground',
  },
]

export const componentRoutes: ShowcaseRoute[] = showcaseComponents.map(
  component => ({
    path: component.routePath,
    label: component.title,
    description: component.description,
    group: 'Components',
    componentName: component.name,
  }),
)

export const showcaseRoutes: ShowcaseRoute[] = [
  ...foundationRoutes,
  ...componentRoutes,
]
```

---

# 9. 新增：`examples/showcase-shared/src/validate.ts`

```ts
import { showcaseComponents, deferredComponents } from './components'
import { showcaseIcons } from './icons'
import { showcaseRoutes } from './routes'
import { semanticTokens, showcaseThemes } from './themes'
import type { ShowcaseComponent, ShowcaseValidationResult } from './types'

const requiredSections = [
  'basic',
  'states',
  'theme',
  'accessibility',
  'production',
] as const

function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value)
      continue
    }

    seen.add(value)
  }

  return Array.from(duplicates).sort()
}

function assertNoDuplicates(
  errors: string[],
  label: string,
  values: string[],
): void {
  for (const duplicate of findDuplicates(values)) {
    errors.push(`${label} has duplicate value "${duplicate}"`)
  }
}

function validateComponent(
  component: ShowcaseComponent,
  errors: string[],
  warnings: string[],
): void {
  const expectedPackageName = `@zeus-web/${component.name}`
  const expectedRoutePath = `/components/${component.name}` as const
  const expectedRegistryCommand = `zweb add ${component.name}`

  if (component.packageName !== expectedPackageName) {
    errors.push(
      `${component.name}: packageName must be "${expectedPackageName}"`,
    )
  }

  if (component.routePath !== expectedRoutePath) {
    errors.push(`${component.name}: routePath must be "${expectedRoutePath}"`)
  }

  if (component.registryCommand !== expectedRegistryCommand) {
    errors.push(
      `${component.name}: registryCommand must be "${expectedRegistryCommand}"`,
    )
  }

  for (const section of requiredSections) {
    if (!component.sections.includes(section)) {
      errors.push(`${component.name}: missing required section "${section}"`)
    }
  }

  if (!component.imports.react) {
    errors.push(`${component.name}: missing React import spec`)
  }

  if (!component.imports.vue) {
    errors.push(`${component.name}: missing Vue import spec`)
  }

  if (!component.imports.webComponent) {
    errors.push(`${component.name}: missing Web Component import spec`)
  }

  if (!component.imports.registry) {
    errors.push(`${component.name}: missing registry command import spec`)
  }

  if (component.states.length === 0) {
    errors.push(`${component.name}: states must not be empty`)
  }

  if (component.themeTokens.length === 0) {
    warnings.push(`${component.name}: themeTokens is empty`)
  }

  if (component.productionPatterns.length === 0) {
    errors.push(`${component.name}: productionPatterns must not be empty`)
  }
}

export function validateShowcaseMetadata(): ShowcaseValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  const componentNames = showcaseComponents.map(component => component.name)
  const componentRoutePaths = showcaseComponents.map(
    component => component.routePath,
  )
  const routePaths = showcaseRoutes.map(route => route.path)
  const iconNames = showcaseIcons.map(icon => icon.name)
  const themeNames = showcaseThemes.map(theme => theme.name)

  assertNoDuplicates(errors, 'showcaseComponents', componentNames)
  assertNoDuplicates(errors, 'component route paths', componentRoutePaths)
  assertNoDuplicates(errors, 'showcaseRoutes', routePaths)
  assertNoDuplicates(errors, 'showcaseIcons', iconNames)
  assertNoDuplicates(errors, 'showcaseThemes', themeNames)

  for (const component of showcaseComponents) {
    validateComponent(component, errors, warnings)
  }

  for (const deferred of deferredComponents) {
    if (componentNames.includes(deferred)) {
      errors.push(
        `deferred component "${deferred}" must not appear in showcaseComponents`,
      )
    }

    if (routePaths.includes(`/components/${deferred}`)) {
      errors.push(
        `deferred component "${deferred}" must not have a showcase route`,
      )
    }
  }

  for (const token of semanticTokens) {
    if (!token || token.trim() === '') {
      errors.push('semanticTokens must not contain empty values')
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}
```

---

# 10. 新增：`examples/showcase-shared/src/index.ts`

```ts
export * from './components'
export * from './icons'
export * from './routes'
export * from './themes'
export * from './types'
export * from './validate'
```

---

# 11. 新增测试：`examples/showcase-shared/src/__tests__/metadata.spec.ts`

```ts
import {
  componentRoutes,
  deferredComponents,
  showcaseComponents,
  showcaseIcons,
  showcaseRoutes,
  showcaseThemes,
  validateShowcaseMetadata,
} from '../index'

describe('showcase shared metadata', () => {
  it('passes metadata validation', () => {
    const result = validateShowcaseMetadata()

    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })

  it('contains one route for every showcase component', () => {
    expect(componentRoutes).toHaveLength(showcaseComponents.length)

    for (const component of showcaseComponents) {
      expect(componentRoutes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: component.routePath,
            componentName: component.name,
          }),
        ]),
      )
    }
  })

  it('keeps deferred components out of component routes', () => {
    const routePaths = showcaseRoutes.map(route => route.path)
    const componentNames = showcaseComponents.map(component => component.name)

    for (const deferred of deferredComponents) {
      expect(componentNames).not.toContain(deferred)
      expect(routePaths).not.toContain(`/components/${deferred}`)
    }
  })

  it('declares enough icons for icon showcase', () => {
    expect(showcaseIcons.length).toBeGreaterThanOrEqual(20)
    expect(showcaseIcons.map(icon => icon.name)).toEqual(
      expect.arrayContaining(['check', 'x', 'search', 'settings', 'user']),
    )
  })

  it('declares current theme variants', () => {
    expect(showcaseThemes.map(theme => theme.name)).toEqual([
      'default',
      'slate',
      'zinc',
      'neutral',
      'stone',
    ])
  })
})
```

---

# 12. 新增脚本：`scripts/checks/check-showcase-metadata.ts`

```ts
import pc from 'picocolors'

import { validateShowcaseMetadata } from '../../examples/showcase-shared/src'

const result = validateShowcaseMetadata()

for (const warning of result.warnings) {
  console.log(pc.yellow(`warning: ${warning}`))
}

if (!result.valid) {
  for (const error of result.errors) {
    console.error(pc.red(`error: ${error}`))
  }

  process.exit(1)
}

console.log(pc.green('Showcase metadata check passed.'))
```

---

# 13. 修改根 `package.json`

在 scripts 中增加：

```json
{
  "scripts": {
    "check:showcase-metadata": "tsx scripts/checks/check-showcase-metadata.ts"
  }
}
```

然后把当前：

```json
{
  "site:check": "pnpm check:component-coverage && pnpm docs:check && pnpm docs:build && pnpm examples:check"
}
```

改成：

```json
{
  "site:check": "pnpm check:component-coverage && pnpm check:showcase-metadata && pnpm docs:check && pnpm docs:build && pnpm examples:check"
}
```

---

# 14. Phase 0 验收命令

```bash
pnpm --filter @zeus-web/example-showcase-shared check
pnpm --filter @zeus-web/example-showcase-shared test
pnpm check:showcase-metadata
pnpm site:check
```

完整项目验收：

```bash
pnpm format-check
pnpm lint
pnpm test
pnpm check
pnpm build
pnpm check:component-coverage
pnpm check:showcase-metadata
pnpm site:check
pnpm release:verify --allow-zero
```

---

# 15. Phase 0 完成标准

```txt
完成后可以说 Phase 0 done，当且仅当：

1. docs/internal/design/showcase-apps.md 存在。
2. examples/showcase-shared 包存在。
3. showcaseComponents 覆盖当前 20 个 beta 组件。
4. deferredComponents 明确为 popover/dropdown/toast。
5. componentRoutes 自动从 showcaseComponents 生成。
6. validateShowcaseMetadata 通过。
7. check:showcase-metadata 可独立运行。
8. site:check 已包含 check:showcase-metadata。
```

---

# 建议提交

```txt
feat(examples): add showcase metadata contract
```

这个 Phase 0 完成后，下一步 Phase 1 就可以开始做：

```txt
examples/react-showcase
  TanStack Router AppShell
  /
  /components
  /components/button
  /components/input
  /icons
  /themes
  /playground
```

React 和 Vue 后续都直接消费 `@zeus-web/example-showcase-shared`，不会再出现两套 example 路由、组件列表、测试范围不一致的问题。
