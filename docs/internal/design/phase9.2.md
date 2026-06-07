下面给 **Phase 9.1：Docs Polish + Docs Contract Check MVP** 的详细设计与完整代码。

Phase 9 已经规划了 `apps/docs` 和 `examples/*`，而当前根 `package.json` 已经有 `docs:dev / docs:build / docs:preview`，目标目录就是 `apps/docs`。
workspace 也已经包含 `apps/*` 和 `examples/*`，所以 9.1 不需要改 workspace。

# Phase 9.1 目标

```txt
Phase 9.1：Docs Polish + Docs Contract Check MVP

目标：
1. 给 VitePress docs 增加统一主题样式。
2. 增加 docs 元数据，统一 nav/sidebar/component 信息。
3. docs 首页更像产品官网，而不是纯 markdown。
4. 增加 docs contract check，防止文档路由、组件页、示例页缺失。
5. 根脚本增加 docs:check。
6. 不引入自动 API 文档生成，先保证文档结构稳定。
```

Phase 9.1 不做：

```txt
不做在线 Playground。
不做 API 自动从 aiMetadata 生成。
不做 VitePress 自定义 Vue 组件复杂交互。
不做截图/视觉回归。
不做部署配置。
```

---

# 1. 文件变更总览

```txt
新增：
  apps/docs/.vitepress/data/site.ts
  apps/docs/.vitepress/theme/index.ts
  apps/docs/.vitepress/theme/style.css
  scripts/checks/check-docs.ts

修改：
  package.json
  apps/docs/.vitepress/config.ts
  apps/docs/index.md
  apps/docs/guide/getting-started.md
  apps/docs/guide/cli.md
  apps/docs/guide/theming.md
  apps/docs/guide/registry.md
  apps/docs/guide/ai.md
```

---

# 2. 修改根 `package.json`

在 scripts 增加：

```json
{
  "docs:check": "tsx scripts/checks/check-docs.ts && pnpm --filter @zeus-web/docs check"
}
```

建议关键 scripts 变成：

```json
{
  "scripts": {
    "dev": "pnpm -r --parallel --filter './packages/**' dev",
    "build": "tsx scripts/commands/build.ts",
    "build:packages": "tsx scripts/commands/build.ts",
    "clean": "rimraf --glob 'packages/**/dist' --glob 'apps/**/.vitepress/dist' --glob 'examples/**/dist' temp node_modules/.cache",
    "check": "tsc -p tsconfig.json --incremental --noEmit",
    "check:exports": "tsx scripts/checks/check-package-exports.ts",
    "check:zeus-baseline": "tsx scripts/checks/check-zeus-baseline.ts",
    "check:zeus-imports": "tsx scripts/checks/check-zeus-imports.ts",
    "check:build-output": "tsx scripts/checks/check-build-output.ts",
    "check:workspace-overrides": "tsx scripts/checks/check-workspace-overrides.ts",
    "lint": "eslint --cache --cache-location node_modules/.cache/.eslintcache .",
    "lint-fix": "eslint --fix --cache --cache-location node_modules/.cache/.eslintcache .",
    "format": "prettier --write --cache --cache-location node_modules/.cache/.prettiercache .",
    "format-check": "prettier --check --cache --cache-location node_modules/.cache/.prettiercache .",
    "test": "vitest",
    "test-unit": "vitest --project unit*",
    "test-coverage": "vitest run --project unit* --coverage",
    "docs:dev": "vitepress dev apps/docs",
    "docs:build": "vitepress build apps/docs",
    "docs:preview": "vitepress preview apps/docs",
    "docs:check": "tsx scripts/checks/check-docs.ts && pnpm --filter @zeus-web/docs check",
    "examples:check": "pnpm -r --filter './examples/**' check",
    "examples:build": "pnpm -r --filter './examples/**' build",
    "site:check": "pnpm docs:check && pnpm docs:build && pnpm examples:check",
    "site:build": "pnpm docs:build && pnpm examples:build"
  }
}
```

---

# 3. 新增 docs 元数据

## `apps/docs/.vitepress/data/site.ts`

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
    description: 'Dialog component family built on zw-dialog primitives.',
  },
]

export const exampleItems: DocsNavItem[] = [
  {
    text: 'React Vite',
    link: '/examples/react-vite',
  },
  {
    text: 'Native Web Components',
    link: '/examples/native-wc',
  },
]

export const sidebar: DocsSidebarGroup[] = [
  {
    text: 'Guide',
    items: guideItems,
  },
  {
    text: 'Components',
    items: componentDocs.map(component => ({
      text: component.title,
      link: component.route,
    })),
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
    link: '/components/button',
  },
  {
    text: 'Examples',
    link: '/examples/react-vite',
  },
]
```

---

# 4. 修改 VitePress 配置

## `apps/docs/.vitepress/config.ts`

```ts
import { defineConfig } from 'vitepress'
import { sidebar, topNav } from './data/site'

export default defineConfig({
  title: 'Zeus Web',
  description:
    'Headless Web Components, shadcn-like registry and AI metadata built on Zeus.',
  cleanUrls: true,
  lastUpdated: true,
  markdown: {
    lineNumbers: true,
  },
  head: [
    ['meta', { name: 'theme-color', content: '#111827' }],
    ['meta', { property: 'og:title', content: 'Zeus Web' }],
    [
      'meta',
      {
        property: 'og:description',
        content:
          'Headless Web Components, shadcn-like registry and AI metadata built on Zeus.',
      },
    ],
  ],
  themeConfig: {
    logo: '/logo.svg',
    nav: topNav,
    sidebar,
    outline: {
      level: [2, 3],
      label: 'On this page',
    },
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © Zeus Web contributors.',
    },
    socialLinks: [
      {
        icon: 'github',
        link: 'https://github.com/baicie/zeus-ui',
      },
    ],
    search: {
      provider: 'local',
    },
  },
})
```

---

# 5. 新增 VitePress 自定义主题

## `apps/docs/.vitepress/theme/index.ts`

```ts
import DefaultTheme from 'vitepress/theme'
import './style.css'

export default DefaultTheme
```

## `apps/docs/.vitepress/theme/style.css`

```css
:root {
  --vp-c-brand-1: #111827;
  --vp-c-brand-2: #1f2937;
  --vp-c-brand-3: #374151;
  --vp-c-brand-soft: rgb(17 24 39 / 12%);

  --vp-home-hero-name-color: transparent;
  --vp-home-hero-name-background: linear-gradient(
    120deg,
    #111827 20%,
    #4f46e5 55%,
    #0ea5e9 90%
  );

  --vp-home-hero-image-background-image: linear-gradient(
    -45deg,
    #4f46e5 50%,
    #0ea5e9 50%
  );
  --vp-home-hero-image-filter: blur(72px);
}

.dark {
  --vp-c-brand-1: #f9fafb;
  --vp-c-brand-2: #e5e7eb;
  --vp-c-brand-3: #d1d5db;
  --vp-c-brand-soft: rgb(249 250 251 / 12%);
}

.VPHomeHero .text {
  max-width: 820px;
}

.VPHomeHero .tagline {
  max-width: 700px;
}

.vp-doc h2 {
  border-top: 1px solid var(--vp-c-divider);
  padding-top: 28px;
}

.vp-doc table {
  width: 100%;
  display: table;
}

.vp-doc th,
.vp-doc td {
  white-space: nowrap;
}

.vp-doc tr td:last-child,
.vp-doc tr th:last-child {
  white-space: normal;
}

.custom-block.tip {
  border-color: var(--vp-c-brand-3);
}

.zw-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
  margin: 24px 0;
}

.zw-card {
  border: 1px solid var(--vp-c-divider);
  border-radius: 14px;
  padding: 18px;
  background: var(--vp-c-bg-soft);
}

.zw-card h3 {
  margin: 0 0 8px;
  font-size: 16px;
}

.zw-card p {
  margin: 0;
  color: var(--vp-c-text-2);
  font-size: 14px;
  line-height: 1.6;
}

.zw-badge-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 16px 0;
}

.zw-badge {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  padding: 4px 10px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  font-size: 12px;
  font-weight: 600;
}

.zw-command {
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  padding: 14px 16px;
  background: var(--vp-code-block-bg);
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  overflow-x: auto;
}

.zw-muted {
  color: var(--vp-c-text-2);
}
```

---

# 6. 改造首页

## `apps/docs/index.md`

```md
---
layout: home

hero:
  name: Zeus Web
  text: Headless components for modern apps
  tagline: Build shadcn-like UI on top of Zeus Web Components, React wrappers, themes, registry source and AI metadata.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: Browse Components
      link: /components/button
    - theme: alt
      text: Generate AI Guide
      link: /guide/ai

features:
  - title: Headless primitives
    details: Input, Button, Checkbox, Switch, Tabs and Dialog are provided as reusable primitives.
  - title: Zeus output pipeline
    details: Web Component, React wrapper, Vue wrapper, manifest and dts output are generated by @zeus-js web-c packages.
  - title: Registry workflow
    details: Use zweb init and zweb add to copy shadcn-like styled source into your app.
  - title: AI-ready metadata
    details: Generate zeus-web.ai.md, JSON metadata or Cursor rules with zweb ai.
---

<div class="zw-badge-row">
  <span class="zw-badge">Web Components</span>
  <span class="zw-badge">React</span>
  <span class="zw-badge">Vue</span>
  <span class="zw-badge">Tailwind</span>
  <span class="zw-badge">AI Metadata</span>
</div>

<div class="zw-grid">
  <div class="zw-card">
    <h3>Install once</h3>
    <p>Run <code>zweb init</code> to create <code>components.json</code> and wire theme CSS.</p>
  </div>

  <div class="zw-card">
    <h3>Add source</h3>
    <p>Run <code>zweb add button input</code> to copy editable component source into your app.</p>
  </div>

  <div class="zw-card">
    <h3>Guide AI</h3>
    <p>Run <code>zweb ai --cursor</code> to generate rules that help AI use the library correctly.</p>
  </div>
</div>

## Quick command

<div class="zw-command">

pnpm dlx @zeus-web/cli init  
pnpm dlx @zeus-web/cli add button input  
pnpm dlx @zeus-web/cli ai --cursor

</div>
```

---

# 7. 强化 guide 文档

## `apps/docs/guide/getting-started.md`

````md
# Getting Started

Zeus Web is a component library workflow built around three layers:

<div class="zw-grid">
  <div class="zw-card">
    <h3>Headless primitives</h3>
    <p>Install per-component packages such as <code>@zeus-web/button</code> or <code>@zeus-web/input</code>.</p>
  </div>
  <div class="zw-card">
    <h3>Registry source</h3>
    <p>Copy shadcn-like React source into your app with <code>zweb add</code>.</p>
  </div>
  <div class="zw-card">
    <h3>AI metadata</h3>
    <p>Generate AI-readable usage rules with <code>zweb ai</code>.</p>
  </div>
</div>

## Initialize

```bash
pnpm dlx @zeus-web/cli init
```
````

This creates:

```txt
components.json
src/styles/globals.css
```

## Add components

```bash
pnpm dlx @zeus-web/cli add button input
```

This copies:

```txt
src/lib/utils.ts
src/components/ui/button.tsx
src/components/ui/input.tsx
```

## Use components

```tsx
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function Example() {
  return (
    <form className="space-y-4">
      <Input placeholder="Email" type="email" />
      <Button>Submit</Button>
    </form>
  )
}
```

## Generate AI guide

```bash
pnpm dlx @zeus-web/cli ai --cursor
```

This creates:

```txt
.cursor/rules/zeus-web.mdc
```

## Direct primitive usage

You can also use primitive packages directly.

```tsx
import { Button } from '@zeus-web/button/react'

export function Example() {
  return <Button>Save</Button>
}
```

For native Web Components:

```ts
import '@zeus-web/button/wc'
```

```html
<zw-button>Save</zw-button>
```

````

## `apps/docs/guide/cli.md`

```md
# CLI

The Zeus Web CLI is published as `@zeus-web/cli`.

## Commands

| Command | Description |
| --- | --- |
| `zweb init` | Create `components.json` and set up theme CSS. |
| `zweb add <components>` | Copy registry component source into your project. |
| `zweb ai` | Generate AI-readable metadata and usage guide. |

## init

```bash
zweb init
````

Options:

| Option                     | Description                                        |
| -------------------------- | -------------------------------------------------- |
| `--cwd <dir>`              | Use a specific project directory.                  |
| `--style <name>`           | `default`, `slate`, `zinc`, `neutral`, or `stone`. |
| `--css <file>`             | CSS file to write theme import into.               |
| `--overwrite`              | Replace existing `components.json`.                |
| `--no-install`             | Do not install dependencies.                       |
| `--package-manager <name>` | `pnpm`, `npm`, `yarn`, or `bun`.                   |

Example:

```bash
zweb init --style slate --css src/styles/globals.css
```

## add

```bash
zweb add button input
```

Options:

| Option                     | Description                           |
| -------------------------- | ------------------------------------- |
| `--cwd <dir>`              | Use a specific project directory.     |
| `--dry-run`                | Print the plan without writing files. |
| `--overwrite`              | Replace existing files.               |
| `--no-install`             | Do not install dependencies.          |
| `--package-manager <name>` | `pnpm`, `npm`, `yarn`, or `bun`.      |

Examples:

```bash
zweb add dialog --dry-run
zweb add button --overwrite
```

## ai

```bash
zweb ai
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

## `apps/docs/guide/theming.md`

```md
# Theming

Zeus Web uses shadcn-like CSS variables and Tailwind semantic tokens.

## Available themes

<div class="zw-badge-row">
  <span class="zw-badge">default</span>
  <span class="zw-badge">slate</span>
  <span class="zw-badge">zinc</span>
  <span class="zw-badge">neutral</span>
  <span class="zw-badge">stone</span>
</div>

Initialize a theme:

```bash
zweb init --style slate
````

This writes:

```css
@import '@zeus-web/themes/slate.css';
```

to the configured CSS file.

## Semantic tokens

Registry components use semantic Tailwind classes and CSS variables.

| Token                     | Usage                       |
| ------------------------- | --------------------------- |
| `bg-background`           | Page or panel background.   |
| `text-foreground`         | Main text.                  |
| `border-input`            | Input and control borders.  |
| `ring-ring`               | Focus ring.                 |
| `bg-primary`              | Primary actions.            |
| `text-primary-foreground` | Text on primary background. |
| `bg-muted`                | Subtle surfaces.            |
| `text-muted-foreground`   | Secondary text.             |

## Dark mode

Themes include `.dark` selectors.

```html
<html class="dark">
  ...
</html>
```

## Rule

Prefer semantic tokens over hard-coded colors.

````

## `apps/docs/guide/registry.md`

```md
# Registry

The registry package is `@zeus-web/registry`.

It contains shadcn-like component source files under:

```txt
packages/registry/default
````

The CLI reads:

```txt
@zeus-web/registry/registry.json
```

and copies files into your project according to `components.json`.

## Why copy source?

Registry components are meant to be owned by your app. You can edit the generated files after running `zweb add`.

## Per-component primitives

Registry source imports per-component wrapper entries.

```tsx
import { Button as ButtonPrimitive } from '@zeus-web/button/react'
```

Do not import from `@zeus-web/react` in registry source unless you intentionally want the aggregate wrapper package.

## Local imports

Generated components import local utilities:

```tsx
import { cn } from '@/lib/utils'
```

The CLI rewrites this according to `components.json` aliases.

## Registry item shape

```json
{
  "name": "button",
  "type": "registry:ui",
  "dependencies": ["@zeus-web/button"],
  "files": [
    {
      "path": "default/button.tsx",
      "target": "components/ui/button.tsx",
      "type": "registry:ui"
    }
  ]
}
```

````

## `apps/docs/guide/ai.md`

```md
# AI

Zeus Web provides AI metadata through `@zeus-web/ai`.

## Generate markdown

```bash
zweb ai
````

This creates:

```txt
zeus-web.ai.md
```

## Generate JSON

```bash
zweb ai --json
```

This creates:

```txt
zeus-web.ai.json
```

## Generate Cursor rules

```bash
zweb ai --cursor
```

This creates:

```txt
.cursor/rules/zeus-web.mdc
```

## What the guide contains

```txt
recommended workflow
theme names
global usage rules
component props
component events
component slots
examples
AI do / do-not rules
```

## Alias aware

When `components.json` exists, `zweb ai` should use your configured aliases so AI-generated imports match your project.

Example:

```json
{
  "aliases": {
    "ui": "~/components/ui",
    "lib": "~/shared/lib"
  }
}
```

The AI guide should prefer:

```tsx
import { Button } from '~/components/ui/button'
```

## Recommended AI instruction

```txt
Use Zeus Web registry components from the local components/ui directory.
Do not import registry components from package internals.
Prefer zweb add when adding a new component.
Use semantic theme tokens instead of hard-coded colors.
```

````

---

# 8. 新增 docs contract check

## `scripts/checks/check-docs.ts`

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

const requiredDocs: RequiredDoc[] = [
  {
    path: 'index.md',
    mustContain: ['Zeus Web', 'pnpm dlx @zeus-web/cli init'],
  },
  {
    path: 'guide/getting-started.md',
    mustContain: ['# Getting Started', 'zweb init', 'zweb add button input'],
  },
  {
    path: 'guide/cli.md',
    mustContain: ['# CLI', 'zweb init', 'zweb add', 'zweb ai'],
  },
  {
    path: 'guide/theming.md',
    mustContain: ['# Theming', 'default', 'slate', 'zinc', 'neutral', 'stone'],
  },
  {
    path: 'guide/registry.md',
    mustContain: ['# Registry', '@zeus-web/registry', 'registry.json'],
  },
  {
    path: 'guide/ai.md',
    mustContain: ['# AI', '@zeus-web/ai', 'zweb ai --cursor'],
  },
  {
    path: 'components/button.md',
    mustContain: ['# Button', 'zweb add button', '@/components/ui/button'],
  },
  {
    path: 'components/input.md',
    mustContain: ['# Input', 'zweb add input', '@/components/ui/input'],
  },
  {
    path: 'components/checkbox.md',
    mustContain: [
      '# Checkbox',
      'zweb add checkbox',
      '@/components/ui/checkbox',
    ],
  },
  {
    path: 'components/switch.md',
    mustContain: ['# Switch', 'zweb add switch', '@/components/ui/switch'],
  },
  {
    path: 'components/tabs.md',
    mustContain: ['# Tabs', 'zweb add tabs', '@/components/ui/tabs'],
  },
  {
    path: 'components/dialog.md',
    mustContain: ['# Dialog', 'zweb add dialog', '@/components/ui/dialog'],
  },
  {
    path: 'examples/react-vite.md',
    mustContain: ['# React Vite Example', '@zeus-web/example-react-vite'],
  },
  {
    path: 'examples/native-wc.md',
    mustContain: ['# Native Web Components Example', '@zeus-web/example-native-wc'],
  },
]

const forbiddenPatterns = [
  {
    pattern: '@zeus-ui',
    message: 'old @zeus-ui package scope must not appear in docs',
  },
  {
    pattern: 'zeus-ui',
    message: 'old zeus-ui name must not appear in docs content',
  },
]

function readDoc(relativePath: string): string {
  return readFileSync(resolve(docsRoot, relativePath), 'utf-8')
}

function checkFileExists(relativePath: string): string[] {
  const file = resolve(docsRoot, relativePath)

  if (!existsSync(file)) {
    return [`Missing docs file: apps/docs/${relativePath}`]
  }

  return []
}

function checkRequiredContent(doc: RequiredDoc): string[] {
  const errors: string[] = []
  const source = readDoc(doc.path)

  for (const text of doc.mustContain) {
    if (!source.includes(text)) {
      errors.push(`apps/docs/${doc.path} must contain "${text}"`)
    }
  }

  for (const item of forbiddenPatterns) {
    if (source.includes(item.pattern)) {
      errors.push(`apps/docs/${doc.path}: ${item.message}`)
    }
  }

  return errors
}

function checkVitePressConfig(): string[] {
  const configPath = resolve(docsRoot, '.vitepress/config.ts')

  if (!existsSync(configPath)) {
    return ['Missing apps/docs/.vitepress/config.ts']
  }

  const source = readFileSync(configPath, 'utf-8')
  const errors: string[] = []

  for (const route of [
    '/guide/getting-started',
    '/components/button',
    '/examples/react-vite',
  ]) {
    if (!source.includes(route)) {
      errors.push(`VitePress config must include route "${route}"`)
    }
  }

  return errors
}

function checkDocsTheme(): string[] {
  const files = [
    '.vitepress/theme/index.ts',
    '.vitepress/theme/style.css',
    '.vitepress/data/site.ts',
  ]

  return files.flatMap(file => checkFileExists(file))
}

function main(): void {
  const errors: string[] = []

  for (const doc of requiredDocs) {
    errors.push(...checkFileExists(doc.path))

    if (errors.length === 0 || existsSync(resolve(docsRoot, doc.path))) {
      errors.push(...checkRequiredContent(doc))
    }
  }

  errors.push(...checkVitePressConfig())
  errors.push(...checkDocsTheme())

  if (errors.length > 0) {
    console.error(pc.red('Docs contract check failed:'))

    for (const error of errors) {
      console.error(`- ${error}`)
    }

    process.exit(1)
  }

  console.log(pc.green('Docs contract check passed.'))
}

main()
````

---

# 9. Phase 9.1 验收命令

```bash
pnpm docs:check
pnpm docs:build
pnpm site:check

pnpm check
pnpm test
pnpm check:exports
pnpm build
pnpm check:build-output
```

验收标准：

```txt
1. VitePress docs 有统一主题样式。
2. nav/sidebar 从统一 metadata 维护。
3. 首页有产品介绍、快速命令、特性卡片。
4. Guide 文档覆盖 Getting Started / CLI / Theming / Registry / AI。
5. 组件文档覆盖 button/input/checkbox/switch/tabs/dialog。
6. examples 文档覆盖 React Vite 和 Native WC。
7. docs:check 能发现缺失文档、旧 @zeus-ui 命名和缺失关键内容。
8. docs:build 能通过。
```

---

# 10. 建议提交

```txt
docs: polish vitepress site
docs: add docs contract check
chore: add docs check script
```

Phase 9.1 做完后，后续建议进入：

```txt
Phase 9.2：Next.js example
Phase 9.3：Auto docs from aiMetadata / registry
Phase 9.4：Playground
```
