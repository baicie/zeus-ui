下面给 **Phase 22：Public Docs Rewrite / 三条使用路径文档收口** 的详细设计与完整代码。

Phase 22 的核心目标不是再做功能，而是把前面 Phase 15–21 已经形成的产品形态，在公开文档里讲清楚。

现在公开文档仍有明显旧内容：

- README 还写 `@zeus-web/react` 聚合包。
- README 架构还写 `@zeus-web/headless / @zeus-web/react / @zeus-web/vue` 聚合包。
- docs 首页还写 `zweb init` 创建 `components.json`。
- Getting Started 还写 `components.json / src/styles/globals.css / src/lib/utils.ts`。
- CLI docs 还写 init 创建 `components.json`。
- Registry docs 还写老的 `registry:ui/path/components.json` schema。
- Theming docs 还说 init 写 `@zeus-web/themes/slate.css` imports。
- Native WC example 还只讲 primitive `@zeus-web/button/wc`，没讲 Phase 21 的 `@zeus-web/ui` native styled showcase。

Phase 22 就是把这些全部统一成现在的最终路线。

---

# Phase 22 目标

```txt
Phase 22 = Public docs rewrite

新增 / 改造：
  - README 重写
  - docs 首页重写
  - Getting Started 重写
  - CLI 文档重写
  - Registry 文档重写
  - Theming 文档重写
  - Native Web Components 示例文档重写
  - 新增 Usage Modes 文档
  - 更新 VitePress sidebar
  - 更新 check-docs.ts
  - 新增 check-public-docs.ts
  - 更新 check-product-layers.ts
  - roadmap Phase 22 Done

不做：
  - 不改 runtime
  - 不改 CLI 行为
  - 不新增组件
  - 不新增 showcase
  - 不做 release
```

---

# 1. 修改根 `package.json`

新增：

```json
"check:public-docs": "tsx scripts/checks/check-public-docs.ts"
```

并接入 `docs:check` 和 `site:check`。

```json
{
  "scripts": {
    "check:public-docs": "tsx scripts/checks/check-public-docs.ts",
    "docs:check": "pnpm docs:check-generated && tsx scripts/checks/check-docs.ts && pnpm check:public-docs && pnpm docs:check-playground && pnpm --filter \"@zeus-web/docs\" check",
    "site:check": "pnpm check:component-coverage && pnpm check:showcase-metadata && pnpm check:showcase-implementation && pnpm check:product-layers && pnpm check:ui-package && pnpm check:registry && pnpm check:cli-init && pnpm check:cli-add && pnpm check:showcase-registry && pnpm check:native-showcase && pnpm showcase:registry:check && pnpm docs:check && pnpm docs:build && pnpm examples:check && pnpm showcase:test"
  }
}
```

---

# 2. 替换 `README.md`

````md
# Zeus Web

Zeus Web is a framework-neutral UI system built on Web Components, source registry templates and package-owned styled native entries.

It supports three usage paths:

1. **CLI registry source** for React and Vue applications.
2. **Native styled Web Components** through `@zeus-web/ui`.
3. **Advanced primitives** through per-component packages.

## Recommended path: CLI registry source

Use this when you are building a React or Vue app and want editable source components in your project.

```bash
pnpm dlx @zeus-web/cli init
pnpm dlx @zeus-web/cli add button input
```
````

This creates:

```txt
zeus-ui.json
zeus-ui.lock.json
src/lib/cn.ts
src/styles/zeus.css
src/components/ui/button.tsx
src/components/ui/input.tsx
```

For Vue projects, generated component files use `.vue`:

```txt
src/components/ui/button.vue
src/components/ui/input.vue
```

Use the generated components:

```tsx
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function Example() {
  return (
    <form className="space-y-4">
      <Input type="email" placeholder="Email" />
      <Button variant="primary">Submit</Button>
    </form>
  )
}
```

Vue:

```vue
<script setup lang="ts">
import Button from '@/components/ui/button.vue'
import Input from '@/components/ui/input.vue'
</script>

<template>
  <form class="space-y-4">
    <Input placeholder="Email" />
    <Button variant="primary">Submit</Button>
  </form>
</template>
```

## Native styled Web Components

Use this when you want styled Web Components without React or Vue.

```bash
pnpm add @zeus-web/ui
```

Aggregate entry:

```ts
import '@zeus-web/ui'
```

HTML:

```html
<zw-button variant="primary">Save</zw-button>
<zw-input placeholder="Email"></zw-input>
```

Per-component entries:

```ts
import '@zeus-web/ui/button'
import '@zeus-web/ui/input'
```

CSS-only entry:

```ts
import '@zeus-web/ui/styles.css'
import '@zeus-web/button/wc'
import '@zeus-web/input/wc'
```

## Advanced primitive usage

Use this when you are building your own design system on top of headless primitives.

```bash
pnpm add @zeus-web/button
```

React wrapper:

```tsx
import { Button } from '@zeus-web/button/react'

export function Example() {
  return <Button>Save</Button>
}
```

Vue wrapper:

```vue
<script setup lang="ts">
import { Button } from '@zeus-web/button/vue'
</script>

<template>
  <Button>Save</Button>
</template>
```

Native Web Component primitive:

```ts
import '@zeus-web/button/wc'
```

```html
<zw-button>Save</zw-button>
```

## Package map

| Package              | Purpose                                                 |
| -------------------- | ------------------------------------------------------- |
| `@zeus-web/cli`      | `zweb init`, `zweb add`, AI metadata and icon commands. |
| `@zeus-web/registry` | Source templates consumed by the CLI.                   |
| `@zeus-web/ui`       | Package-owned styled native Web Components.             |
| `@zeus-web/themes`   | Design tokens and component-level CSS variables.        |
| `@zeus-web/icons`    | Icon assets and generated wrappers.                     |
| `@zeus-web/button`   | Headless button primitive with WC/React/Vue entries.    |
| `@zeus-web/input`    | Headless input primitive with WC/React/Vue entries.     |

## Local development

```bash
pnpm install
pnpm build
pnpm check
pnpm lint
pnpm test
pnpm site:check
pnpm showcase:ci
```

## Showcase

```bash
pnpm showcase:react
pnpm showcase:vue
pnpm showcase:native
```

## Release validation

```bash
pnpm release:verify --allow-zero
```

````

---

# 3. 替换 `apps/docs/index.md`

```md
---
layout: home

hero:
  name: Zeus Web
  text: Web Component powered UI for React, Vue and native apps
  tagline: Use editable registry source in React/Vue apps, styled native Web Components with @zeus-web/ui, or headless primitives for custom design systems.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: Usage Modes
      link: /guide/usage-modes
    - theme: alt
      text: Browse Components
      link: /components/button

features:
  - title: CLI registry source
    details: Run zweb init and zweb add to copy editable React or Vue source into your app.
  - title: Native styled Web Components
    details: Import @zeus-web/ui and use styled custom elements without React or Vue.
  - title: Advanced primitives
    details: Use @zeus-web/<component>/wc, /react or /vue when building your own design system.
  - title: AI-ready metadata
    details: Generate zeus-web.ai.md, JSON metadata or Cursor rules with zweb ai.
---

<div class="zw-badge-row">
  <span class="zw-badge">Registry source</span>
  <span class="zw-badge">Native Web Components</span>
  <span class="zw-badge">React</span>
  <span class="zw-badge">Vue</span>
  <span class="zw-badge">AI Metadata</span>
</div>

<div class="zw-grid">
  <div class="zw-card">
    <h3>React/Vue apps</h3>
    <p>Run <code>zweb init</code> to create <code>zeus-ui.json</code>, <code>src/lib/cn.ts</code> and <code>src/styles/zeus.css</code>.</p>
  </div>

  <div class="zw-card">
    <h3>Add source</h3>
    <p>Run <code>zweb add button input</code> to copy editable registry components into <code>src/components/ui</code>.</p>
  </div>

  <div class="zw-card">
    <h3>Native package</h3>
    <p>Import <code>@zeus-web/ui</code> and use <code>&lt;zw-button&gt;</code> and <code>&lt;zw-input&gt;</code> directly.</p>
  </div>
</div>

## Quick commands

<div class="zw-command">

pnpm dlx @zeus-web/cli init
pnpm dlx @zeus-web/cli add button input
pnpm add @zeus-web/ui

</div>
````

---

# 4. 新增 `apps/docs/guide/usage-modes.md`

````md
# Usage Modes

Zeus Web has three product usage modes.

## 1. CLI registry source

Use this for React and Vue applications.

The CLI copies editable source into your project.

```bash
pnpm dlx @zeus-web/cli init
pnpm dlx @zeus-web/cli add button input
```
````

Generated files:

```txt
zeus-ui.json
zeus-ui.lock.json
src/lib/cn.ts
src/styles/zeus.css
src/components/ui/button.tsx
src/components/ui/input.tsx
```

Vue projects receive `.vue` component files:

```txt
src/components/ui/button.vue
src/components/ui/input.vue
```

Use this mode when:

- you want shadcn-like ownership of component source
- you are building a React or Vue app
- you want to customize generated components
- you want AI tools to inspect local component source

## 2. Native styled Web Components

Use this for no-framework or framework-neutral surfaces.

```bash
pnpm add @zeus-web/ui
```

```ts
import '@zeus-web/ui'
```

```html
<zw-button variant="primary">Save</zw-button>
<zw-input placeholder="Email"></zw-input>
```

Use this mode when:

- you do not want React or Vue wrappers
- you need styled custom elements
- you are building static pages or micro-frontends
- you want package-owned styling

Per-component entries are also available:

```ts
import '@zeus-web/ui/button'
import '@zeus-web/ui/input'
```

## 3. Advanced primitives

Use this when you want behavior primitives and will own the styling layer.

```bash
pnpm add @zeus-web/button
```

React:

```tsx
import { Button } from '@zeus-web/button/react'
```

Vue:

```ts
import { Button } from '@zeus-web/button/vue'
```

Native primitive:

```ts
import '@zeus-web/button/wc'
```

Use this mode when:

- you are building a design system
- you need low-level primitives
- you do not want registry-generated source
- you do not want package-owned styled UI

## Decision table

| Requirement                    | Recommended mode             |
| ------------------------------ | ---------------------------- |
| React app with editable source | CLI registry source          |
| Vue app with editable source   | CLI registry source          |
| No-framework app               | Native styled Web Components |
| Static HTML / micro-frontend   | Native styled Web Components |
| Custom design system           | Advanced primitives          |
| Package-owned styles           | Native styled Web Components |
| App-owned styles               | CLI registry source          |
| Headless behavior only         | Advanced primitives          |

````

---

# 5. 替换 `apps/docs/guide/getting-started.md`

```md
# Getting Started

Zeus Web supports three usage paths:

<div class="zw-grid">
  <div class="zw-card">
    <h3>CLI registry source</h3>
    <p>Copy editable React or Vue source into your app with <code>zweb init</code> and <code>zweb add</code>.</p>
  </div>
  <div class="zw-card">
    <h3>Native styled Web Components</h3>
    <p>Use <code>@zeus-web/ui</code> when you want styled custom elements without React or Vue.</p>
  </div>
  <div class="zw-card">
    <h3>Advanced primitives</h3>
    <p>Install per-component primitives when building your own design system.</p>
  </div>
</div>

## React or Vue app

Initialize the project:

```bash
pnpm dlx @zeus-web/cli init
````

This creates:

```txt
zeus-ui.json
src/lib/cn.ts
src/styles/zeus.css
```

Add components:

```bash
pnpm dlx @zeus-web/cli add button input
```

This copies React files into your project:

```txt
src/components/ui/button.tsx
src/components/ui/input.tsx
```

For Vue projects, the CLI copies:

```txt
src/components/ui/button.vue
src/components/ui/input.vue
```

## React usage

```tsx
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function Example() {
  return (
    <form className="space-y-4">
      <Input placeholder="Email" type="email" />
      <Button variant="primary">Submit</Button>
    </form>
  )
}
```

## Vue usage

```vue
<script setup lang="ts">
import Button from '@/components/ui/button.vue'
import Input from '@/components/ui/input.vue'
</script>

<template>
  <form class="space-y-4">
    <Input placeholder="Email" />
    <Button variant="primary">Submit</Button>
  </form>
</template>
```

## Native styled Web Components

Install:

```bash
pnpm add @zeus-web/ui
```

Import the aggregate entry:

```ts
import '@zeus-web/ui'
```

Use custom elements:

```html
<zw-button variant="primary">Save</zw-button>
<zw-input placeholder="Email"></zw-input>
```

Per-component imports:

```ts
import '@zeus-web/ui/button'
import '@zeus-web/ui/input'
```

## Advanced primitive usage

Install a primitive:

```bash
pnpm add @zeus-web/button
```

React wrapper:

```tsx
import { Button } from '@zeus-web/button/react'

export function Example() {
  return <Button>Save</Button>
}
```

Vue wrapper:

```vue
<script setup lang="ts">
import { Button } from '@zeus-web/button/vue'
</script>

<template>
  <Button>Save</Button>
</template>
```

Native primitive:

```ts
import '@zeus-web/button/wc'
```

```html
<zw-button>Save</zw-button>
```

## Next

- Learn the three usage modes in [Usage Modes](/guide/usage-modes).
- Learn CLI options in [CLI](/guide/cli).
- Learn source registry internals in [Registry](/guide/registry).
- Learn native usage in [Native Web Components](/examples/native-wc).

````

---

# 6. 替换 `apps/docs/guide/cli.md`

```md
# CLI

The Zeus Web CLI is published as `@zeus-web/cli`.

The CLI owns the React/Vue source registry workflow.

## Commands

| Command | Description |
| --- | --- |
| `zweb init` | Create `zeus-ui.json`, `src/lib/cn.ts` and `src/styles/zeus.css`. |
| `zweb add <components>` | Copy registry component source into your project. |
| `zweb ai` | Generate AI-readable metadata and usage guide. |
| `zweb icon` | Manage icon metadata and snippets. |

## init

```bash
pnpm dlx @zeus-web/cli init
````

Options:

| Option                     | Description                                                      |
| -------------------------- | ---------------------------------------------------------------- |
| `--cwd <dir>`              | Use a specific project directory.                                |
| `--framework <name>`       | `react` or `vue`. Use this when both frameworks are detected.    |
| `--style <name>`           | `default`, `slate`, `zinc`, `neutral`, or `stone`.               |
| `--css <file>`             | CSS file to create or update. Defaults to `src/styles/zeus.css`. |
| `--radius <name>`          | Radius preset.                                                   |
| `--motion <name>`          | Motion preset.                                                   |
| `--dark-mode <name>`       | `class`, `data`, or `media`.                                     |
| `--accent <hsl>`           | Override primary and ring color.                                 |
| `--overwrite`              | Replace generated config and managed files.                      |
| `--dry-run`                | Print the plan without writing files.                            |
| `--package-manager <name>` | `pnpm`, `npm`, `yarn`, or `bun`.                                 |

Examples:

```bash
zweb init --framework react
zweb init --framework vue
zweb init --style slate --css src/styles/zeus.css
zweb init --radius lg --motion reduced
zweb init --dry-run
```

`zweb init` creates:

```txt
zeus-ui.json
src/lib/cn.ts
src/styles/zeus.css
```

## add

```bash
pnpm dlx @zeus-web/cli add button input
```

Options:

| Option                     | Description                           |
| -------------------------- | ------------------------------------- |
| `--cwd <dir>`              | Use a specific project directory.     |
| `--dry-run`                | Print the plan without writing files. |
| `--overwrite`              | Replace existing generated files.     |
| `--install`                | Install package dependencies.         |
| `--no-install`             | Do not install dependencies.          |
| `--package-manager <name>` | `pnpm`, `npm`, `yarn`, or `bun`.      |

Examples:

```bash
zweb add button --dry-run
zweb add button input
zweb add button --overwrite
zweb add button --install
```

When adding `button`, the CLI expands registry dependencies and writes:

```txt
src/lib/cn.ts
src/styles/zeus.css
src/components/ui/button.tsx
```

For Vue projects:

```txt
src/lib/cn.ts
src/styles/zeus.css
src/components/ui/button.vue
```

The CLI also writes:

```txt
zeus-ui.lock.json
```

## ai

```bash
pnpm dlx @zeus-web/cli ai --cursor
```

Options:

| Option            | Description                            |
| ----------------- | -------------------------------------- |
| `--json`          | Generate `zeus-web.ai.json`.           |
| `--cursor`        | Generate `.cursor/rules/zeus-web.mdc`. |
| `--output <file>` | Write to a custom file.                |
| `--overwrite`     | Replace existing file.                 |
| `--dry-run`       | Print the plan without writing.        |

````

---

# 7. 替换 `apps/docs/guide/registry.md`

```md
# Registry

The registry package is `@zeus-web/registry`.

It contains source templates consumed by `zweb add`.

## Source of truth

Registry metadata is stored in:

```txt
packages/registry/registry.json
````

Templates are stored under:

```txt
packages/registry/templates
```

Current Phase 22 registry items:

```txt
cn
globals
button
input
```

## Why copy source?

Registry components are meant to be owned by your app.

After running:

```bash
zweb add button
```

you can edit:

```txt
src/components/ui/button.tsx
```

or, in Vue projects:

```txt
src/components/ui/button.vue
```

## Registry dependencies

Components may depend on other registry items.

For example, `button` depends on:

```txt
cn
globals
```

So:

```bash
zweb add button
```

writes:

```txt
src/lib/cn.ts
src/styles/zeus.css
src/components/ui/button.tsx
```

Vue projects receive:

```txt
src/components/ui/button.vue
```

## Framework filtering

Registry items may contain both React and Vue templates.

The CLI reads `zeus-ui.json` and only copies files matching the configured framework.

React projects receive `.tsx` files.

Vue projects receive `.vue` files.

## Per-component primitives

Registry source imports per-component primitive wrappers.

React:

```tsx
import { Button as ButtonPrimitive } from '@zeus-web/button/react'
```

Vue:

```ts
import { Button as ButtonPrimitive } from '@zeus-web/button/vue'
```

The registry should not import from aggregate framework packages.

## Local imports

Generated components import local utilities:

```tsx
import { cn } from '@/lib/cn'
```

The CLI rewrites this according to `zeus-ui.json` aliases.

## Registry item shape

```json
{
  "name": "button",
  "type": "component",
  "description": "Styled button component built on top of @zeus-web/button primitives.",
  "frameworks": ["react", "vue"],
  "dependencies": ["@zeus-web/button"],
  "registryDependencies": ["cn", "globals"],
  "files": [
    {
      "framework": "react",
      "source": "templates/react/button.tsx",
      "target": "components/ui/button.tsx"
    },
    {
      "framework": "vue",
      "source": "templates/vue/button.vue",
      "target": "components/ui/button.vue"
    }
  ]
}
```

## Registry vs native package

The registry copies app-owned source.

`@zeus-web/ui` provides package-owned styled native Web Components.

Use registry source for React/Vue app customization.

Use `@zeus-web/ui` for no-framework styled custom elements.

````

---

# 8. 替换 `apps/docs/guide/theming.md`

```md
# Theming

Zeus Web has two token surfaces:

1. `--zeus-*` variables for registry-installed React/Vue source components.
2. `--zw-*` variables for package-owned native styled Web Components.

## Registry source tokens

When you run:

```bash
zweb init --style slate
````

the CLI writes or updates:

```txt
src/styles/zeus.css
```

That file contains `--zeus-*` variables used by generated components.

Examples:

```css
:root {
  --zeus-background: 0 0% 100%;
  --zeus-foreground: 240 10% 3.9%;
  --zeus-primary: 240 5.9% 10%;
  --zeus-primary-foreground: 0 0% 98%;
  --zeus-border: 240 5.9% 90%;
  --zeus-ring: 240 5.9% 10%;
}
```

Registry components consume those variables:

```tsx
<Button variant="primary">Save</Button>
<Input placeholder="Email" />
```

## Native styled Web Component tokens

When you import:

```ts
import '@zeus-web/ui'
```

the package loads `@zeus-web/themes/default.css` and component CSS internally.

Native styled Web Components consume `--zw-*` variables:

```html
<zw-button variant="primary">Save</zw-button>
<zw-input placeholder="Email"></zw-input>
```

You can also import styles only:

```ts
import '@zeus-web/ui/styles.css'
import '@zeus-web/button/wc'
import '@zeus-web/input/wc'
```

## Available theme names

<div class="zw-badge-row">
  <span class="zw-badge">default</span>
  <span class="zw-badge">slate</span>
  <span class="zw-badge">zinc</span>
  <span class="zw-badge">neutral</span>
  <span class="zw-badge">stone</span>
</div>

## Dark mode

Registry styles support `.dark`:

```html
<html class="dark">
  ...
</html>
```

Native `@zeus-web/ui` styles also include dark token values through the theme package.

## Radius and motion

```bash
zweb init --radius lg --motion reduced
```

This updates managed variables in `src/styles/zeus.css`.

## Accent color

```bash
zweb init --accent "220 90% 56%"
```

This can override primary and ring color tokens.

## Rule

Use semantic variables instead of hard-coded colors.

Use `--zeus-*` inside registry-owned app source.

Use `--zw-*` when styling or overriding native `@zeus-web/ui` surfaces.

````

---

# 9. 替换 `apps/docs/examples/native-wc.md`

```md
# Native Web Components Example

Zeus Web supports two native Web Component paths:

1. Styled native Web Components through `@zeus-web/ui`.
2. Headless primitive Web Components through per-component `/wc` entries.

## Styled native showcase

Run:

```bash
pnpm showcase:native
````

Build:

```bash
pnpm showcase:native:build
```

Test:

```bash
pnpm showcase:native:test
```

The native showcase imports the package-owned styled UI entry:

```ts
import '@zeus-web/ui'
```

Then uses native custom elements:

```html
<zw-button variant="primary">Save</zw-button>
<zw-input placeholder="Email"></zw-input>
```

This path does not require React or Vue.

## Per-component styled imports

You can import individual styled entries:

```ts
import '@zeus-web/ui/button'
import '@zeus-web/ui/input'
```

## Styles-only path

You can load only the styled CSS and register primitives separately:

```ts
import '@zeus-web/ui/styles.css'
import '@zeus-web/button/wc'
import '@zeus-web/input/wc'
```

## Headless primitive path

Use primitive WC entries directly when you want to own the style layer:

```ts
import '@zeus-web/button/wc'
import '@zeus-web/input/wc'
```

```html
<zw-button>Save</zw-button> <zw-input placeholder="Email"></zw-input>
```

## Which one should I use?

| Requirement                            | Use                        |
| -------------------------------------- | -------------------------- |
| Styled custom elements                 | `@zeus-web/ui`             |
| No React or Vue runtime                | `@zeus-web/ui`             |
| Package-owned styling                  | `@zeus-web/ui`             |
| Custom styling and behavior primitives | `@zeus-web/<component>/wc` |

````

---

# 10. 更新 `apps/docs/.vitepress/data/site.ts`

给 Guide 增加 Usage Modes。

```ts
export const guideItems: DocsNavItem[] = [
  {
    text: 'Getting Started',
    link: '/guide/getting-started',
  },
  {
    text: 'Usage Modes',
    link: '/guide/usage-modes',
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
    text: 'Icons',
    link: '/guide/icons',
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
````

---

# 11. 更新 `scripts/checks/check-docs.ts`

当前 check 里把 `zeus-ui` 当成旧名字禁用。
但现在正式配置文件名就是 `zeus-ui.json`，所以这个禁用规则必须改掉。

完整替换前半部分即可：

```ts
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import pc from 'picocolors'

interface RequiredDoc {
  path: string
  mustContain: string[]
}

const root = process.cwd()
const docsRoot = resolve(root, 'apps/docs')

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

const requiredDocs: RequiredDoc[] = [
  {
    path: 'index.md',
    mustContain: [
      'Zeus Web',
      'CLI registry source',
      '@zeus-web/ui',
      'pnpm dlx @zeus-web/cli init',
    ],
  },
  {
    path: 'guide/getting-started.md',
    mustContain: [
      '# Getting Started',
      'zeus-ui.json',
      'src/lib/cn.ts',
      'src/styles/zeus.css',
      'pnpm dlx @zeus-web/cli init',
      'pnpm dlx @zeus-web/cli add button input',
      "import '@zeus-web/ui'",
      '@zeus-web/button/react',
    ],
  },
  {
    path: 'guide/usage-modes.md',
    mustContain: [
      '# Usage Modes',
      'CLI registry source',
      'Native styled Web Components',
      'Advanced primitives',
      '@zeus-web/ui',
      '@zeus-web/button/react',
    ],
  },
  {
    path: 'guide/cli.md',
    mustContain: [
      '# CLI',
      'zweb init',
      'zweb add',
      'zeus-ui.json',
      'src/lib/cn.ts',
      'src/styles/zeus.css',
      'zeus-ui.lock.json',
      'zweb ai',
    ],
  },
  {
    path: 'guide/theming.md',
    mustContain: [
      '# Theming',
      '--zeus-*',
      '--zw-*',
      'default',
      'slate',
      'zinc',
      'neutral',
      'stone',
      'src/styles/zeus.css',
    ],
  },
  {
    path: 'guide/registry.md',
    mustContain: [
      '# Registry',
      '@zeus-web/registry',
      'registry.json',
      'registryDependencies',
      'templates/react/button.tsx',
      'templates/vue/button.vue',
      'zeus-ui.json',
    ],
  },
  {
    path: 'guide/ai.md',
    mustContain: ['# AI', '@zeus-web/ai', 'zweb ai --cursor'],
  },
  {
    path: 'guide/icons.md',
    mustContain: [
      '# Icons',
      '@zeus-web/icons',
      '@zeus-web/icons/react',
      '@zeus-web/icons/vue',
      '@zeus-web/icons/wc',
      'zweb icon list',
    ],
  },
  {
    path: 'components/index.md',
    mustContain: [
      'This file is generated by scripts/commands/generate-docs.ts',
      '# Components',
      '@zeus-web/ai',
      '@zeus-web/registry',
    ],
  },
  {
    path: 'examples/react-vite.md',
    mustContain: ['# React Vite Example', '@zeus-web/example-react-vite'],
  },
  {
    path: 'examples/next-app.md',
    mustContain: [
      '# Next.js App Router Example',
      '@zeus-web/example-next-app',
      '@zeus-web/button/react',
      "'use client'",
    ],
  },
  {
    path: 'examples/native-wc.md',
    mustContain: [
      '# Native Web Components Example',
      '@zeus-web/ui',
      'pnpm showcase:native',
      "import '@zeus-web/ui'",
      '@zeus-web/button/wc',
    ],
  },
  {
    path: 'playground/index.md',
    mustContain: [
      '# Interactive Playground',
      '<ZeusPlayground />',
      '@zeus-web/<component>/wc imports',
    ],
  },
]

const forbiddenPatterns = [
  {
    pattern: '@zeus-ui',
    message: 'old @zeus-ui package scope must not appear in docs',
  },
  {
    pattern: '@zeus-web/react',
    message: 'old aggregate @zeus-web/react package must not appear in docs',
  },
  {
    pattern: '@zeus-web/vue',
    message: 'old aggregate @zeus-web/vue package must not appear in docs',
  },
  {
    pattern: '@zeus-web/headless',
    message: 'old aggregate @zeus-web/headless package must not appear in docs',
  },
  {
    pattern: 'components.json',
    message: 'old components.json config must not appear in public docs',
  },
  {
    pattern: 'src/styles/globals.css',
    message: 'old globals.css config path must not appear in public docs',
  },
  {
    pattern: 'src/lib/utils.ts',
    message:
      'old utils.ts registry utility path must not appear in public docs',
  },
]
```

然后在 `checkVitePressConfig()` route 列表里增加：

```ts
'/guide/usage-modes',
```

完整片段：

```ts
for (const route of [
  '/guide/getting-started',
  '/guide/usage-modes',
  '/guide/cli',
  '/guide/theming',
  '/guide/icons',
  '/components/',
  ...componentDocs.map(c => `/components/${c}`),
  '/playground/',
  '/examples/react-vite',
  '/examples/next-app',
  '/examples/native-wc',
]) {
  if (!siteSource.includes(route))
    errors.push(`data/site.ts must contain route "${route}"`)
}
```

---

# 12. 新增 `scripts/checks/check-public-docs.ts`

```ts
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import pc from 'picocolors'

const root = process.cwd()

const requiredFiles = [
  'README.md',
  'apps/docs/index.md',
  'apps/docs/guide/getting-started.md',
  'apps/docs/guide/usage-modes.md',
  'apps/docs/guide/cli.md',
  'apps/docs/guide/registry.md',
  'apps/docs/guide/theming.md',
  'apps/docs/examples/native-wc.md',
  'apps/docs/.vitepress/data/site.ts',
]

const requiredContent: Record<string, string[]> = {
  'README.md': [
    'CLI registry source',
    'Native styled Web Components',
    'Advanced primitives',
    'zeus-ui.json',
    '@zeus-web/ui',
    '@zeus-web/button/react',
    'pnpm showcase:native',
  ],
  'apps/docs/index.md': [
    'CLI registry source',
    'Native styled Web Components',
    '@zeus-web/ui',
    'zeus-ui.json',
  ],
  'apps/docs/guide/getting-started.md': [
    'zeus-ui.json',
    'src/lib/cn.ts',
    'src/styles/zeus.css',
    "import '@zeus-web/ui'",
    '@zeus-web/button/react',
  ],
  'apps/docs/guide/usage-modes.md': [
    'CLI registry source',
    'Native styled Web Components',
    'Advanced primitives',
    '@zeus-web/ui',
    '@/components/ui/button',
  ],
  'apps/docs/guide/cli.md': [
    'zeus-ui.json',
    'zeus-ui.lock.json',
    'src/lib/cn.ts',
    'src/styles/zeus.css',
    '--framework <name>',
    '--install',
  ],
  'apps/docs/guide/registry.md': [
    'registryDependencies',
    'templates/react/button.tsx',
    'templates/vue/button.vue',
    'zeus-ui.json',
    'cn',
    'globals',
  ],
  'apps/docs/guide/theming.md': [
    '--zeus-*',
    '--zw-*',
    'src/styles/zeus.css',
    "import '@zeus-web/ui'",
  ],
  'apps/docs/examples/native-wc.md': [
    '@zeus-web/ui',
    'pnpm showcase:native',
    "import '@zeus-web/ui'",
    '<zw-button variant="primary">Save</zw-button>',
  ],
  'apps/docs/.vitepress/data/site.ts': [
    "text: 'Usage Modes'",
    "link: '/guide/usage-modes'",
  ],
}

const forbiddenContent: Record<string, string[]> = {
  'README.md': [
    '@zeus-web/react',
    '@zeus-web/vue',
    '@zeus-web/headless',
    'components.json',
    'src/styles/globals.css',
    'src/lib/utils.ts',
  ],
  'apps/docs/index.md': ['components.json'],
  'apps/docs/guide/getting-started.md': [
    'components.json',
    'src/styles/globals.css',
    'src/lib/utils.ts',
  ],
  'apps/docs/guide/cli.md': ['components.json', 'src/styles/globals.css'],
  'apps/docs/guide/registry.md': [
    'registry:ui',
    '"path":',
    'components.json',
    '@/lib/utils',
  ],
  'apps/docs/guide/theming.md': [
    "@import '@zeus-web/themes/slate.css'",
    'components.css provides the default',
  ],
}

function read(path: string): string {
  return readFileSync(resolve(root, path), 'utf-8')
}

function main(): void {
  const errors: string[] = []

  for (const file of requiredFiles) {
    if (!existsSync(resolve(root, file))) {
      errors.push(`Missing public docs file: ${file}`)
    }
  }

  for (const [file, contents] of Object.entries(requiredContent)) {
    if (!existsSync(resolve(root, file))) continue

    const source = read(file)

    for (const content of contents) {
      if (!source.includes(content)) {
        errors.push(`${file} must contain "${content}"`)
      }
    }
  }

  for (const [file, contents] of Object.entries(forbiddenContent)) {
    if (!existsSync(resolve(root, file))) continue

    const source = read(file)

    for (const content of contents) {
      if (source.includes(content)) {
        errors.push(`${file} must not contain stale content "${content}"`)
      }
    }
  }

  if (errors.length > 0) {
    console.error(pc.red('Public docs check failed:'))

    for (const error of errors) {
      console.error(`- ${error}`)
    }

    process.exit(1)
  }

  console.log(pc.green('Public docs check passed.'))
}

main()
```

---

# 13. 更新 `scripts/checks/check-product-layers.ts`

把 roadmap 检查更新到 Phase 22。

```ts
{
  path: 'docs/internal/examples/showcase-roadmap.md',
  mustContain: [
    '| Phase 15 | Done',
    '| Phase 16 | Done',
    '| Phase 17 | Done',
    '| Phase 18 | Done',
    '| Phase 19 | Done',
    '| Phase 20 | Done',
    '| Phase 21 | Done',
    '| Phase 22 | Done',
    'The showcase has fifteen layers of checks:',
    'Product layer checks validate Zeus-UI package boundaries and usage entry decisions.',
    'Native styled Web-C checks validate @zeus-web/ui package exports, CSS entrypoints and primitive composition.',
    'Registry checks validate @zeus-web/registry schema, metadata, templates and primitive dependencies.',
    'CLI init checks validate zeus-ui.json initialization, project detection and base file generation.',
    'CLI add checks validate registry dependency expansion, framework-specific template filtering and lockfile tracking.',
    'Showcase registry checks validate React and Vue demos consume registry-synced local styled components.',
    'Native showcase checks validate @zeus-web/ui can be consumed without React or Vue.',
    'Public docs checks validate CLI registry, native styled Web-C and advanced primitive usage paths.',
    'pnpm check:product-layers',
    'pnpm check:ui-package',
    'pnpm check:registry',
    'pnpm check:cli-init',
    'pnpm check:cli-add',
    'pnpm check:showcase-registry',
    'pnpm check:native-showcase',
    'pnpm check:public-docs',
    'Phase 23: Add CLI update and diff support for registry-installed components.',
  ],
}
```

替换 `checkPhaseOrder()`：

```ts
function checkPhaseOrder(source: string): string[] {
  const errors: string[] = []
  const phase15Index = source.indexOf('| Phase 15 |')
  const phase16Index = source.indexOf('| Phase 16 |')
  const phase17Index = source.indexOf('| Phase 17 |')
  const phase18Index = source.indexOf('| Phase 18 |')
  const phase19Index = source.indexOf('| Phase 19 |')
  const phase20Index = source.indexOf('| Phase 20 |')
  const phase21Index = source.indexOf('| Phase 21 |')
  const phase22Index = source.indexOf('| Phase 22 |')
  const phase23Index = source.indexOf('Phase 23:')

  if (phase15Index < 0) {
    errors.push('showcase-roadmap.md must contain Phase 15 status row')
  }

  if (phase16Index < 0) {
    errors.push('showcase-roadmap.md must contain Phase 16 status row')
  }

  if (phase17Index < 0) {
    errors.push('showcase-roadmap.md must contain Phase 17 status row')
  }

  if (phase18Index < 0) {
    errors.push('showcase-roadmap.md must contain Phase 18 status row')
  }

  if (phase19Index < 0) {
    errors.push('showcase-roadmap.md must contain Phase 19 status row')
  }

  if (phase20Index < 0) {
    errors.push('showcase-roadmap.md must contain Phase 20 status row')
  }

  if (phase21Index < 0) {
    errors.push('showcase-roadmap.md must contain Phase 21 status row')
  }

  if (phase22Index < 0) {
    errors.push('showcase-roadmap.md must contain Phase 22 status row')
  }

  if (phase23Index < 0) {
    errors.push('showcase-roadmap.md must contain Phase 23 next work')
  }

  if (phase15Index >= 0 && phase16Index >= 0 && phase16Index < phase15Index) {
    errors.push('Phase 16 status must appear after Phase 15 status')
  }

  if (phase16Index >= 0 && phase17Index >= 0 && phase17Index < phase16Index) {
    errors.push('Phase 17 status must appear after Phase 16 status')
  }

  if (phase17Index >= 0 && phase18Index >= 0 && phase18Index < phase17Index) {
    errors.push('Phase 18 status must appear after Phase 17 status')
  }

  if (phase18Index >= 0 && phase19Index >= 0 && phase19Index < phase18Index) {
    errors.push('Phase 19 status must appear after Phase 18 status')
  }

  if (phase19Index >= 0 && phase20Index >= 0 && phase20Index < phase19Index) {
    errors.push('Phase 20 status must appear after Phase 19 status')
  }

  if (phase20Index >= 0 && phase21Index >= 0 && phase21Index < phase20Index) {
    errors.push('Phase 21 status must appear after Phase 20 status')
  }

  if (phase21Index >= 0 && phase22Index >= 0 && phase22Index < phase21Index) {
    errors.push('Phase 22 status must appear after Phase 21 status')
  }

  if (phase22Index >= 0 && phase23Index >= 0 && phase23Index < phase22Index) {
    errors.push('Phase 23 next work must appear after Phase 22 status')
  }

  return errors
}
```

---

# 14. 新增设计文档

## `docs/internal/design/zeus-ui-public-docs.md`

````md
# Zeus-UI Public Docs Rewrite

## Status

Phase 22 design.

This document defines the public documentation rewrite after the CLI registry, native styled Web-C and primitive usage paths became stable.

## Goal

Public docs must explain three usage paths:

1. CLI registry source for React and Vue applications.
2. Native styled Web Components through `@zeus-web/ui`.
3. Advanced primitive packages for custom design systems.

## Why this phase exists

Earlier docs still referenced older ideas:

- `components.json`
- `src/styles/globals.css`
- `src/lib/utils.ts`
- aggregate `@zeus-web/react`
- aggregate `@zeus-web/vue`
- aggregate `@zeus-web/headless`
- old registry item shapes such as `registry:ui`

Those names no longer describe the current implementation.

## Public entry points

### React/Vue recommended path

```bash
pnpm dlx @zeus-web/cli init
pnpm dlx @zeus-web/cli add button input
```
````

Generated files:

```txt
zeus-ui.json
zeus-ui.lock.json
src/lib/cn.ts
src/styles/zeus.css
src/components/ui/button.tsx
src/components/ui/input.tsx
```

### Native styled Web-C path

```ts
import '@zeus-web/ui'
```

```html
<zw-button variant="primary">Save</zw-button>
<zw-input placeholder="Email"></zw-input>
```

### Advanced primitive path

```ts
import '@zeus-web/button/wc'
import { Button } from '@zeus-web/button/react'
import { Button } from '@zeus-web/button/vue'
```

## Files updated

```txt
README.md
apps/docs/index.md
apps/docs/guide/getting-started.md
apps/docs/guide/usage-modes.md
apps/docs/guide/cli.md
apps/docs/guide/registry.md
apps/docs/guide/theming.md
apps/docs/examples/native-wc.md
apps/docs/.vitepress/data/site.ts
scripts/checks/check-docs.ts
scripts/checks/check-public-docs.ts
```

## Validation

```bash
pnpm check:public-docs
pnpm docs:check
pnpm docs:build
pnpm site:check
```

## Non-goals

Phase 22 does not change runtime packages, CLI behavior, registry templates or showcase examples.

## Next phase

Phase 23 should implement CLI update and diff support for registry-installed components.

````

---

# 15. 更新 roadmap

## `docs/internal/examples/showcase-roadmap.md`

追加：

```md
| Phase 22 | Done   | Public docs rewrite for CLI registry, native styled Web-C and advanced primitive usage paths                      |
````

工程保障改成 15 层：

```md
The showcase has fifteen layers of checks:

1. Metadata checks validate component metadata coverage.
2. Implementation checks validate that implemented demos have React and Vue files, dependencies and build dependency scripts.
3. Route smoke tests validate that every implemented component route renders in React and Vue.
4. Foundation page tests validate icons, themes and playground interaction behavior.
5. Shared unit tests validate metadata helpers, icon snippets, theme helpers and playground fixtures.
6. Vitest-powered Playwright E2E tests validate React and Vue showcase routes and critical browser interactions.
7. CI gates run showcase metadata, unit tests, builds and browser E2E as separate jobs.
8. Product layer checks validate Zeus-UI package boundaries and usage entry decisions.
9. Native styled Web-C checks validate @zeus-web/ui package exports, CSS entrypoints and primitive composition.
10. Registry checks validate @zeus-web/registry schema, metadata, templates and primitive dependencies.
11. CLI init checks validate zeus-ui.json initialization, project detection and base file generation.
12. CLI add checks validate registry dependency expansion, framework-specific template filtering and lockfile tracking.
13. Showcase registry checks validate React and Vue demos consume registry-synced local styled components.
14. Native showcase checks validate @zeus-web/ui can be consumed without React or Vue.
15. Public docs checks validate CLI registry, native styled Web-C and advanced primitive usage paths.
```

Commands 增加：

```bash
pnpm check:public-docs
pnpm docs:check
pnpm docs:build
```

Next work 改成：

```md
## Next work

Future phases should improve registry maintenance:

- Phase 23: Add CLI update and diff support for registry-installed components.
```

---

# 16. 文件清单

```txt
package.json
README.md

apps/docs/index.md
apps/docs/guide/getting-started.md
apps/docs/guide/usage-modes.md
apps/docs/guide/cli.md
apps/docs/guide/registry.md
apps/docs/guide/theming.md
apps/docs/examples/native-wc.md
apps/docs/.vitepress/data/site.ts

scripts/checks/check-docs.ts
scripts/checks/check-public-docs.ts
scripts/checks/check-product-layers.ts

docs/internal/design/zeus-ui-public-docs.md
docs/internal/examples/showcase-roadmap.md
```

---

# 17. 验收命令

```bash
pnpm check:public-docs
pnpm docs:check
pnpm docs:build
```

全量：

```bash
pnpm check
pnpm build
pnpm site:check
pnpm showcase:ci
pnpm release:verify --allow-zero
```

---

# 18. Phase 22 完成判断

```txt
完成：
  - README 不再出现旧 aggregate packages
  - README 解释三条使用路径
  - docs 首页不再说 components.json
  - Getting Started 使用 zeus-ui.json / src/lib/cn.ts / src/styles/zeus.css
  - CLI docs 覆盖 --framework / --dry-run / --install / zeus-ui.lock.json
  - Registry docs 使用 type: component / source / framework / registryDependencies
  - Theming docs 区分 --zeus-* 和 --zw-*
  - Native WC docs 覆盖 @zeus-web/ui
  - sidebar 增加 Usage Modes
  - check-docs 不再误禁 zeus-ui.json
  - check-public-docs 防止旧文案回流
  - roadmap Phase 22 Done

未做：
  - 没有 runtime 修改
  - 没有 CLI update/diff
  - 没有 release
```

---

# 19. 建议分支与 PR

分支名：

```txt
docs/public-usage-paths
```

PR title：

```txt
docs: rewrite public usage paths
```
