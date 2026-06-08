下面给 **Phase 9.4：Interactive Playground MVP** 的详细设计与完整代码。

基于当前 `mvp / 0ddebac` 状态，文档链路已经比较完整：根脚本已有 `docs:generate / docs:check-generated / docs:check / site:check`。
组件文档也已经从 `@zeus-web/ai` metadata 和 registry 自动生成，并输出到 `apps/docs/components/index.md` 与 6 个组件页。
所以 Phase 9.4 不应该继续手写 API 文档，而应该补一个 **docs 内置交互式 Playground**，验证真实组件在文档站内能跑。

---

# Phase 9.4 目标

```txt
Phase 9.4：Interactive Playground MVP

目标：
1. 在 VitePress docs 中新增 /playground/ 页面。
2. 新增 VitePress Vue 组件 ZeusPlayground.vue。
3. Playground 使用 @zeus-web/<name>/wc 真实 Web Component 入口。
4. 覆盖 button/input/checkbox/switch/tabs/dialog 六个 MVP 组件。
5. 支持 light/dark 切换。
6. 支持 compact/default/large density 切换。
7. 展示事件日志：press/value-change/checked-change/open-change。
8. 提供 playground contract check，防止入口、文档路由和 WC import 漂移。
9. 接入 docs:check。
```

Phase 9.4 不做：

```txt
不做 Monaco 在线代码编辑器。
不做 iframe sandbox。
不做 React live playground。
不做 Vue playground。
不做远程 registry 动态加载。
不做截图测试。
```

原因：当前 docs 是 VitePress，VitePress 本身是 Vue 应用；在 docs 里直接挂 React live runtime 会增加复杂度。最稳的做法是用 **Web Components 入口** 作为 Playground 第一版，这也能验证 `@zeus-web/<name>/wc` 产物真实可用。

---

# 1. 文件变更总览

```txt
新增：
  apps/docs/playground/index.md
  apps/docs/.vitepress/theme/components/ZeusPlayground.vue
  scripts/checks/check-playground.ts

修改：
  apps/docs/.vitepress/data/site.ts
  apps/docs/.vitepress/theme/index.ts
  apps/docs/.vitepress/theme/style.css
  package.json
```

---

# 2. 修改根 `package.json`

当前 `docs:check` 已经是：

```json
"docs:check": "pnpm docs:check-generated && tsx scripts/checks/check-docs.ts && pnpm --filter \"@zeus-web/docs\" check"
```

需要把 playground contract 加进去。

替换 docs 相关 scripts：

```json
{
  "docs:dev": "vitepress dev apps/docs",
  "docs:build": "vitepress build apps/docs",
  "docs:preview": "vitepress preview apps/docs",
  "docs:generate": "tsx scripts/commands/generate-docs.ts",
  "docs:check-generated": "tsx scripts/checks/check-generated-docs.ts",
  "docs:check-playground": "tsx scripts/checks/check-playground.ts",
  "docs:check": "pnpm docs:check-generated && tsx scripts/checks/check-docs.ts && pnpm docs:check-playground && pnpm --filter \"@zeus-web/docs\" check",
  "examples:contract": "tsx scripts/checks/check-examples.ts",
  "examples:check": "pnpm examples:contract && pnpm -F \"@zeus-web/example-*\" check",
  "examples:build": "pnpm -F \"@zeus-web/example-*\" build",
  "site:check": "pnpm docs:check && pnpm docs:build && pnpm examples:check",
  "site:build": "pnpm docs:build && pnpm examples:build"
}
```

---

# 3. 修改 docs 导航

## 替换 `apps/docs/.vitepress/data/site.ts`

```ts
export interface DocsNavItem {
  text: string
  link: string
}

export interface DocsSidebarGroup {
  text: string
  items: DocsNavItem[]
}

export interface ComponentDoc {
  name: string
  title: string
  packageName: string
  addCommand: string
  route: string
  description: string
}

export const guideItems: DocsNavItem[] = [
  {
    text: 'Getting Started',
    link: '/guide/getting-started',
  },
  {
    text: 'CLI',
    link: '/guide/cli',
  },
  {
    text: 'Theming',
    link: '/guide/theming',
  },
  {
    text: 'Registry',
    link: '/guide/registry',
  },
  {
    text: 'AI',
    link: '/guide/ai',
  },
]

export const componentDocs: ComponentDoc[] = [
  {
    name: 'button',
    title: 'Button',
    packageName: '@zeus-web/button',
    addCommand: 'zweb add button',
    route: '/components/button',
    description: 'Action component built on the zw-button primitive.',
  },
  {
    name: 'input',
    title: 'Input',
    packageName: '@zeus-web/input',
    addCommand: 'zweb add input',
    route: '/components/input',
    description: 'Text field component built on the zw-input primitive.',
  },
  {
    name: 'checkbox',
    title: 'Checkbox',
    packageName: '@zeus-web/checkbox',
    addCommand: 'zweb add checkbox',
    route: '/components/checkbox',
    description:
      'Boolean selection component built on the zw-checkbox primitive.',
  },
  {
    name: 'switch',
    title: 'Switch',
    packageName: '@zeus-web/switch',
    addCommand: 'zweb add switch',
    route: '/components/switch',
    description: 'On/off setting component built on the zw-switch primitive.',
  },
  {
    name: 'tabs',
    title: 'Tabs',
    packageName: '@zeus-web/tabs',
    addCommand: 'zweb add tabs',
    route: '/components/tabs',
    description:
      'Tabbed interface component family built on zw-tabs primitives.',
  },
  {
    name: 'dialog',
    title: 'Dialog',
    packageName: '@zeus-web/dialog',
    addCommand: 'zweb add dialog',
    route: '/components/dialog',
    description: 'Dialog component family built on the zw-dialog primitive.',
  },
]

export const exampleItems: DocsNavItem[] = [
  {
    text: 'React Vite',
    link: '/examples/react-vite',
  },
  {
    text: 'Next.js App Router',
    link: '/examples/next-app',
  },
  {
    text: 'Native Web Components',
    link: '/examples/native-wc',
  },
]

export const playgroundItems: DocsNavItem[] = [
  {
    text: 'Interactive Playground',
    link: '/playground/',
  },
]

export const componentIndexItem: DocsNavItem = {
  text: 'Overview',
  link: '/components/',
}

export const sidebar: DocsSidebarGroup[] = [
  {
    text: 'Guide',
    items: guideItems,
  },
  {
    text: 'Components',
    items: [
      componentIndexItem,
      ...componentDocs.map(component => ({
        text: component.title,
        link: component.route,
      })),
    ],
  },
  {
    text: 'Playground',
    items: playgroundItems,
  },
  {
    text: 'Examples',
    items: exampleItems,
  },
]

export const topNav: DocsNavItem[] = [
  {
    text: 'Guide',
    link: '/guide/getting-started',
  },
  {
    text: 'Components',
    link: '/components/',
  },
  {
    text: 'Playground',
    link: '/playground/',
  },
  {
    text: 'Examples',
    link: '/examples/react-vite',
  },
]
```

---

# 4. 修改 VitePress theme 注册组件

当前自定义 theme 已经存在，并且 `theme/index.ts` 引入 `style.css`。
Phase 9.4 需要把 `ZeusPlayground` 注册成全局组件。

## 替换 `apps/docs/.vitepress/theme/index.ts`

```ts
import type { Theme } from 'vitepress'

import DefaultTheme from 'vitepress/theme'
import ZeusPlayground from './components/ZeusPlayground.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('ZeusPlayground', ZeusPlayground)
  },
} satisfies Theme
```

---

# 5. 新增 Playground 页面

## `apps/docs/playground/index.md`

````md
# Interactive Playground

This playground renders the real Zeus Web Web Component entries inside the VitePress docs app.

It validates:

```txt
1. @zeus-web/<component>/wc imports.
2. Button, Input, Checkbox, Switch, Tabs and Dialog rendering.
3. Custom events emitted by primitives.
4. Theme and density controls in a docs environment.
```
````

<ZeusPlayground />

## Notes

The docs playground intentionally uses Web Components instead of React wrappers because VitePress is a Vue application.

React usage is validated separately by:

```bash
pnpm --filter @zeus-web/example-react-vite build
pnpm --filter @zeus-web/example-next-app build
```

````

---

# 6. 新增 Playground Vue 组件

## `apps/docs/.vitepress/theme/components/ZeusPlayground.vue`

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'

import '@zeus-web/button/wc'
import '@zeus-web/checkbox/wc'
import '@zeus-web/dialog/wc'
import '@zeus-web/input/wc'
import '@zeus-web/switch/wc'
import '@zeus-web/tabs/wc'

type PlaygroundTheme = 'light' | 'dark'
type PlaygroundDensity = 'default' | 'compact' | 'large'

interface EventLog {
  id: number
  name: string
  detail: string
}

const theme = ref<PlaygroundTheme>('light')
const density = ref<PlaygroundDensity>('default')
const inputValue = ref('')
const checked = ref(false)
const switched = ref(false)
const dialogOpen = ref(false)
const logs = ref<EventLog[]>([])

let logId = 0

const playgroundClass = computed(() => {
  return [
    'zeus-playground',
    `zeus-playground--${theme.value}`,
    `zeus-playground--${density.value}`,
  ]
})

function stringifyDetail(detail: unknown): string {
  if (!detail || typeof detail !== 'object') {
    return String(detail ?? '')
  }

  try {
    return JSON.stringify(detail)
  } catch {
    return '[unserializable detail]'
  }
}

function pushLog(name: string, detail: unknown): void {
  logs.value = [
    {
      id: logId++,
      name,
      detail: stringifyDetail(detail),
    },
    ...logs.value,
  ].slice(0, 8)
}

function handlePress(event: Event): void {
  const customEvent = event as CustomEvent
  pushLog('press', customEvent.detail)
}

function handleValueChange(event: Event): void {
  const customEvent = event as CustomEvent<{ value?: string }>
  inputValue.value = customEvent.detail?.value ?? ''
  pushLog('value-change', customEvent.detail)
}

function handleCheckedChange(event: Event): void {
  const customEvent = event as CustomEvent<{ checked?: boolean }>
  checked.value = Boolean(customEvent.detail?.checked)
  pushLog('checked-change', customEvent.detail)
}

function handleSwitchChange(event: Event): void {
  const customEvent = event as CustomEvent<{ checked?: boolean }>
  switched.value = Boolean(customEvent.detail?.checked)
  pushLog('switch checked-change', customEvent.detail)
}

function handleOpenChange(event: Event): void {
  const customEvent = event as CustomEvent<{ open?: boolean }>
  dialogOpen.value = Boolean(customEvent.detail?.open)
  pushLog('open-change', customEvent.detail)
}

function clearLogs(): void {
  logs.value = []
}
</script>

<template>
  <section :class="playgroundClass">
    <div class="zeus-playground__toolbar">
      <div>
        <p class="zeus-playground__eyebrow">Live preview</p>
        <h2>Zeus Web Playground</h2>
      </div>

      <div class="zeus-playground__controls">
        <label>
          Theme
          <select v-model="theme">
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>

        <label>
          Density
          <select v-model="density">
            <option value="default">Default</option>
            <option value="compact">Compact</option>
            <option value="large">Large</option>
          </select>
        </label>
      </div>
    </div>

    <div class="zeus-playground__grid">
      <article class="zeus-playground__card">
        <h3>Button</h3>
        <div class="zeus-playground__row">
          <zw-button variant="primary" @press="handlePress">
            Primary
          </zw-button>
          <zw-button variant="outline" @press="handlePress">
            Outline
          </zw-button>
          <zw-button variant="danger" @press="handlePress">
            Danger
          </zw-button>
        </div>
      </article>

      <article class="zeus-playground__card">
        <h3>Input</h3>
        <zw-input
          placeholder="Email"
          type="email"
          @value-change="handleValueChange"
        />
        <p class="zeus-playground__hint">
          Current value: <code>{{ inputValue || 'empty' }}</code>
        </p>
      </article>

      <article class="zeus-playground__card">
        <h3>Selection</h3>
        <div class="zeus-playground__stack">
          <zw-checkbox @checked-change="handleCheckedChange">
            Accept terms
          </zw-checkbox>
          <zw-switch @checked-change="handleSwitchChange">
            Enable notifications
          </zw-switch>
        </div>
        <p class="zeus-playground__hint">
          Checkbox: <code>{{ checked ? 'checked' : 'unchecked' }}</code>
          · Switch: <code>{{ switched ? 'on' : 'off' }}</code>
        </p>
      </article>

      <article class="zeus-playground__card">
        <h3>Tabs</h3>
        <zw-tabs default-value="account">
          <zw-tabs-list>
            <zw-tabs-trigger value="account">Account</zw-tabs-trigger>
            <zw-tabs-trigger value="password">Password</zw-tabs-trigger>
          </zw-tabs-list>
          <zw-tabs-content value="account">
            Account panel
          </zw-tabs-content>
          <zw-tabs-content value="password">
            Password panel
          </zw-tabs-content>
        </zw-tabs>
      </article>

      <article class="zeus-playground__card">
        <h3>Dialog</h3>
        <zw-dialog @open-change="handleOpenChange">
          <zw-dialog-trigger>
            <zw-button>Open dialog</zw-button>
          </zw-dialog-trigger>
          <zw-dialog-content>
            <zw-dialog-title>Dialog title</zw-dialog-title>
            <zw-dialog-description>
              This dialog is rendered inside the docs playground.
            </zw-dialog-description>
            <zw-dialog-close>
              <zw-button variant="outline">Close</zw-button>
            </zw-dialog-close>
          </zw-dialog-content>
        </zw-dialog>
        <p class="zeus-playground__hint">
          Dialog: <code>{{ dialogOpen ? 'open' : 'closed' }}</code>
        </p>
      </article>

      <article class="zeus-playground__card zeus-playground__card--logs">
        <div class="zeus-playground__logs-title">
          <h3>Event log</h3>
          <button type="button" @click="clearLogs">Clear</button>
        </div>

        <ul v-if="logs.length > 0" class="zeus-playground__logs">
          <li v-for="log in logs" :key="log.id">
            <strong>{{ log.name }}</strong>
            <code>{{ log.detail || '{}' }}</code>
          </li>
        </ul>

        <p v-else class="zeus-playground__hint">
          Interact with components to see emitted events.
        </p>
      </article>
    </div>
  </section>
</template>
````

---

# 7. 追加 Playground 样式

当前 docs theme 已经有 `zw-grid / zw-card / zw-badge / zw-command`。
在 `apps/docs/.vitepress/theme/style.css` 末尾追加：

```css
.zeus-playground {
  --playground-background: #ffffff;
  --playground-foreground: #111827;
  --playground-muted: #f3f4f6;
  --playground-muted-foreground: #6b7280;
  --playground-border: #e5e7eb;
  --playground-primary: #111827;
  --playground-primary-foreground: #ffffff;
  --playground-danger: #dc2626;
  --playground-danger-foreground: #ffffff;
  --playground-radius: 12px;
  --playground-control-height: 36px;
  --playground-control-padding: 14px;

  margin: 24px 0;
  border: 1px solid var(--playground-border);
  border-radius: 18px;
  padding: 18px;
  background: var(--playground-background);
  color: var(--playground-foreground);
}

.zeus-playground--dark {
  --playground-background: #020617;
  --playground-foreground: #f8fafc;
  --playground-muted: #0f172a;
  --playground-muted-foreground: #94a3b8;
  --playground-border: #1e293b;
  --playground-primary: #f8fafc;
  --playground-primary-foreground: #020617;
  --playground-danger: #ef4444;
  --playground-danger-foreground: #ffffff;
}

.zeus-playground--compact {
  --playground-control-height: 30px;
  --playground-control-padding: 10px;
}

.zeus-playground--large {
  --playground-control-height: 44px;
  --playground-control-padding: 18px;
}

.zeus-playground__toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.zeus-playground__eyebrow {
  margin: 0 0 4px;
  color: var(--playground-muted-foreground);
  font-size: 13px;
  font-weight: 600;
}

.zeus-playground__toolbar h2 {
  margin: 0;
  border: 0;
  padding: 0;
  color: var(--playground-foreground);
  font-size: 22px;
}

.zeus-playground__controls {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.zeus-playground__controls label {
  display: grid;
  gap: 4px;
  color: var(--playground-muted-foreground);
  font-size: 12px;
  font-weight: 600;
}

.zeus-playground__controls select {
  height: 32px;
  border: 1px solid var(--playground-border);
  border-radius: 8px;
  padding: 0 28px 0 10px;
  background: var(--playground-background);
  color: var(--playground-foreground);
}

.zeus-playground__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 14px;
}

.zeus-playground__card {
  border: 1px solid var(--playground-border);
  border-radius: 14px;
  padding: 16px;
  background: color-mix(in srgb, var(--playground-muted) 52%, transparent);
}

.zeus-playground__card h3 {
  margin: 0 0 12px;
  color: var(--playground-foreground);
  font-size: 15px;
}

.zeus-playground__row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.zeus-playground__stack {
  display: grid;
  gap: 10px;
}

.zeus-playground__hint {
  margin: 12px 0 0;
  color: var(--playground-muted-foreground);
  font-size: 13px;
}

.zeus-playground__hint code {
  color: var(--playground-foreground);
}

.zeus-playground zw-button {
  display: inline-flex;
}

.zeus-playground zw-button [data-slot='button'] {
  min-height: var(--playground-control-height);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 0;
  border-radius: var(--playground-radius);
  padding: 0 var(--playground-control-padding);
  background: var(--playground-primary);
  color: var(--playground-primary-foreground);
  font: inherit;
  cursor: pointer;
  transition:
    opacity 120ms ease,
    transform 120ms ease,
    background-color 120ms ease;
}

.zeus-playground zw-button [data-slot='button']:hover {
  opacity: 0.9;
}

.zeus-playground zw-button [data-slot='button']:active {
  transform: translateY(1px);
}

.zeus-playground zw-button[variant='outline'] [data-slot='button'] {
  border: 1px solid var(--playground-border);
  background: transparent;
  color: var(--playground-foreground);
}

.zeus-playground zw-button[variant='danger'] [data-slot='button'] {
  background: var(--playground-danger);
  color: var(--playground-danger-foreground);
}

.zeus-playground zw-input {
  display: block;
  width: 100%;
}

.zeus-playground zw-input [part='root'] {
  min-height: var(--playground-control-height);
  display: flex;
  align-items: center;
  border: 1px solid var(--playground-border);
  border-radius: var(--playground-radius);
  padding: 0 12px;
  background: var(--playground-background);
}

.zeus-playground zw-input [data-slot='input'] {
  width: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--playground-foreground);
  font: inherit;
}

.zeus-playground zw-input [data-slot='input']::placeholder {
  color: var(--playground-muted-foreground);
}

.zeus-playground zw-checkbox,
.zeus-playground zw-switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.zeus-playground zw-checkbox [data-slot='checkbox-control'] {
  width: 16px;
  height: 16px;
  border: 1px solid var(--playground-border);
  border-radius: 5px;
  background: var(--playground-background);
}

.zeus-playground
  zw-checkbox[data-state='checked']
  [data-slot='checkbox-control'] {
  background: var(--playground-primary);
  color: var(--playground-primary-foreground);
}

.zeus-playground zw-switch [data-slot='switch-track'] {
  width: 38px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 2px;
  background: var(--playground-border);
}

.zeus-playground zw-switch [data-slot='switch-thumb'] {
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: var(--playground-background);
  box-shadow: 0 1px 4px rgb(0 0 0 / 24%);
  transition: transform 120ms ease;
}

.zeus-playground zw-switch[data-state='checked'] [data-slot='switch-track'] {
  background: var(--playground-primary);
}

.zeus-playground zw-switch[data-state='checked'] [data-slot='switch-thumb'] {
  transform: translateX(16px);
}

.zeus-playground zw-tabs {
  display: grid;
  gap: 12px;
}

.zeus-playground zw-tabs-list {
  display: inline-flex;
  gap: 4px;
  width: fit-content;
  padding: 4px;
  border-radius: var(--playground-radius);
  background: var(--playground-muted);
}

.zeus-playground zw-tabs-trigger button,
.zeus-playground zw-tabs-trigger [data-slot='tabs-trigger'] {
  min-height: 30px;
  border: 0;
  border-radius: 8px;
  padding: 0 12px;
  background: transparent;
  color: var(--playground-muted-foreground);
  font: inherit;
  cursor: pointer;
}

.zeus-playground zw-tabs-trigger[data-state='active'] button,
.zeus-playground
  zw-tabs-trigger[data-state='active']
  [data-slot='tabs-trigger'] {
  background: var(--playground-background);
  color: var(--playground-foreground);
}

.zeus-playground zw-tabs-content {
  display: block;
  border: 1px solid var(--playground-border);
  border-radius: var(--playground-radius);
  padding: 12px;
  color: var(--playground-foreground);
}

.zeus-playground zw-dialog-content [part='content'],
.zeus-playground zw-dialog-content [data-slot='dialog-content'] {
  position: fixed;
  left: 50%;
  top: 50%;
  z-index: 100;
  width: min(420px, calc(100vw - 32px));
  transform: translate(-50%, -50%);
  border: 1px solid var(--playground-border);
  border-radius: 16px;
  padding: 20px;
  background: var(--playground-background);
  color: var(--playground-foreground);
  box-shadow: 0 20px 60px rgb(0 0 0 / 28%);
}

.zeus-playground zw-dialog-title {
  display: block;
  margin-bottom: 8px;
  color: var(--playground-foreground);
  font-size: 18px;
  font-weight: 700;
}

.zeus-playground zw-dialog-description {
  display: block;
  margin-bottom: 16px;
  color: var(--playground-muted-foreground);
  line-height: 1.6;
}

.zeus-playground__logs-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.zeus-playground__logs-title h3 {
  margin: 0;
}

.zeus-playground__logs-title button {
  border: 1px solid var(--playground-border);
  border-radius: 8px;
  padding: 4px 8px;
  background: transparent;
  color: var(--playground-foreground);
  cursor: pointer;
}

.zeus-playground__logs {
  display: grid;
  gap: 8px;
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}

.zeus-playground__logs li {
  display: grid;
  gap: 4px;
  border: 1px solid var(--playground-border);
  border-radius: 10px;
  padding: 8px;
  background: var(--playground-background);
}

.zeus-playground__logs strong {
  color: var(--playground-foreground);
  font-size: 12px;
}

.zeus-playground__logs code {
  white-space: pre-wrap;
  color: var(--playground-muted-foreground);
  font-size: 12px;
}

@media (max-width: 640px) {
  .zeus-playground__toolbar {
    display: grid;
  }

  .zeus-playground__controls {
    width: 100%;
  }

  .zeus-playground__controls label {
    flex: 1;
  }
}
```

---

# 8. 新增 Playground contract check

## `scripts/checks/check-playground.ts`

```ts
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import pc from 'picocolors'

interface RequiredFile {
  path: string
  mustContain: string[]
  mustNotContain?: string[]
}

const root = process.cwd()

const requiredFiles: RequiredFile[] = [
  {
    path: 'apps/docs/playground/index.md',
    mustContain: [
      '# Interactive Playground',
      '<ZeusPlayground />',
      '@zeus-web/<component>/wc imports',
    ],
  },
  {
    path: 'apps/docs/.vitepress/theme/index.ts',
    mustContain: [
      "import ZeusPlayground from './components/ZeusPlayground.vue'",
      "app.component('ZeusPlayground', ZeusPlayground)",
    ],
  },
  {
    path: 'apps/docs/.vitepress/theme/components/ZeusPlayground.vue',
    mustContain: [
      "import '@zeus-web/button/wc'",
      "import '@zeus-web/checkbox/wc'",
      "import '@zeus-web/dialog/wc'",
      "import '@zeus-web/input/wc'",
      "import '@zeus-web/switch/wc'",
      "import '@zeus-web/tabs/wc'",
      '<zw-button',
      '<zw-input',
      '<zw-checkbox',
      '<zw-switch',
      '<zw-tabs',
      '<zw-dialog',
      '@press="handlePress"',
      '@value-change="handleValueChange"',
      '@checked-change="handleCheckedChange"',
      '@open-change="handleOpenChange"',
    ],
    mustNotContain: [
      '@zeus-web/react',
      '@zeus-web/button/react',
      '@zeus-web/input/react',
      'customElements.define',
    ],
  },
  {
    path: 'apps/docs/.vitepress/data/site.ts',
    mustContain: [
      "text: 'Playground'",
      "link: '/playground/'",
      'playgroundItems',
    ],
  },
  {
    path: 'apps/docs/.vitepress/theme/style.css',
    mustContain: [
      '.zeus-playground',
      '.zeus-playground--dark',
      '.zeus-playground__grid',
      '.zeus-playground__logs',
    ],
  },
]

function checkFile(file: RequiredFile): string[] {
  const absolutePath = resolve(root, file.path)

  if (!existsSync(absolutePath)) {
    return [`Missing playground file: ${file.path}`]
  }

  const source = readFileSync(absolutePath, 'utf-8')
  const errors: string[] = []

  for (const text of file.mustContain) {
    if (!source.includes(text)) {
      errors.push(`${file.path} must contain "${text}"`)
    }
  }

  for (const text of file.mustNotContain ?? []) {
    if (source.includes(text)) {
      errors.push(`${file.path} must not contain "${text}"`)
    }
  }

  return errors
}

function main(): void {
  const errors = requiredFiles.flatMap(checkFile)

  if (errors.length > 0) {
    console.error(pc.red('Playground contract check failed:'))

    for (const error of errors) {
      console.error(`- ${error}`)
    }

    process.exit(1)
  }

  console.log(pc.green('Playground contract check passed.'))
}

main()
```

---

# 9. 可选：增强 `check-docs.ts`

如果你希望 docs contract 也强制检查 playground 页面，在 `scripts/checks/check-docs.ts` 的 `requiredDocs` 里追加：

```ts
{
  path: 'playground/index.md',
  mustContain: [
    '# Interactive Playground',
    '<ZeusPlayground />',
    '@zeus-web/<component>/wc imports',
  ],
}
```

并在 `checkVitePressConfig()` 里的 route 列表追加：

```ts
'/playground/'
```

如果已经有 `check-playground.ts`，这不是必须，但加上更稳。

---

# 10. TypeScript / Vue 类型注意点

`apps/docs/tsconfig.json` 当前只 include `.vitepress/**/*.ts` 的话，需要改成包含 `.vue`。

## 替换 `apps/docs/tsconfig.json`

```json
{
  "extends": "../../scripts/config/tsconfig.base.json",
  "compilerOptions": {
    "composite": false,
    "types": ["node"],
    "noEmit": true,
    "isolatedDeclarations": false
  },
  "include": [".vitepress/**/*.ts", ".vitepress/**/*.vue"]
}
```

如果 TS 报 `.vue` module 解析问题，再新增：

## `apps/docs/.vitepress/env.d.ts`

```ts
declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<
    Record<string, unknown>,
    Record<string, unknown>,
    unknown
  >
  export default component
}
```

然后把 `apps/docs/tsconfig.json` include 改为：

```json
{
  "include": [
    ".vitepress/**/*.ts",
    ".vitepress/**/*.vue",
    ".vitepress/**/*.d.ts"
  ]
}
```

---

# 11. Phase 9.4 验收命令

```bash
pnpm docs:check-playground
pnpm docs:check
pnpm docs:build

pnpm site:check
pnpm site:build

pnpm check
pnpm test
pnpm check:exports
pnpm build
pnpm check:build-output
```

验收标准：

```txt
1. /playground/ 页面存在。
2. VitePress theme 全局注册 ZeusPlayground。
3. Playground 使用 @zeus-web/<name>/wc，不使用 React wrapper。
4. Playground 覆盖 button/input/checkbox/switch/tabs/dialog。
5. Playground 支持 light/dark。
6. Playground 支持 density 切换。
7. Playground 记录 press/value-change/checked-change/open-change。
8. docs:check-playground 通过。
9. docs:build 通过。
10. site:check 通过。
```

---

# 12. 建议提交

```txt
docs: add interactive web component playground
test(docs): add playground contract check
chore(docs): wire playground check into docs check
```

Phase 9.4 完成后，Phase 9 系列基本收口：

```txt
9.1 Docs polish + contract check
9.2 Next App Router example
9.3 Auto docs from aiMetadata / registry
9.4 Interactive Playground
```

下一步建议进入：

```txt
Phase 10：Accessibility & interaction hardening
```

优先顺序：

```txt
1. Dialog focus trap / return focus / escape close / outside click。
2. Tabs roving tabindex / arrow navigation。
3. Checkbox/Switch keyboard 与 aria 状态。
4. Input aria-invalid / describedby。
5. Button loading / icon-only aria-label。
```
