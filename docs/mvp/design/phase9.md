下面给 **Phase 9：Docs + Examples MVP** 的详细设计与完整代码。

基于当前最新 `mvp`，根 `package.json` 已经预留了 VitePress docs 脚本：`docs:dev / docs:build / docs:preview` 指向 `apps/docs`。
`pnpm-workspace.yaml` 也已经包含 `apps/*` 和 `examples/*`，所以新增 `apps/docs`、`examples/react-vite`、`examples/native-wc` 会自动进入 workspace。
同时根 `tsconfig.json` 已经 include `apps/**/*`，但 exclude `examples/**/*`，所以 docs 可以被根 check 覆盖，examples 需要单独脚本校验。

# Phase 9 目标

```txt
Phase 9：Docs + Examples MVP

目标：
1. 新增 VitePress 文档站 apps/docs。
2. 补 Getting Started / CLI / Theming / Registry / AI / Components 文档。
3. 新增 examples/react-vite，验证 React registry-like 使用路径。
4. 新增 examples/native-wc，验证原生 WC 使用路径。
5. 根脚本增加 docs/examples 检查和构建入口。
6. 文档和示例都围绕当前已完成的 init/add/ai/themes/registry 能力，不提前描述未实现能力。
```

---

# 1. 修改根 `package.json`

只需要在 scripts 增加 examples 相关脚本。

```json
{
  "scripts": {
    "examples:check": "pnpm -r --filter './examples/**' check",
    "examples:build": "pnpm -r --filter './examples/**' build",
    "site:check": "pnpm docs:build && pnpm examples:check",
    "site:build": "pnpm docs:build && pnpm examples:build"
  }
}
```

完整合并后的 scripts 关键片段建议是：

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
    "lint-fix": "eslint --fix --cache --cache-location node_modules/.cache/.eslintcache",
    "format": "prettier --write --cache --cache-location node_modules/.cache/.prettiercache .",
    "format-check": "prettier --check --cache --cache-location node_modules/.cache/.prettiercache .",
    "test": "vitest",
    "test-unit": "vitest --project unit*",
    "test-coverage": "vitest run --project unit* --coverage",
    "docs:dev": "vitepress dev apps/docs",
    "docs:build": "vitepress build apps/docs",
    "docs:preview": "vitepress preview apps/docs",
    "examples:check": "pnpm -r --filter './examples/**' check",
    "examples:build": "pnpm -r --filter './examples/**' build",
    "site:check": "pnpm docs:build && pnpm examples:check",
    "site:build": "pnpm docs:build && pnpm examples:build"
  }
}
```

---

# 2. 新增 docs app

## `apps/docs/package.json`

```json
{
  "name": "@zeus-web/docs",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "vitepress dev .",
    "build": "vitepress build .",
    "preview": "vitepress preview .",
    "check": "tsc -p tsconfig.json --noEmit"
  }
}
```

## `apps/docs/tsconfig.json`

```json
{
  "extends": "../../scripts/config/tsconfig.base.json",
  "compilerOptions": {
    "composite": false,
    "types": ["node"],
    "noEmit": true,
    "isolatedDeclarations": false
  },
  "include": [".vitepress/**/*.ts"]
}
```

## `apps/docs/.vitepress/config.ts`

```ts
import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Zeus Web',
  description:
    'Headless Web Components, shadcn-like registry and AI metadata built on Zeus.',
  cleanUrls: true,
  themeConfig: {
    logo: '/logo.svg',
    nav: [
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
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
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
        ],
      },
      {
        text: 'Components',
        items: [
          {
            text: 'Button',
            link: '/components/button',
          },
          {
            text: 'Input',
            link: '/components/input',
          },
          {
            text: 'Checkbox',
            link: '/components/checkbox',
          },
          {
            text: 'Switch',
            link: '/components/switch',
          },
          {
            text: 'Tabs',
            link: '/components/tabs',
          },
          {
            text: 'Dialog',
            link: '/components/dialog',
          },
        ],
      },
      {
        text: 'Examples',
        items: [
          {
            text: 'React Vite',
            link: '/examples/react-vite',
          },
          {
            text: 'Native Web Components',
            link: '/examples/native-wc',
          },
        ],
      },
    ],
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

## `apps/docs/index.md`

```md
---
layout: home

hero:
  name: Zeus Web
  text: Headless Web Components + shadcn-like registry
  tagline: Build framework-friendly UI on top of Zeus Web Component output.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: Components
      link: /components/button

features:
  - title: Headless primitives
    details: Input, Button, Checkbox, Switch, Tabs and Dialog are provided as reusable primitives.
  - title: Zeus output pipeline
    details: Web Component, React wrapper, Vue wrapper and metadata output are generated by @zeus-js web-c packages.
  - title: Registry workflow
    details: Use zweb init and zweb add to copy shadcn-like styled source into your app.
  - title: AI-ready metadata
    details: Generate zeus-web.ai.md or Cursor rules with zweb ai.
---
```

---

# 3. Guide 文档

## `apps/docs/guide/getting-started.md`

````md
# Getting Started

Zeus Web is a component library workflow built around three layers:

1. **Headless primitives** under `@zeus-web/<component>`.
2. **shadcn-like registry source** copied into your project with `zweb add`.
3. **Themes and AI metadata** for consistent styling and AI-assisted usage.

## Create config

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

and installs the required primitive packages.

## Use the component

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
pnpm dlx @zeus-web/cli ai
```

This creates:

```txt
zeus-web.ai.md
```

For Cursor:

```bash
pnpm dlx @zeus-web/cli ai --cursor
```

````

## `apps/docs/guide/cli.md`

```md
# CLI

The Zeus Web CLI is published as `@zeus-web/cli`.

## init

```bash
zweb init
````

Options:

```txt
--cwd <dir>                 Use a specific project directory
--style <name>              default | slate | zinc | neutral | stone
--css <file>                CSS file to write theme import into
--overwrite                 Replace existing components.json
--no-install                Do not install dependencies
--package-manager <name>    pnpm | npm | yarn | bun
```

Example:

```bash
zweb init --style slate --css src/styles/globals.css
```

## add

```bash
zweb add button input
```

Options:

```txt
--cwd <dir>                 Use a specific project directory
--dry-run                   Print the plan without writing files
--overwrite                 Replace existing files
--no-install                Do not install dependencies
--package-manager <name>    pnpm | npm | yarn | bun
```

Example:

```bash
zweb add dialog --dry-run
zweb add button --overwrite
```

## ai

```bash
zweb ai
```

Options:

```txt
--json                      Generate zeus-web.ai.json
--cursor                    Generate .cursor/rules/zeus-web.mdc
--output <file>             Write to a custom file
--overwrite                 Replace existing file
--dry-run                   Print the plan without writing
```

````

## `apps/docs/guide/theming.md`

```md
# Theming

Zeus Web uses shadcn-like CSS variables and Tailwind semantic tokens.

## Available themes

```txt
default
slate
zinc
neutral
stone
````

Initialize a theme:

```bash
zweb init --style slate
```

This writes:

```css
@import '@zeus-web/themes/slate.css';
```

to the configured CSS file.

## Semantic tokens

Registry components use semantic Tailwind classes:

```txt
bg-background
text-foreground
border-input
ring-ring
bg-primary
text-primary-foreground
bg-muted
text-muted-foreground
```

Avoid hard-coded colors in app components when a theme token exists.

## Dark mode

Themes include `.dark` selectors. Add `dark` to your root element:

```html
<html class="dark">
  ...
</html>
```

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

Registry source imports per-component wrapper entries, for example:

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

````

## `apps/docs/guide/ai.md`

```md
# AI

Zeus Web provides AI metadata through `@zeus-web/ai`.

Generate a markdown guide:

```bash
zweb ai
````

Generate JSON metadata:

```bash
zweb ai --json
```

Generate Cursor rules:

```bash
zweb ai --cursor
```

## What the guide contains

The generated guide contains:

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

````

---

# 4. Components 文档

## `apps/docs/components/button.md`

```md
# Button

Button is built on `@zeus-web/button`.

## Add

```bash
zweb add button
````

## Import

```tsx
import { Button } from '@/components/ui/button'
```

## Usage

```tsx
export function Example() {
  return (
    <div className="flex gap-2">
      <Button>Default</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="danger">Delete</Button>
    </div>
  )
}
```

## Props

```txt
variant: default | primary | secondary | outline | ghost | danger
size: sm | md | lg | icon
disabled: boolean
loading: boolean
pressed: boolean
```

## Events

```txt
onPress
```

## Notes

The styled registry component targets the primitive internal button through `data-slot` selectors.

````

## `apps/docs/components/input.md`

```md
# Input

Input is built on `@zeus-web/input`.

## Add

```bash
zweb add input
````

## Import

```tsx
import { Input } from '@/components/ui/input'
```

## Usage

```tsx
export function Example() {
  return <Input placeholder="Email" type="email" />
}
```

## Props

```txt
value: string
defaultValue: string
type: text | email | password | search | tel | url | number
placeholder: string
disabled: boolean
readonly: boolean
required: boolean
name: string
```

## Events

```txt
onValueChange
```

## Notes

Do not assume the custom element host is the native input. The primitive exposes internal selectors such as `data-slot="input"` and `part="root"`.

````

## `apps/docs/components/checkbox.md`

```md
# Checkbox

Checkbox is built on `@zeus-web/checkbox`.

## Add

```bash
zweb add checkbox
````

## Import

```tsx
import { Checkbox } from '@/components/ui/checkbox'
```

## Usage

```tsx
export function Example() {
  return <Checkbox>Accept terms</Checkbox>
}
```

## Props

```txt
checked: boolean
defaultChecked: boolean
indeterminate: boolean
size: sm | md | lg
disabled: boolean
required: boolean
invalid: boolean
name: string
value: string
```

## Events

```txt
onCheckedChange
onFocusChange
```

````

## `apps/docs/components/switch.md`

```md
# Switch

Switch is built on `@zeus-web/switch`.

## Add

```bash
zweb add switch
````

## Import

```tsx
import { Switch } from '@/components/ui/switch'
```

## Usage

```tsx
export function Example() {
  return <Switch>Enable notifications</Switch>
}
```

## Props

```txt
checked: boolean
defaultChecked: boolean
size: sm | md | lg
disabled: boolean
required: boolean
invalid: boolean
name: string
value: string
```

## Events

```txt
onCheckedChange
onFocusChange
```

````

## `apps/docs/components/tabs.md`

```md
# Tabs

Tabs are built on `@zeus-web/tabs`.

## Add

```bash
zweb add tabs
````

## Import

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
```

## Usage

```tsx
export function Example() {
  return (
    <Tabs defaultValue="account">
      <TabsList>
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="password">Password</TabsTrigger>
      </TabsList>
      <TabsContent value="account">Account panel</TabsContent>
      <TabsContent value="password">Password panel</TabsContent>
    </Tabs>
  )
}
```

## Props

```txt
value: string
defaultValue: string
orientation: horizontal | vertical
disabled: boolean
```

## Events

```txt
onValueChange
```

````

## `apps/docs/components/dialog.md`

```md
# Dialog

Dialog is built on `@zeus-web/dialog`.

## Add

```bash
zweb add dialog
````

## Import

```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
```

## Usage

```tsx
import { Button } from '@/components/ui/button'

export function Example() {
  return (
    <Dialog>
      <DialogTrigger>
        <Button>Open</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Title</DialogTitle>
        <DialogDescription>Description</DialogDescription>
      </DialogContent>
    </Dialog>
  )
}
```

## Props

```txt
open: boolean
defaultOpen: boolean
modal: boolean
```

## Events

```txt
onOpenChange
```

## Notes

Dialog is still MVP-level. Focus trap and advanced accessibility behavior should be improved in the accessibility phase.

````

---

# 5. Examples 文档页

## `apps/docs/examples/react-vite.md`

```md
# React Vite Example

The React Vite example validates the registry-style React usage path.

Run:

```bash
pnpm --filter @zeus-web/example-react-vite dev
````

Build:

```bash
pnpm --filter @zeus-web/example-react-vite build
```

The example uses local `src/components/ui/*` wrappers and imports the generated primitive React entries from `@zeus-web/<component>/react`.

````

## `apps/docs/examples/native-wc.md`

```md
# Native Web Components Example

The native Web Components example validates the direct WC usage path.

Run:

```bash
pnpm --filter @zeus-web/example-native-wc dev
````

Build:

```bash
pnpm --filter @zeus-web/example-native-wc build
```

The example imports WC entries directly:

```ts
import '@zeus-web/button/wc'
import '@zeus-web/input/wc'
```

````

---

# 6. React Vite example

## `examples/react-vite/package.json`

```json
{
  "name": "@zeus-web/example-react-vite",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "check": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^5.1.1",
    "@zeus-web/button": "workspace:*",
    "@zeus-web/checkbox": "workspace:*",
    "@zeus-web/dialog": "workspace:*",
    "@zeus-web/input": "workspace:*",
    "@zeus-web/switch": "workspace:*",
    "@zeus-web/tabs": "workspace:*",
    "@zeus-web/themes": "workspace:*",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "react": "^19.2.1",
    "react-dom": "^19.2.1",
    "tailwind-merge": "^3.4.0",
    "vite": "^8.0.16"
  },
  "devDependencies": {
    "@types/react": "^19.2.17",
    "@types/react-dom": "^19.2.3",
    "typescript": "^6.0.3"
  }
}
````

## `examples/react-vite/tsconfig.json`

```json
{
  "extends": "../../scripts/config/tsconfig.base.json",
  "compilerOptions": {
    "composite": false,
    "jsx": "react-jsx",
    "types": ["vite/client", "react", "react-dom"],
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    },
    "isolatedDeclarations": false,
    "noEmit": true
  },
  "include": ["src", "vite.config.ts"]
}
```

## `examples/react-vite/vite.config.ts`

```ts
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
})
```

## `examples/react-vite/index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Zeus Web React Vite Example</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

## `examples/react-vite/src/main.tsx`

```tsx
import React from 'react'
import { createRoot } from 'react-dom/client'

import '@zeus-web/themes/default.css'
import './styles.css'

import { App } from './App'

const root = document.querySelector('#root')

if (!root) {
  throw new Error('Root element not found.')
}

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

## `examples/react-vite/src/lib/utils.ts`

```ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
```

## `examples/react-vite/src/components/ui/button.tsx`

```tsx
import type { VariantProps } from 'class-variance-authority'

import { Button as ButtonPrimitive } from '@zeus-web/button/react'
import { cva } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/utils'

const buttonVariants = cva('zw-button', {
  variants: {
    variant: {
      default: 'zw-button--default',
      primary: 'zw-button--default',
      secondary: 'zw-button--secondary',
      outline: 'zw-button--outline',
      ghost: 'zw-button--ghost',
      danger: 'zw-button--danger',
    },
    size: {
      sm: 'zw-button--sm',
      md: 'zw-button--md',
      lg: 'zw-button--lg',
      icon: 'zw-button--icon',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'md',
  },
})

export interface ButtonProps
  extends
    React.ComponentPropsWithoutRef<typeof ButtonPrimitive>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <ButtonPrimitive
        ref={ref}
        variant={variant ?? undefined}
        size={size ?? undefined}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    )
  },
)

Button.displayName = 'Button'

export { buttonVariants }
```

## `examples/react-vite/src/components/ui/input.tsx`

```tsx
import { Input as InputPrimitive } from '@zeus-web/input/react'
import * as React from 'react'

import { cn } from '@/lib/utils'

export interface InputProps extends React.ComponentPropsWithoutRef<
  typeof InputPrimitive
> {}

export const Input = React.forwardRef<HTMLElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <InputPrimitive
        ref={ref}
        className={cn('zw-input', className)}
        {...props}
      />
    )
  },
)

Input.displayName = 'Input'
```

## `examples/react-vite/src/components/ui/checkbox.tsx`

```tsx
import { Checkbox as CheckboxPrimitive } from '@zeus-web/checkbox/react'
import * as React from 'react'

import { cn } from '@/lib/utils'

export interface CheckboxProps extends React.ComponentPropsWithoutRef<
  typeof CheckboxPrimitive
> {}

export const Checkbox = React.forwardRef<HTMLElement, CheckboxProps>(
  ({ className, ...props }, ref) => {
    return (
      <CheckboxPrimitive
        ref={ref}
        className={cn('zw-checkbox', className)}
        {...props}
      />
    )
  },
)

Checkbox.displayName = 'Checkbox'
```

## `examples/react-vite/src/components/ui/switch.tsx`

```tsx
import { Switch as SwitchPrimitive } from '@zeus-web/switch/react'
import * as React from 'react'

import { cn } from '@/lib/utils'

export interface SwitchProps extends React.ComponentPropsWithoutRef<
  typeof SwitchPrimitive
> {}

export const Switch = React.forwardRef<HTMLElement, SwitchProps>(
  ({ className, ...props }, ref) => {
    return (
      <SwitchPrimitive
        ref={ref}
        className={cn('zw-switch', className)}
        {...props}
      />
    )
  },
)

Switch.displayName = 'Switch'
```

## `examples/react-vite/src/components/ui/tabs.tsx`

```tsx
import {
  Tabs as TabsPrimitive,
  TabsContent as TabsContentPrimitive,
  TabsList as TabsListPrimitive,
  TabsTrigger as TabsTriggerPrimitive,
} from '@zeus-web/tabs/react'
import * as React from 'react'

import { cn } from '@/lib/utils'

export interface TabsProps extends React.ComponentPropsWithoutRef<
  typeof TabsPrimitive
> {}

export const Tabs = React.forwardRef<HTMLElement, TabsProps>(
  ({ className, ...props }, ref) => {
    return (
      <TabsPrimitive
        ref={ref}
        className={cn('zw-tabs', className)}
        {...props}
      />
    )
  },
)

Tabs.displayName = 'Tabs'

export interface TabsListProps extends React.ComponentPropsWithoutRef<
  typeof TabsListPrimitive
> {}

export const TabsList = React.forwardRef<HTMLElement, TabsListProps>(
  ({ className, ...props }, ref) => {
    return (
      <TabsListPrimitive
        ref={ref}
        className={cn('zw-tabs-list', className)}
        {...props}
      />
    )
  },
)

TabsList.displayName = 'TabsList'

export interface TabsTriggerProps extends React.ComponentPropsWithoutRef<
  typeof TabsTriggerPrimitive
> {}

export const TabsTrigger = React.forwardRef<HTMLElement, TabsTriggerProps>(
  ({ className, ...props }, ref) => {
    return (
      <TabsTriggerPrimitive
        ref={ref}
        className={cn('zw-tabs-trigger', className)}
        {...props}
      />
    )
  },
)

TabsTrigger.displayName = 'TabsTrigger'

export interface TabsContentProps extends React.ComponentPropsWithoutRef<
  typeof TabsContentPrimitive
> {}

export const TabsContent = React.forwardRef<HTMLElement, TabsContentProps>(
  ({ className, ...props }, ref) => {
    return (
      <TabsContentPrimitive
        ref={ref}
        className={cn('zw-tabs-content', className)}
        {...props}
      />
    )
  },
)

TabsContent.displayName = 'TabsContent'
```

## `examples/react-vite/src/components/ui/dialog.tsx`

```tsx
import {
  Dialog as DialogPrimitive,
  DialogClose as DialogClosePrimitive,
  DialogContent as DialogContentPrimitive,
  DialogDescription as DialogDescriptionPrimitive,
  DialogTitle as DialogTitlePrimitive,
  DialogTrigger as DialogTriggerPrimitive,
} from '@zeus-web/dialog/react'
import * as React from 'react'

import { cn } from '@/lib/utils'

export interface DialogProps extends React.ComponentPropsWithoutRef<
  typeof DialogPrimitive
> {}

export const Dialog = React.forwardRef<HTMLElement, DialogProps>(
  ({ className, ...props }, ref) => {
    return (
      <DialogPrimitive
        ref={ref}
        className={cn('zw-dialog', className)}
        {...props}
      />
    )
  },
)

Dialog.displayName = 'Dialog'

export interface DialogTriggerProps extends React.ComponentPropsWithoutRef<
  typeof DialogTriggerPrimitive
> {}

export const DialogTrigger = React.forwardRef<HTMLElement, DialogTriggerProps>(
  ({ className, ...props }, ref) => {
    return (
      <DialogTriggerPrimitive
        ref={ref}
        className={cn('zw-dialog-trigger', className)}
        {...props}
      />
    )
  },
)

DialogTrigger.displayName = 'DialogTrigger'

export interface DialogContentProps extends React.ComponentPropsWithoutRef<
  typeof DialogContentPrimitive
> {}

export const DialogContent = React.forwardRef<HTMLElement, DialogContentProps>(
  ({ className, ...props }, ref) => {
    return (
      <DialogContentPrimitive
        ref={ref}
        className={cn('zw-dialog-content', className)}
        {...props}
      />
    )
  },
)

DialogContent.displayName = 'DialogContent'

export interface DialogTitleProps extends React.ComponentPropsWithoutRef<
  typeof DialogTitlePrimitive
> {}

export const DialogTitle = React.forwardRef<HTMLElement, DialogTitleProps>(
  ({ className, ...props }, ref) => {
    return (
      <DialogTitlePrimitive
        ref={ref}
        className={cn('zw-dialog-title', className)}
        {...props}
      />
    )
  },
)

DialogTitle.displayName = 'DialogTitle'

export interface DialogDescriptionProps extends React.ComponentPropsWithoutRef<
  typeof DialogDescriptionPrimitive
> {}

export const DialogDescription = React.forwardRef<
  HTMLElement,
  DialogDescriptionProps
>(({ className, ...props }, ref) => {
  return (
    <DialogDescriptionPrimitive
      ref={ref}
      className={cn('zw-dialog-description', className)}
      {...props}
    />
  )
})

DialogDescription.displayName = 'DialogDescription'

export interface DialogCloseProps extends React.ComponentPropsWithoutRef<
  typeof DialogClosePrimitive
> {}

export const DialogClose = React.forwardRef<HTMLElement, DialogCloseProps>(
  ({ className, ...props }, ref) => {
    return (
      <DialogClosePrimitive
        ref={ref}
        className={cn('zw-dialog-close', className)}
        {...props}
      />
    )
  },
)

DialogClose.displayName = 'DialogClose'
```

## `examples/react-vite/src/App.tsx`

```tsx
import { Button } from './components/ui/button'
import { Checkbox } from './components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from './components/ui/dialog'
import { Input } from './components/ui/input'
import { Switch } from './components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs'

export function App() {
  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">Zeus Web</p>
        <h1>React Vite Example</h1>
        <p>
          This example validates the React wrapper and registry-like local UI
          usage path.
        </p>
      </section>

      <section className="panel">
        <h2>Button</h2>
        <div className="row">
          <Button>Default</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="danger">Danger</Button>
        </div>
      </section>

      <section className="panel">
        <h2>Input</h2>
        <Input placeholder="Email" type="email" />
      </section>

      <section className="panel">
        <h2>Selection</h2>
        <div className="stack">
          <Checkbox>Accept terms</Checkbox>
          <Switch>Enable notifications</Switch>
        </div>
      </section>

      <section className="panel">
        <h2>Tabs</h2>
        <Tabs defaultValue="account">
          <TabsList>
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="password">Password</TabsTrigger>
          </TabsList>
          <TabsContent value="account">Account panel</TabsContent>
          <TabsContent value="password">Password panel</TabsContent>
        </Tabs>
      </section>

      <section className="panel">
        <h2>Dialog</h2>
        <Dialog>
          <DialogTrigger>
            <Button>Open dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Dialog title</DialogTitle>
            <DialogDescription>
              This dialog is powered by the Zeus Web dialog primitive.
            </DialogDescription>
          </DialogContent>
        </Dialog>
      </section>
    </main>
  )
}
```

## `examples/react-vite/src/styles.css`

```css
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    sans-serif;
}

.page {
  width: min(960px, calc(100vw - 32px));
  margin: 0 auto;
  padding: 48px 0;
}

.hero {
  margin-bottom: 32px;
}

.eyebrow {
  color: hsl(var(--muted-foreground));
  font-size: 14px;
  margin: 0 0 8px;
}

h1,
h2 {
  margin: 0;
}

.hero h1 {
  font-size: 42px;
  letter-spacing: -0.04em;
}

.hero p:last-child {
  color: hsl(var(--muted-foreground));
  max-width: 640px;
}

.panel {
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  padding: 20px;
  margin: 16px 0;
  background: hsl(var(--card));
}

.panel h2 {
  font-size: 18px;
  margin-bottom: 16px;
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.stack {
  display: grid;
  gap: 12px;
}

.zw-button {
  display: inline-flex;
}

.zw-button [data-slot='button'] {
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: var(--radius);
  border: 0;
  padding: 0 16px;
  font: inherit;
  cursor: pointer;
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}

.zw-button--outline [data-slot='button'] {
  border: 1px solid hsl(var(--border));
  background: hsl(var(--background));
  color: hsl(var(--foreground));
}

.zw-button--danger [data-slot='button'] {
  background: hsl(var(--destructive));
  color: hsl(var(--destructive-foreground));
}

.zw-input {
  display: block;
  width: min(420px, 100%);
}

.zw-input [part='root'] {
  height: 36px;
  display: flex;
  align-items: center;
  border: 1px solid hsl(var(--input));
  border-radius: var(--radius);
  padding: 0 12px;
}

.zw-input [data-slot='input'] {
  width: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: hsl(var(--foreground));
  font: inherit;
}

.zw-checkbox,
.zw-switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.zw-tabs {
  display: grid;
  gap: 12px;
}

.zw-tabs-list {
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  border-radius: var(--radius);
  background: hsl(var(--muted));
}

.zw-tabs-trigger [data-slot='tabs-trigger'],
.zw-tabs-trigger button {
  border: 0;
  border-radius: calc(var(--radius) - 2px);
  padding: 6px 12px;
  background: transparent;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
}

.zw-tabs-trigger[data-state='active'] button {
  background: hsl(var(--background));
  color: hsl(var(--foreground));
}

.zw-tabs-content {
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  padding: 16px;
}

.zw-dialog-content [part='content'] {
  position: fixed;
  left: 50%;
  top: 50%;
  width: min(420px, calc(100vw - 32px));
  transform: translate(-50%, -50%);
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  background: hsl(var(--background));
  padding: 24px;
  box-shadow: 0 20px 60px rgb(0 0 0 / 20%);
}
```

---

# 7. Native WC example

## `examples/native-wc/package.json`

```json
{
  "name": "@zeus-web/example-native-wc",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "check": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@zeus-web/button": "workspace:*",
    "@zeus-web/checkbox": "workspace:*",
    "@zeus-web/dialog": "workspace:*",
    "@zeus-web/input": "workspace:*",
    "@zeus-web/switch": "workspace:*",
    "@zeus-web/tabs": "workspace:*",
    "@zeus-web/themes": "workspace:*",
    "vite": "^8.0.16"
  },
  "devDependencies": {
    "typescript": "^6.0.3"
  }
}
```

## `examples/native-wc/tsconfig.json`

```json
{
  "extends": "../../scripts/config/tsconfig.base.json",
  "compilerOptions": {
    "composite": false,
    "types": ["vite/client"],
    "isolatedDeclarations": false,
    "noEmit": true
  },
  "include": ["src"]
}
```

## `examples/native-wc/index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Zeus Web Native WC Example</title>
  </head>
  <body>
    <main class="page">
      <section class="hero">
        <p>Zeus Web</p>
        <h1>Native Web Components Example</h1>
      </section>

      <section class="panel">
        <h2>Button</h2>
        <zw-button variant="primary">Native WC Button</zw-button>
      </section>

      <section class="panel">
        <h2>Input</h2>
        <zw-input placeholder="Email" type="email"></zw-input>
      </section>

      <section class="panel">
        <h2>Selection</h2>
        <zw-checkbox>Accept terms</zw-checkbox>
        <zw-switch>Enable notifications</zw-switch>
      </section>

      <section class="panel">
        <h2>Tabs</h2>
        <zw-tabs default-value="one">
          <zw-tabs-list>
            <zw-tabs-trigger value="one">One</zw-tabs-trigger>
            <zw-tabs-trigger value="two">Two</zw-tabs-trigger>
          </zw-tabs-list>
          <zw-tabs-content value="one">Panel one</zw-tabs-content>
          <zw-tabs-content value="two">Panel two</zw-tabs-content>
        </zw-tabs>
      </section>
    </main>

    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

## `examples/native-wc/src/main.ts`

```ts
import '@zeus-web/themes/default.css'

import '@zeus-web/button/wc'
import '@zeus-web/checkbox/wc'
import '@zeus-web/dialog/wc'
import '@zeus-web/input/wc'
import '@zeus-web/switch/wc'
import '@zeus-web/tabs/wc'

import './styles.css'

window.addEventListener('value-change', event => {
  console.log('value-change', event)
})

window.addEventListener('checked-change', event => {
  console.log('checked-change', event)
})
```

## `examples/native-wc/src/styles.css`

```css
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    sans-serif;
}

.page {
  width: min(860px, calc(100vw - 32px));
  margin: 0 auto;
  padding: 48px 0;
}

.hero {
  margin-bottom: 32px;
}

.hero p {
  color: hsl(var(--muted-foreground));
  margin: 0 0 8px;
}

.hero h1 {
  margin: 0;
  font-size: 40px;
  letter-spacing: -0.04em;
}

.panel {
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  padding: 20px;
  margin: 16px 0;
  background: hsl(var(--card));
}

.panel h2 {
  margin: 0 0 16px;
  font-size: 18px;
}

zw-button [data-slot='button'] {
  height: 36px;
  border: 0;
  border-radius: var(--radius);
  padding: 0 16px;
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  font: inherit;
  cursor: pointer;
}

zw-input {
  display: block;
  width: min(420px, 100%);
}

zw-input [part='root'] {
  height: 36px;
  display: flex;
  align-items: center;
  border: 1px solid hsl(var(--input));
  border-radius: var(--radius);
  padding: 0 12px;
}

zw-input [data-slot='input'] {
  border: 0;
  outline: 0;
  background: transparent;
  color: hsl(var(--foreground));
  font: inherit;
}

zw-checkbox,
zw-switch {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 0;
}

zw-tabs {
  display: grid;
  gap: 12px;
}

zw-tabs-list {
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  border-radius: var(--radius);
  background: hsl(var(--muted));
}

zw-tabs-trigger button {
  border: 0;
  border-radius: calc(var(--radius) - 2px);
  padding: 6px 12px;
  background: transparent;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
}

zw-tabs-trigger[data-state='active'] button {
  background: hsl(var(--background));
  color: hsl(var(--foreground));
}

zw-tabs-content {
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  padding: 16px;
}
```

---

# 8. Phase 9 验收命令

```bash
pnpm docs:build
pnpm examples:check
pnpm examples:build
pnpm site:build

pnpm check
pnpm test
pnpm check:exports
pnpm build
pnpm check:build-output
```

验收标准：

```txt
1. apps/docs 能通过 vitepress build。
2. docs 包含 getting-started / cli / theming / registry / ai。
3. docs 包含 6 个 MVP 组件文档。
4. examples/react-vite 能通过 tsc 和 vite build。
5. examples/native-wc 能通过 tsc 和 vite build。
6. Native WC 示例使用 @zeus-web/<name>/wc。
7. React 示例使用 @zeus-web/<name>/react。
8. 示例不手写 customElements.define。
```

---

# 9. Phase 9 不做什么

```txt
不做完整官网视觉设计。
不做 VitePress 自定义主题。
不做在线 Playground。
不做所有组件 API 自动生成。
不做 examples/next-app。
不做 docs 自动从 AI metadata 生成。
```

这些放到后续：

```txt
Phase 9.1：Docs polish
Phase 9.2：Next.js example
Phase 9.3：Auto docs from aiMetadata / registry
Phase 9.4：Playground
```

建议提交：

```txt
docs: add vitepress documentation site
example: add react vite and native wc examples
chore: add docs and examples build scripts
```
