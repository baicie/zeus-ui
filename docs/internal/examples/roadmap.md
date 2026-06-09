可以做，而且我建议把它做成 **两个“生产级 Showcase 应用”**，不是简单 demo。

当前项目已经具备做这件事的基础：

- 根 workspace 已经覆盖 `packages/*`、`packages/primitives/*`、`apps/*`、`examples/*`。
- 根脚本已经有 `build / check / test / docs / examples / site / release / ci-publish` 等完整工程命令。
- primitives 包已经有 `./wc / ./react / ./vue / ./vue/global / custom-elements.json / zeus.components.json` 等出口。
- CLI 已经支持 `init / add / list / diff / update / doctor / theme / icon / ai`。
- CLI help 里已经有 `zweb add --all`、`zweb theme`、`zweb icon`、`zweb ai`、`--cwd`、`--yes`、`--no-install` 等能力。
- icons 包已经暴露 `./react / ./vue / ./wc / ./manifest.json / ./svg/*`。
- themes 包已经暴露 `tokens.css / default.css / slate.css / zinc.css / neutral.css / stone.css`。

所以推荐新增：

```txt
examples/react-showcase
examples/vue-showcase
examples/showcase-shared
```

---

# 1. 项目怎么使用

## 方式一：生产项目推荐用 CLI

React 项目：

```bash
pnpm add -D @zeus-web/cli
pnpm add @zeus-web/themes @zeus-web/icons

pnpm zweb init --style slate --css src/styles/globals.css --yes
pnpm zweb add button input checkbox switch tabs dialog label textarea radio-group select card badge separator skeleton alert collapsible accordion tooltip progress avatar --yes
```

或者：

```bash
pnpm zweb add --all --yes
```

然后在业务代码里用本地生成的组件：

```tsx
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { IconCheck, IconSearch } from '@zeus-web/icons/react'
import '@zeus-web/themes/default.css'
```

Vue 项目目前更适合直接用 primitive Vue 入口：

```bash
pnpm add @zeus-web/button @zeus-web/input @zeus-web/checkbox @zeus-web/switch
pnpm add @zeus-web/icons @zeus-web/themes
```

```vue
<script setup lang="ts">
import { Button } from '@zeus-web/button/vue'
import { Input } from '@zeus-web/input/vue'
import { IconCheck } from '@zeus-web/icons/vue'
import '@zeus-web/themes/default.css'
</script>
```

原因是 registry 当前目标文件是 `components/ui/*.tsx`，也就是 React styled source-copy 模式。比如 registry 的 button/input 都 target 到 `components/ui/*.tsx`。

所以这两个 example 的定位应该不同：

```txt
React Showcase：展示 registry 生产级使用方式，也就是 zweb add 生成本地 styled components。
Vue Showcase：展示 per-component Vue wrappers + themes + icons 的生产级使用方式。
```

---

# 2. 两个 example 的目标

## React Showcase

目录：

```txt
examples/react-showcase
```

定位：

```txt
一个完整后台管理类应用，用 registry 组件搭建真实页面。
```

展示内容：

```txt
1. App Shell：侧边栏、顶部栏、主题切换、搜索。
2. Dashboard：Card、Badge、Button、Skeleton、Progress、Alert。
3. Form Center：Input、Textarea、Label、Checkbox、Switch、RadioGroup、Select。
4. Navigation：Tabs、Accordion、Collapsible、Tooltip。
5. Dialog Lab：Dialog 打开/关闭/表单提交/键盘交互。
6. Icon Wall：React icons 搜索、分类、复制 import。
7. Theme Lab：default/slate/zinc/neutral/stone 主题切换。
8. Component Gallery：每个组件的 variants / states / events。
```

## Vue Showcase

目录：

```txt
examples/vue-showcase
```

定位：

```txt
一个 Vue 生产级控制台，用 @zeus-web/*/vue + themes + icons 展示 primitive 能力。
```

展示内容：

```txt
1. Vue App Shell：布局、导航、主题切换。
2. Component Playground：所有 Vue primitive 组件。
3. Controlled/Uncontrolled：value、checked、open 等状态演示。
4. Event Log：value-change、checked-change、open-change 等事件可视化。
5. Icon Browser：Vue icon 搜索和展示。
6. Theme Lab：token 可视化、CSS 变量展示。
```

---

# 3. 推荐新增结构

```txt
examples/
  showcase-shared/
    package.json
    src/
      components.ts
      icons.ts
      themes.ts
      index.ts

  react-showcase/
    package.json
    index.html
    vite.config.ts
    tsconfig.json
    playwright.config.ts
    src/
      main.tsx
      App.tsx
      app.css
      components/
        AppShell.tsx
        DemoCard.tsx
        EventLog.tsx
        IconWall.tsx
        ThemeSwitcher.tsx
      demos/
        componentCatalog.tsx
        productionDashboard.tsx
    tests/
      app.test.tsx
    e2e/
      showcase.spec.ts

  vue-showcase/
    package.json
    index.html
    vite.config.ts
    tsconfig.json
    playwright.config.ts
    src/
      main.ts
      App.vue
      app.css
      components/
        AppShell.vue
        DemoCard.vue
        EventLog.vue
        IconWall.vue
        ThemeSwitcher.vue
      demos/
        componentCatalog.ts
    tests/
      app.test.ts
    e2e/
      showcase.spec.ts
```

---

# 4. 整体路线图

建议按 PR 分片：

```txt
PR 1: examples/showcase-shared
PR 2: examples/react-showcase
PR 3: examples/vue-showcase
PR 4: unit tests
PR 5: e2e tests
PR 6: CI/examples:check 接入
```

---

# 5. 需要新增依赖

根 `package.json` 当前已有 React、Vue、Vite、Vitest 等依赖。

建议新增 devDeps：

```json
{
  "devDependencies": {
    "@playwright/test": "^1.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.0.0",
    "@vitejs/plugin-react": "^5.0.0",
    "@vue/test-utils": "^2.0.0"
  }
}
```

版本你可以让 pnpm 自动解析最新版：

```bash
pnpm add -D @playwright/test @testing-library/jest-dom @testing-library/react @testing-library/user-event @vitejs/plugin-react @vue/test-utils -w
```

---

# 6. 根 `package.json` 脚本调整

在根 scripts 增加：

```json
{
  "scripts": {
    "showcase:react": "pnpm --filter @zeus-web/example-react-showcase dev",
    "showcase:vue": "pnpm --filter @zeus-web/example-vue-showcase dev",
    "showcase:build": "pnpm --filter @zeus-web/example-react-showcase build && pnpm --filter @zeus-web/example-vue-showcase build",
    "showcase:test": "pnpm --filter @zeus-web/example-react-showcase test && pnpm --filter @zeus-web/example-vue-showcase test",
    "showcase:e2e": "pnpm --filter @zeus-web/example-react-showcase e2e && pnpm --filter @zeus-web/example-vue-showcase e2e"
  }
}
```

并把 examples 检查增强成：

```json
{
  "scripts": {
    "examples:check": "pnpm examples:contract && pnpm -F \"@zeus-web/example-*\" check && pnpm showcase:build"
  }
}
```

---

# 7. Shared 包设计

## `examples/showcase-shared/package.json`

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
  }
}
```

## `examples/showcase-shared/src/components.ts`

```ts
export type ShowcaseGroup =
  | 'Actions'
  | 'Forms'
  | 'Layout'
  | 'Feedback'
  | 'Disclosure'
  | 'Navigation'
  | 'Media'

export interface ShowcaseComponent {
  name: string
  packageName: string
  group: ShowcaseGroup
  description: string
  hasReactRegistry: boolean
  hasVuePrimitive: boolean
  states: string[]
}

export const showcaseComponents: ShowcaseComponent[] = [
  {
    name: 'button',
    packageName: '@zeus-web/button',
    group: 'Actions',
    description: 'Actions, submits, icon buttons, loading states.',
    hasReactRegistry: true,
    hasVuePrimitive: true,
    states: [
      'default',
      'primary',
      'secondary',
      'outline',
      'ghost',
      'danger',
      'disabled',
      'loading',
    ],
  },
  {
    name: 'input',
    packageName: '@zeus-web/input',
    group: 'Forms',
    description:
      'Single-line text input with prefix/suffix and validation states.',
    hasReactRegistry: true,
    hasVuePrimitive: true,
    states: ['default', 'disabled', 'error', 'with-prefix', 'with-suffix'],
  },
  {
    name: 'checkbox',
    packageName: '@zeus-web/checkbox',
    group: 'Forms',
    description: 'Boolean choice with checked and indeterminate states.',
    hasReactRegistry: true,
    hasVuePrimitive: true,
    states: ['unchecked', 'checked', 'indeterminate', 'disabled'],
  },
  {
    name: 'switch',
    packageName: '@zeus-web/switch',
    group: 'Forms',
    description: 'On/off settings control.',
    hasReactRegistry: true,
    hasVuePrimitive: true,
    states: ['off', 'on', 'disabled'],
  },
  {
    name: 'tabs',
    packageName: '@zeus-web/tabs',
    group: 'Navigation',
    description: 'Tab list, triggers and content panels.',
    hasReactRegistry: true,
    hasVuePrimitive: true,
    states: ['default', 'vertical', 'disabled'],
  },
  {
    name: 'dialog',
    packageName: '@zeus-web/dialog',
    group: 'Feedback',
    description: 'Modal dialog with title, description and close control.',
    hasReactRegistry: true,
    hasVuePrimitive: true,
    states: ['closed', 'open', 'modal'],
  },
  {
    name: 'label',
    packageName: '@zeus-web/label',
    group: 'Forms',
    description: 'Accessible form label.',
    hasReactRegistry: true,
    hasVuePrimitive: true,
    states: ['default', 'required', 'disabled', 'visually-hidden'],
  },
  {
    name: 'textarea',
    packageName: '@zeus-web/textarea',
    group: 'Forms',
    description: 'Multi-line input with message slot.',
    hasReactRegistry: true,
    hasVuePrimitive: true,
    states: ['default', 'disabled', 'error', 'with-message'],
  },
  {
    name: 'radio-group',
    packageName: '@zeus-web/radio-group',
    group: 'Forms',
    description: 'Single choice list.',
    hasReactRegistry: true,
    hasVuePrimitive: true,
    states: ['default', 'horizontal', 'disabled'],
  },
  {
    name: 'select',
    packageName: '@zeus-web/select',
    group: 'Forms',
    description: 'Native select styled primitive.',
    hasReactRegistry: true,
    hasVuePrimitive: true,
    states: ['default', 'disabled', 'error'],
  },
  {
    name: 'card',
    packageName: '@zeus-web/card',
    group: 'Layout',
    description: 'Surface container for content groups.',
    hasReactRegistry: true,
    hasVuePrimitive: true,
    states: ['default', 'interactive', 'muted'],
  },
  {
    name: 'badge',
    packageName: '@zeus-web/badge',
    group: 'Feedback',
    description: 'Small status and label token.',
    hasReactRegistry: true,
    hasVuePrimitive: true,
    states: ['default', 'secondary', 'outline', 'danger'],
  },
  {
    name: 'separator',
    packageName: '@zeus-web/separator',
    group: 'Layout',
    description: 'Horizontal or vertical content separator.',
    hasReactRegistry: true,
    hasVuePrimitive: true,
    states: ['horizontal', 'vertical'],
  },
  {
    name: 'skeleton',
    packageName: '@zeus-web/skeleton',
    group: 'Feedback',
    description: 'Loading placeholder.',
    hasReactRegistry: true,
    hasVuePrimitive: true,
    states: ['text', 'avatar', 'card'],
  },
  {
    name: 'alert',
    packageName: '@zeus-web/alert',
    group: 'Feedback',
    description: 'Inline feedback with title and description.',
    hasReactRegistry: true,
    hasVuePrimitive: true,
    states: ['info', 'success', 'warning', 'danger'],
  },
  {
    name: 'collapsible',
    packageName: '@zeus-web/collapsible',
    group: 'Disclosure',
    description: 'Expandable content region.',
    hasReactRegistry: true,
    hasVuePrimitive: true,
    states: ['closed', 'open'],
  },
  {
    name: 'accordion',
    packageName: '@zeus-web/accordion',
    group: 'Disclosure',
    description: 'Stacked expandable sections.',
    hasReactRegistry: true,
    hasVuePrimitive: true,
    states: ['single', 'multiple', 'disabled'],
  },
  {
    name: 'tooltip',
    packageName: '@zeus-web/tooltip',
    group: 'Feedback',
    description: 'Contextual hover/focus help.',
    hasReactRegistry: true,
    hasVuePrimitive: true,
    states: ['default', 'delay', 'disabled'],
  },
  {
    name: 'progress',
    packageName: '@zeus-web/progress',
    group: 'Feedback',
    description: 'Progress indicator.',
    hasReactRegistry: true,
    hasVuePrimitive: true,
    states: ['0', '25', '50', '75', '100'],
  },
  {
    name: 'avatar',
    packageName: '@zeus-web/avatar',
    group: 'Media',
    description: 'User image with fallback.',
    hasReactRegistry: true,
    hasVuePrimitive: true,
    states: ['image', 'fallback', 'group'],
  },
]

export const deferredComponents = ['popover', 'dropdown', 'toast'] as const
```

## `examples/showcase-shared/src/themes.ts`

```ts
export const showcaseThemes = [
  {
    name: 'default',
    label: 'Default',
    cssImport: '@zeus-web/themes/default.css',
  },
  {
    name: 'slate',
    label: 'Slate',
    cssImport: '@zeus-web/themes/slate.css',
  },
  {
    name: 'zinc',
    label: 'Zinc',
    cssImport: '@zeus-web/themes/zinc.css',
  },
  {
    name: 'neutral',
    label: 'Neutral',
    cssImport: '@zeus-web/themes/neutral.css',
  },
  {
    name: 'stone',
    label: 'Stone',
    cssImport: '@zeus-web/themes/stone.css',
  },
] as const

export type ShowcaseThemeName = (typeof showcaseThemes)[number]['name']
```

## `examples/showcase-shared/src/icons.ts`

```ts
export const showcaseIcons = [
  'check',
  'x',
  'plus',
  'minus',
  'chevron-down',
  'chevron-up',
  'chevron-left',
  'chevron-right',
  'search',
  'menu',
  'settings',
  'user',
  'copy',
  'external-link',
  'info',
  'alert-triangle',
  'circle-check',
  'circle-x',
  'loader',
  'sun',
  'moon',
  'eye',
  'eye-off',
  'trash',
] as const
```

## `examples/showcase-shared/src/index.ts`

```ts
export * from './components'
export * from './icons'
export * from './themes'
```

---

# 8. React Showcase

## `examples/react-showcase/package.json`

```json
{
  "name": "@zeus-web/example-react-showcase",
  "type": "module",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "prepare:registry": "zweb init --cwd . --style slate --css src/app.css --yes && zweb add --cwd . --all --yes --no-install",
    "dev": "pnpm prepare:registry && vite --host 0.0.0.0",
    "build": "pnpm prepare:registry && vite build",
    "check": "tsc -p tsconfig.json --noEmit",
    "test": "vitest --run",
    "e2e": "playwright test"
  },
  "dependencies": {
    "@zeus-web/cli": "workspace:*",
    "@zeus-web/example-showcase-shared": "workspace:*",
    "@zeus-web/icons": "workspace:*",
    "@zeus-web/themes": "workspace:*",
    "@zeus-web/registry": "workspace:*",
    "react": "^19.2.17",
    "react-dom": "^19.2.17"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^5.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.0.0",
    "@playwright/test": "^1.0.0"
  }
}
```

## `examples/react-showcase/vite.config.ts`

```ts
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { defineConfig } from 'vite'

const root = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(root, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test.setup.ts'],
  },
})
```

## `examples/react-showcase/src/main.tsx`

```tsx
import React from 'react'
import { createRoot } from 'react-dom/client'

import '@zeus-web/themes/default.css'
import './app.css'

import { App } from './App'

const root = document.getElementById('root')

if (!root) {
  throw new Error('Missing #root')
}

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

## `examples/react-showcase/src/App.tsx`

```tsx
import { useMemo, useState } from 'react'
import {
  deferredComponents,
  showcaseComponents,
} from '@zeus-web/example-showcase-shared'
import {
  IconCheck,
  IconMoon,
  IconSearch,
  IconSettings,
  IconSun,
} from '@zeus-web/icons/react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

import { ComponentGallery } from './demos/componentCatalog'
import { ProductionDashboard } from './demos/productionDashboard'
import { IconWall } from './components/IconWall'
import { ThemeSwitcher } from './components/ThemeSwitcher'

export function App() {
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState('dashboard')

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()

    if (!normalized) return showcaseComponents

    return showcaseComponents.filter(item => {
      return (
        item.name.includes(normalized) ||
        item.group.toLowerCase().includes(normalized) ||
        item.description.toLowerCase().includes(normalized)
      )
    })
  }, [query])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-6">
          <div className="flex items-center gap-2 font-semibold">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <IconCheck aria-hidden="true" className="size-4" />
            </span>
            Zeus Web Showcase
          </div>

          <div className="ml-auto flex items-center gap-3">
            <div className="relative hidden md:block">
              <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search components"
                className="w-72 pl-9"
                placeholder="Search components..."
                value={query}
                onChange={event => setQuery(event.currentTarget.value)}
              />
            </div>

            <ThemeSwitcher />

            <Button variant="outline" size="icon" aria-label="Settings">
              <IconSettings aria-hidden="true" className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[260px_1fr]">
        <aside className="hidden lg:block">
          <Card>
            <CardHeader>
              <CardTitle>Coverage</CardTitle>
              <CardDescription>Current beta component scope.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Metric
                label="Components"
                value={String(showcaseComponents.length)}
              />
              <Metric label="Visible now" value={String(filtered.length)} />
              <Metric
                label="Deferred"
                value={String(deferredComponents.length)}
              />

              <Separator />

              <div className="space-y-2">
                {deferredComponents.map(name => (
                  <Badge key={name} variant="outline">
                    {name} deferred
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </aside>

        <section className="min-w-0">
          <Alert className="mb-6">
            <IconSun aria-hidden="true" className="size-4" />
            <AlertTitle>Production showcase</AlertTitle>
            <AlertDescription>
              This app renders the registry components, theme tokens and icon
              set in realistic layouts.
            </AlertDescription>
          </Alert>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="components">Components</TabsTrigger>
              <TabsTrigger value="icons">Icons</TabsTrigger>
              <TabsTrigger value="tokens">Theme</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard">
              <ProductionDashboard />
            </TabsContent>

            <TabsContent value="components">
              <ComponentGallery components={filtered} />
            </TabsContent>

            <TabsContent value="icons">
              <IconWall />
            </TabsContent>

            <TabsContent value="tokens">
              <Card>
                <CardHeader>
                  <CardTitle>Theme tokens</CardTitle>
                  <CardDescription>
                    Switch styles and verify semantic tokens visually.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2">
                  <Token
                    name="background"
                    className="bg-background text-foreground"
                  />
                  <Token
                    name="primary"
                    className="bg-primary text-primary-foreground"
                  />
                  <Token
                    name="muted"
                    className="bg-muted text-muted-foreground"
                  />
                  <Token
                    name="destructive"
                    className="bg-destructive text-destructive-foreground"
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </section>
      </main>
    </div>
  )
}

function Metric(props: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{props.label}</span>
      <span className="font-medium">{props.value}</span>
    </div>
  )
}

function Token(props: { name: string; className: string }) {
  return (
    <div className={`rounded-xl border p-4 ${props.className}`}>
      <div className="font-medium">{props.name}</div>
      <div className="text-sm opacity-80">Semantic design token preview</div>
    </div>
  )
}
```

## `examples/react-showcase/src/demos/componentCatalog.tsx`

这里不需要把每个组件的所有源码贴死，可以用 registry 生成的本地组件展示。核心是每个组件至少展示 default/disabled/variant/event。

```tsx
import type { ShowcaseComponent } from '@zeus-web/example-showcase-shared'

import { useState } from 'react'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export function ComponentGallery(props: { components: ShowcaseComponent[] }) {
  return (
    <div className="grid gap-4">
      {props.components.map(component => (
        <Card key={component.name} id={component.name}>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>{component.name}</CardTitle>
                <CardDescription>{component.description}</CardDescription>
              </div>
              <Badge variant="outline">{component.group}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ComponentDemo name={component.name} />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function ComponentDemo(props: { name: string }) {
  switch (props.name) {
    case 'button':
      return (
        <DemoGrid>
          <Button>Default</Button>
          <Button variant="primary">Primary</Button>
          <Button variant="outline">Outline</Button>
          <Button disabled>Disabled</Button>
        </DemoGrid>
      )

    case 'input':
      return (
        <DemoGrid>
          <Input placeholder="Email" />
          <Input disabled placeholder="Disabled" />
          <Input aria-invalid placeholder="Invalid" />
        </DemoGrid>
      )

    case 'checkbox':
      return (
        <DemoGrid>
          <Checkbox>Accept terms</Checkbox>
          <Checkbox defaultChecked>Checked</Checkbox>
          <Checkbox disabled>Disabled</Checkbox>
        </DemoGrid>
      )

    case 'switch':
      return (
        <DemoGrid>
          <Switch>Notifications</Switch>
          <Switch defaultChecked>Enabled</Switch>
          <Switch disabled>Disabled</Switch>
        </DemoGrid>
      )

    case 'tabs':
      return (
        <Tabs defaultValue="a">
          <TabsList>
            <TabsTrigger value="a">Overview</TabsTrigger>
            <TabsTrigger value="b">Usage</TabsTrigger>
          </TabsList>
          <TabsContent value="a">Overview panel</TabsContent>
          <TabsContent value="b">Usage panel</TabsContent>
        </Tabs>
      )

    case 'dialog':
      return (
        <Dialog>
          <DialogTrigger>
            <Button variant="outline">Open dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Production dialog</DialogTitle>
            <DialogDescription>
              Dialog content with focus management and close behavior.
            </DialogDescription>
          </DialogContent>
        </Dialog>
      )

    case 'label':
      return (
        <DemoGrid>
          <div>
            <Label for="email">Email</Label>
            <Input id="email" placeholder="user@example.com" />
          </div>
        </DemoGrid>
      )

    case 'textarea':
      return <Textarea placeholder="Write a deployment note..." />

    case 'radio-group':
      return (
        <RadioGroup defaultValue="daily">
          <RadioGroupItem value="daily">Daily</RadioGroupItem>
          <RadioGroupItem value="weekly">Weekly</RadioGroupItem>
          <RadioGroupItem value="monthly">Monthly</RadioGroupItem>
        </RadioGroup>
      )

    case 'select':
      return (
        <Select defaultValue="production">
          <option value="production">Production</option>
          <option value="staging">Staging</option>
          <option value="development">Development</option>
        </Select>
      )

    case 'card':
      return (
        <Card>
          <CardHeader>
            <CardTitle>Nested card</CardTitle>
            <CardDescription>Cards compose layouts.</CardDescription>
          </CardHeader>
          <CardContent>Card body</CardContent>
        </Card>
      )

    case 'badge':
      return (
        <DemoGrid>
          <Badge>Default</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="secondary">Secondary</Badge>
        </DemoGrid>
      )

    case 'separator':
      return (
        <div className="space-y-3">
          <div>Before</div>
          <Separator />
          <div>After</div>
        </div>
      )

    case 'skeleton':
      return (
        <div className="space-y-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-20 w-full" />
        </div>
      )

    case 'alert':
      return (
        <Alert>
          <AlertTitle>Heads up</AlertTitle>
          <AlertDescription>This alert uses theme tokens.</AlertDescription>
        </Alert>
      )

    case 'collapsible':
      return (
        <Collapsible>
          <CollapsibleTrigger>
            <Button variant="outline">Toggle details</Button>
          </CollapsibleTrigger>
          <CollapsibleContent>Hidden operational details.</CollapsibleContent>
        </Collapsible>
      )

    case 'accordion':
      return (
        <Accordion type="single" collapsible>
          <AccordionItem value="one">
            <AccordionTrigger>What is Zeus Web?</AccordionTrigger>
            <AccordionContent>
              A multi-framework component system.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )

    case 'tooltip':
      return (
        <Tooltip>
          <TooltipTrigger>
            <Button variant="outline">Hover me</Button>
          </TooltipTrigger>
          <TooltipContent>Tooltip content</TooltipContent>
        </Tooltip>
      )

    case 'progress':
      return <Progress value={64} />

    case 'avatar':
      return (
        <Avatar>
          <AvatarFallback>ZW</AvatarFallback>
        </Avatar>
      )

    default:
      return (
        <div className="text-sm text-muted-foreground">No demo registered.</div>
      )
  }
}

function DemoGrid(props: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">{props.children}</div>
  )
}
```

---

# 9. Vue Showcase

Vue showcase 不用 registry TSX，而是展示 Vue wrappers。

## `examples/vue-showcase/package.json`

```json
{
  "name": "@zeus-web/example-vue-showcase",
  "type": "module",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "vite build",
    "check": "vue-tsc --noEmit",
    "test": "vitest --run",
    "e2e": "playwright test"
  },
  "dependencies": {
    "@zeus-web/example-showcase-shared": "workspace:*",
    "@zeus-web/icons": "workspace:*",
    "@zeus-web/themes": "workspace:*",
    "@zeus-web/button": "workspace:*",
    "@zeus-web/input": "workspace:*",
    "@zeus-web/checkbox": "workspace:*",
    "@zeus-web/switch": "workspace:*",
    "@zeus-web/tabs": "workspace:*",
    "@zeus-web/dialog": "workspace:*",
    "@zeus-web/label": "workspace:*",
    "@zeus-web/textarea": "workspace:*",
    "@zeus-web/radio-group": "workspace:*",
    "@zeus-web/select": "workspace:*",
    "@zeus-web/card": "workspace:*",
    "@zeus-web/badge": "workspace:*",
    "@zeus-web/separator": "workspace:*",
    "@zeus-web/skeleton": "workspace:*",
    "@zeus-web/alert": "workspace:*",
    "@zeus-web/collapsible": "workspace:*",
    "@zeus-web/accordion": "workspace:*",
    "@zeus-web/tooltip": "workspace:*",
    "@zeus-web/progress": "workspace:*",
    "@zeus-web/avatar": "workspace:*",
    "vue": "^3.5.35"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^6.0.0",
    "@vue/test-utils": "^2.0.0",
    "@playwright/test": "^1.0.0",
    "vue-tsc": "^3.0.0"
  }
}
```

## `examples/vue-showcase/vite.config.ts`

```ts
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { defineConfig } from 'vite'

const root = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(root, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
  },
})
```

## `examples/vue-showcase/src/main.ts`

```ts
import { createApp } from 'vue'

import '@zeus-web/themes/default.css'
import './app.css'

import App from './App.vue'

createApp(App).mount('#app')
```

## `examples/vue-showcase/src/App.vue`

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  showcaseComponents,
  deferredComponents,
} from '@zeus-web/example-showcase-shared'
import { IconCheck, IconSearch, IconSettings } from '@zeus-web/icons/vue'

import ComponentGallery from './demos/ComponentGallery.vue'
import IconWall from './components/IconWall.vue'
import ThemeSwitcher from './components/ThemeSwitcher.vue'

const query = ref('')
const tab = ref<'dashboard' | 'components' | 'icons' | 'tokens'>('dashboard')

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()

  if (!q) return showcaseComponents

  return showcaseComponents.filter(item => {
    return (
      item.name.includes(q) ||
      item.group.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q)
    )
  })
})
</script>

<template>
  <div class="min-h-screen bg-background text-foreground">
    <header class="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
      <div class="mx-auto flex h-16 max-w-7xl items-center gap-4 px-6">
        <div class="flex items-center gap-2 font-semibold">
          <span
            class="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground"
          >
            <IconCheck aria-hidden="true" class="size-4" />
          </span>
          Zeus Web Vue Showcase
        </div>

        <div class="ml-auto flex items-center gap-3">
          <div class="relative hidden md:block">
            <IconSearch
              class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              v-model="query"
              aria-label="Search components"
              class="h-10 w-72 rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none ring-ring focus:ring-2"
              placeholder="Search components..."
            />
          </div>

          <ThemeSwitcher />

          <button
            class="grid size-10 place-items-center rounded-md border border-input hover:bg-muted"
            aria-label="Settings"
          >
            <IconSettings aria-hidden="true" class="size-4" />
          </button>
        </div>
      </div>
    </header>

    <main
      class="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[260px_1fr]"
    >
      <aside class="hidden lg:block">
        <section class="rounded-xl border bg-card p-5 shadow-sm">
          <h2 class="font-semibold">Coverage</h2>
          <p class="mt-1 text-sm text-muted-foreground">
            Current beta component scope.
          </p>

          <div class="mt-5 space-y-3 text-sm">
            <div class="flex justify-between">
              <span class="text-muted-foreground">Components</span>
              <strong>{{ showcaseComponents.length }}</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-muted-foreground">Visible now</span>
              <strong>{{ filtered.length }}</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-muted-foreground">Deferred</span>
              <strong>{{ deferredComponents.length }}</strong>
            </div>
          </div>
        </section>
      </aside>

      <section class="min-w-0">
        <div class="mb-6 rounded-xl border bg-card p-4">
          <div class="font-medium">Production Vue showcase</div>
          <p class="text-sm text-muted-foreground">
            This app renders Vue primitives, theme tokens and icons in realistic
            layouts.
          </p>
        </div>

        <div class="mb-6 flex flex-wrap gap-2">
          <button
            class="tab"
            :data-active="tab === 'dashboard'"
            @click="tab = 'dashboard'"
          >
            Dashboard
          </button>
          <button
            class="tab"
            :data-active="tab === 'components'"
            @click="tab = 'components'"
          >
            Components
          </button>
          <button
            class="tab"
            :data-active="tab === 'icons'"
            @click="tab = 'icons'"
          >
            Icons
          </button>
          <button
            class="tab"
            :data-active="tab === 'tokens'"
            @click="tab = 'tokens'"
          >
            Theme
          </button>
        </div>

        <section v-if="tab === 'dashboard'" class="grid gap-4 md:grid-cols-3">
          <div class="rounded-xl border bg-card p-5">
            <div class="text-sm text-muted-foreground">Deployments</div>
            <div class="mt-2 text-3xl font-semibold">128</div>
          </div>
          <div class="rounded-xl border bg-card p-5">
            <div class="text-sm text-muted-foreground">Success rate</div>
            <div class="mt-2 text-3xl font-semibold">99.2%</div>
          </div>
          <div class="rounded-xl border bg-card p-5">
            <div class="text-sm text-muted-foreground">Open alerts</div>
            <div class="mt-2 text-3xl font-semibold">4</div>
          </div>
        </section>

        <ComponentGallery
          v-else-if="tab === 'components'"
          :components="filtered"
        />
        <IconWall v-else-if="tab === 'icons'" />

        <section v-else class="grid gap-3 md:grid-cols-2">
          <div class="rounded-xl border bg-background p-4 text-foreground">
            background
          </div>
          <div class="rounded-xl border bg-primary p-4 text-primary-foreground">
            primary
          </div>
          <div class="rounded-xl border bg-muted p-4 text-muted-foreground">
            muted
          </div>
          <div
            class="rounded-xl border bg-destructive p-4 text-destructive-foreground"
          >
            destructive
          </div>
        </section>
      </section>
    </main>
  </div>
</template>
```

---

# 10. 测试设计

## React unit test

`examples/react-showcase/tests/app.test.tsx`

```tsx
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { App } from '../src/App'

describe('React showcase', () => {
  it('renders production dashboard', () => {
    render(<App />)

    expect(screen.getByText('Zeus Web Showcase')).toBeInTheDocument()
    expect(screen.getByText('Production showcase')).toBeInTheDocument()
  })

  it('filters components by search', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.type(screen.getByLabelText('Search components'), 'button')

    expect(screen.getByText('button')).toBeInTheDocument()
  })
})
```

## Vue unit test

`examples/vue-showcase/tests/app.test.ts`

```ts
import { mount } from '@vue/test-utils'

import App from '../src/App.vue'

describe('Vue showcase', () => {
  it('renders production shell', () => {
    const wrapper = mount(App)

    expect(wrapper.text()).toContain('Zeus Web Vue Showcase')
    expect(wrapper.text()).toContain('Production Vue showcase')
  })

  it('filters components by search', async () => {
    const wrapper = mount(App)
    const input = wrapper.get('input[aria-label="Search components"]')

    await input.setValue('button')

    expect(wrapper.text()).toContain('button')
  })
})
```

---

# 11. E2E 设计

## React E2E

`examples/react-showcase/e2e/showcase.spec.ts`

```ts
import { expect, test } from '@playwright/test'

test('renders React showcase and component gallery', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByText('Zeus Web Showcase')).toBeVisible()
  await page.getByRole('tab', { name: 'Components' }).click()

  await expect(page.getByText('button')).toBeVisible()
  await expect(page.getByText('input')).toBeVisible()
  await expect(page.getByText('dialog')).toBeVisible()
})

test('searches component gallery', async ({ page }) => {
  await page.goto('/')

  await page.getByLabel('Search components').fill('tooltip')
  await page.getByRole('tab', { name: 'Components' }).click()

  await expect(page.getByText('tooltip')).toBeVisible()
})
```

## Vue E2E

`examples/vue-showcase/e2e/showcase.spec.ts`

```ts
import { expect, test } from '@playwright/test'

test('renders Vue showcase', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByText('Zeus Web Vue Showcase')).toBeVisible()
  await expect(page.getByText('Production Vue showcase')).toBeVisible()
})

test('opens component tab and filters', async ({ page }) => {
  await page.goto('/')

  await page.getByLabel('Search components').fill('accordion')
  await page.getByRole('button', { name: 'Components' }).click()

  await expect(page.getByText('accordion')).toBeVisible()
})
```

## Playwright config

每个 example 放一份：

```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  webServer: {
    command: 'pnpm dev',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
  },
})
```

Vue 的端口建议改成 5174：

```ts
webServer: {
  command: 'vite --host 0.0.0.0 --port 5174',
  url: 'http://127.0.0.1:5174',
}
```

---

# 12. CI 接入建议

当前 CI 已经跑 `site:check` 和 `release:verify --allow-zero`。

建议加一个单独 showcase job：

```yaml
showcase:
  runs-on: ubuntu-latest
  env:
    PUPPETEER_SKIP_DOWNLOAD: 'true'
  steps:
    - uses: actions/checkout@v5
    - uses: pnpm/action-setup@v4
    - uses: actions/setup-node@v5
      with:
        node-version-file: .node-version
        cache: pnpm

    - run: pnpm install --frozen-lockfile
    - run: pnpm exec playwright install --with-deps chromium
    - run: pnpm showcase:build
    - run: pnpm showcase:test
    - run: pnpm showcase:e2e
```

---

# 13. 最终路线图

## PR 1：Shared showcase data

```txt
新增 examples/showcase-shared
沉淀组件列表、主题列表、图标列表
examples/react/vue 共用
```

验收：

```bash
pnpm --filter @zeus-web/example-showcase-shared check
```

## PR 2：React Showcase

```txt
新增 examples/react-showcase
使用 zweb init + zweb add --all 生成 registry components
实现 production dashboard + component gallery + icon wall + theme lab
```

验收：

```bash
pnpm showcase:react
pnpm --filter @zeus-web/example-react-showcase build
pnpm --filter @zeus-web/example-react-showcase test
```

## PR 3：Vue Showcase

```txt
新增 examples/vue-showcase
使用 @zeus-web/*/vue + @zeus-web/icons/vue + themes
实现同等视觉展示
```

验收：

```bash
pnpm showcase:vue
pnpm --filter @zeus-web/example-vue-showcase build
pnpm --filter @zeus-web/example-vue-showcase test
```

## PR 4：E2E

```txt
引入 Playwright
覆盖 React/Vue app shell、组件搜索、主题切换、dialog、icon wall
```

验收：

```bash
pnpm showcase:e2e
```

## PR 5：CI 集成

```txt
showcase:build
showcase:test
showcase:e2e
接入 CI
```

验收：

```bash
pnpm site:check
pnpm showcase:build
pnpm showcase:test
pnpm showcase:e2e
```

---

# 结论

这两个 example 应该承担两个职责：

```txt
React Showcase：证明 registry + CLI source-copy 生产模式可用。
Vue Showcase：证明 per-component Vue wrappers + themes + icons 可用。
```

这比简单 demo 更有价值，因为它能同时验证：

```txt
组件能力
样式 token
icons
CLI
registry
React 包装产物
Vue 包装产物
单测
E2E
CI
```

建议分支名：

```txt
feat/showcase-react-vue-examples
```

PR title：

```txt
feat(examples): add production React and Vue showcase apps
```

Showcase implementation roadmap

Recommended implementation slices for the React and Vue production showcase examples.

phase weight
Shared data and coverage contracts 2
React production showcase 5
Vue primitive showcase 5
Icon and theme visual labs 3
Unit tests 3
E2E tests and CI integration 4
