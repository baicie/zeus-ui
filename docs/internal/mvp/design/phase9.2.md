下面给 **Phase 9.2：Next.js App Router Example MVP** 的详细设计与完整代码。

当前根工程已经有 `docs:dev / docs:build / docs:preview`，但还没有 examples 相关脚本。
workspace 已经包含 `examples/*`，所以新增 `examples/next-app` 会自动进入 workspace。
根工程当前 React 类型已经是 19.x，Vite 是 8.x，说明示例可以按当前较新的 React 生态组织。

# Phase 9.2 目标

```txt
Phase 9.2：Next.js App Router Example MVP

目标：
1. 新增 examples/next-app。
2. 使用 Next App Router。
3. 验证 @zeus-web/<component>/react 在 Next Client Component 中可用。
4. 示例使用本地 src/components/ui/*，模拟 zweb add 后的 registry 使用路径。
5. 使用 src/app/globals.css 引入 @zeus-web/themes/default.css。
6. 使用 components.json，验证 aliases.ui / aliases.lib 与 CLI 约定一致。
7. 增加 docs 示例页。
8. 增加 examples:check / examples:build 根脚本。
9. 暂不引入完整 Tailwind 编译链，先用 CSS fallback 保证示例可运行。
```

Phase 9.2 不做：

```txt
不做 Next SSR 组件模式。
不做 Server Component 版本 registry。
不做 Tailwind v4 完整示例。
不做 next/image、route handler、metadata 高级能力。
不做部署配置。
```

原因：Zeus Web 的 React wrapper 和 Web Component 运行时本质是浏览器侧能力，所以 Next 示例应先明确放在 Client Component 边界内。

---

# 1. 修改根 `package.json`

增加 examples 脚本：

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

建议合并后 scripts 保持：

```json
{
  "scripts": {
    "dev": "pnpm -r --parallel --filter './packages/**' dev",
    "build": "tsx scripts/commands/build.ts",
    "build:packages": "tsx scripts/commands/build.ts",
    "clean": "rimraf --glob 'packages/**/dist' --glob 'apps/**/.vitepress/dist' --glob 'examples/**/dist' --glob 'examples/**/.next' temp node_modules/.cache",
    "check": "tsc -p tsconfig.json --incremental --noEmit",
    "check:exports": "tsx scripts/checks/check-package-exports.ts",
    "check:zeus-baseline": "tsx scripts/checks/check-zeus-baseline.ts",
    "check:zeus-imports": "tsx scripts/checks/check-zeus-imports.ts",
    "check:build-output": "tsx scripts/checks/check-build-output.ts",
    "check:workspace-overrides": "tsx scripts/checks/check-workspace-overrides.ts",
    "zeus:relax-peer-ranges": "tsx scripts/commands/relax-zeus-peer-ranges.ts",
    "zeus:update-canary": "tsx scripts/commands/update-zeus-canary.ts",
    "lint": "eslint --cache --cache-location node_modules/.cache/.eslintcache .",
    "lint-fix": "eslint --fix --cache --cache-location node_modules/.cache/.eslintcache .",
    "format": "prettier --write --cache --cache-location node_modules/.cache/.prettiercache .",
    "format-check": "prettier --check --cache --cache-location node_modules/.cache/.prettiercache .",
    "test": "vitest",
    "test-unit": "vitest --project unit*",
    "test-coverage": "vitest run --project unit* --coverage",
    "release": "tsx scripts/commands/release.ts",
    "release:dry": "tsx scripts/commands/release.ts --dry",
    "ci-publish": "tsx scripts/commands/publish.ts",
    "preinstall": "npx only-allow pnpm",
    "postinstall": "simple-git-hooks",
    "docs:dev": "vitepress dev apps/docs",
    "docs:build": "vitepress build apps/docs",
    "docs:preview": "vitepress preview apps/docs",
    "examples:check": "pnpm -r --filter './examples/**' check",
    "examples:build": "pnpm -r --filter './examples/**' build",
    "site:check": "pnpm docs:build && pnpm examples:check",
    "site:build": "pnpm docs:build && pnpm examples:build",
    "link:zeus-js": "tsx scripts/commands/link-local-zeus.ts",
    "unlink:zeus-js": "tsx scripts/commands/unlink-local-zeus.ts && pnpm install"
  }
}
```

---

# 2. 新增 Next 示例

目录：

```txt
examples/next-app
  package.json
  tsconfig.json
  next-env.d.ts
  next.config.ts
  components.json
  src/app/layout.tsx
  src/app/page.tsx
  src/app/globals.css
  src/components/demo.tsx
  src/components/ui/button.tsx
  src/components/ui/input.tsx
  src/components/ui/checkbox.tsx
  src/components/ui/switch.tsx
  src/components/ui/tabs.tsx
  src/components/ui/dialog.tsx
  src/lib/utils.ts
```

---

## `examples/next-app/package.json`

```json
{
  "name": "@zeus-web/example-next-app",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
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
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "next": "^16.2.1",
    "react": "^19.2.1",
    "react-dom": "^19.2.1",
    "tailwind-merge": "^3.4.0"
  },
  "devDependencies": {
    "@types/react": "^19.2.17",
    "@types/react-dom": "^19.2.3",
    "typescript": "^6.0.3"
  }
}
```

---

## `examples/next-app/tsconfig.json`

```json
{
  "extends": "../../scripts/config/tsconfig.base.json",
  "compilerOptions": {
    "composite": false,
    "jsx": "preserve",
    "types": ["node", "react", "react-dom"],
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    },
    "plugins": [
      {
        "name": "next"
      }
    ],
    "isolatedDeclarations": false,
    "noEmit": true
  },
  "include": [
    "next-env.d.ts",
    ".next/types/**/*.ts",
    "src/**/*.ts",
    "src/**/*.tsx",
    "next.config.ts"
  ],
  "exclude": ["node_modules"]
}
```

---

## `examples/next-app/next-env.d.ts`

```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />

// This file should not be edited manually.
// See https://nextjs.org/docs/app/api-reference/config/typescript for more information.
```

---

## `examples/next-app/next.config.ts`

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: [
    '@zeus-web/button',
    '@zeus-web/checkbox',
    '@zeus-web/dialog',
    '@zeus-web/input',
    '@zeus-web/switch',
    '@zeus-web/tabs',
    '@zeus-web/themes',
  ],
}

export default nextConfig
```

---

## `examples/next-app/components.json`

```json
{
  "$schema": "https://zeus-web.dev/schema/components.json",
  "framework": "react",
  "style": "default",
  "tailwind": {
    "css": "src/app/globals.css",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "ui": "@/components/ui",
    "lib": "@/lib"
  }
}
```

---

# 3. App Router 文件

## `examples/next-app/src/app/layout.tsx`

```tsx
import type { Metadata } from 'next'

import '@zeus-web/themes/default.css'
import './globals.css'

export const metadata: Metadata = {
  title: 'Zeus Web Next App Example',
  description:
    'Next.js App Router example for Zeus Web registry-style components.',
}

export default function RootLayout(
  props: Readonly<{ children: React.ReactNode }>,
) {
  return (
    <html lang="en">
      <body>{props.children}</body>
    </html>
  )
}
```

---

## `examples/next-app/src/app/page.tsx`

```tsx
import { Demo } from '@/components/demo'

export default function Page() {
  return <Demo />
}
```

---

## `examples/next-app/src/components/demo.tsx`

```tsx
'use client'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function Demo() {
  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">Zeus Web</p>
        <h1>Next.js App Router Example</h1>
        <p>
          This example validates local registry-style components powered by Zeus
          Web React wrappers inside a Next Client Component.
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

---

## `examples/next-app/src/app/globals.css`

```css
* {
  box-sizing: border-box;
}

html {
  color-scheme: light;
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

button,
input {
  font: inherit;
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
  max-width: 680px;
  line-height: 1.7;
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

/* Button */

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
  cursor: pointer;
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  transition:
    background-color 120ms ease,
    opacity 120ms ease;
}

.zw-button [data-slot='button']:disabled {
  cursor: not-allowed;
  opacity: 0.5;
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

/* Input */

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
  background: hsl(var(--background));
}

.zw-input [data-slot='input'] {
  width: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: hsl(var(--foreground));
}

/* Checkbox / Switch */

.zw-checkbox,
.zw-switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.zw-checkbox [data-slot='checkbox-control'] {
  width: 16px;
  height: 16px;
}

.zw-switch [data-slot='switch-track'] {
  width: 36px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  background: hsl(var(--input));
  padding: 2px;
}

.zw-switch [data-slot='switch-thumb'] {
  width: 16px;
  height: 16px;
  border-radius: 999px;
  background: hsl(var(--background));
  box-shadow: 0 1px 4px rgb(0 0 0 / 24%);
}

.zw-switch[data-state='checked'] [data-slot='switch-track'] {
  background: hsl(var(--primary));
}

.zw-switch[data-state='checked'] [data-slot='switch-thumb'] {
  transform: translateX(16px);
}

/* Tabs */

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

/* Dialog */

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
  z-index: 50;
}

.zw-dialog-title {
  display: block;
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 8px;
}

.zw-dialog-description {
  display: block;
  color: hsl(var(--muted-foreground));
  line-height: 1.6;
}
```

---

# 4. 本地 UI 组件

这些文件是 **registry-like local source**，特意加 `'use client'`，避免被 Next App Router 当成 Server Component 使用。

## `examples/next-app/src/lib/utils.ts`

```ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
```

---

## `examples/next-app/src/components/ui/button.tsx`

```tsx
'use client'

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

---

## `examples/next-app/src/components/ui/input.tsx`

```tsx
'use client'

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

---

## `examples/next-app/src/components/ui/checkbox.tsx`

```tsx
'use client'

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

---

## `examples/next-app/src/components/ui/switch.tsx`

```tsx
'use client'

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

---

## `examples/next-app/src/components/ui/tabs.tsx`

```tsx
'use client'

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

---

## `examples/next-app/src/components/ui/dialog.tsx`

```tsx
'use client'

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

---

# 5. 更新 docs：新增 Next 示例页

## `apps/docs/examples/next-app.md`

````md
# Next.js App Router Example

The Next.js example validates the registry-style React usage path in an App Router project.

Run:

```bash
pnpm --filter @zeus-web/example-next-app dev
```
````

Build:

```bash
pnpm --filter @zeus-web/example-next-app build
```

Type check:

```bash
pnpm --filter @zeus-web/example-next-app check
```

## What this example validates

```txt
1. Local src/components/ui/* components.
2. Per-component React wrapper imports such as @zeus-web/button/react.
3. Client Component boundary with "use client".
4. Theme import through @zeus-web/themes/default.css.
5. components.json aliases.
```

## Client boundary

Zeus Web React wrappers are used in Client Components.

```tsx
'use client'

import { Button } from '@/components/ui/button'

export function Demo() {
  return <Button>Save</Button>
}
```

## Theme import

The example imports the default theme in `src/app/layout.tsx`.

```tsx
import '@zeus-web/themes/default.css'
import './globals.css'
```

## Alias config

The example includes `components.json`.

```json
{
  "aliases": {
    "components": "@/components",
    "ui": "@/components/ui",
    "lib": "@/lib"
  }
}
```

````

---

# 6. 更新 docs metadata

如果你已经做了 9.1 的 `apps/docs/.vitepress/data/site.ts`，修改 `exampleItems`：

```ts
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
````

如果 9.1 还没落地，只修改 `apps/docs/.vitepress/config.ts` 的 sidebar：

```ts
{
  text: 'Examples',
  items: [
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
  ],
}
```

---

# 7. 更新 docs contract check

如果已存在 `scripts/checks/check-docs.ts`，在 `requiredDocs` 中追加：

```ts
{
  path: 'examples/next-app.md',
  mustContain: [
    '# Next.js App Router Example',
    '@zeus-web/example-next-app',
    '@zeus-web/button/react',
    '"use client"',
  ],
}
```

如果你的 docs check 还没落地，则 Phase 9.2 暂时不用加。

---

# 8. 可选：新增 examples contract check

建议在 Phase 9.2 新增一个轻量检查，防止 example 又手写 wrapper 或遗漏 client boundary。

## `scripts/checks/check-examples.ts`

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
    path: 'examples/next-app/package.json',
    mustContain: ['@zeus-web/example-next-app', 'next', '@zeus-web/button'],
  },
  {
    path: 'examples/next-app/components.json',
    mustContain: ['"ui": "@/components/ui"', '"lib": "@/lib"'],
  },
  {
    path: 'examples/next-app/src/app/layout.tsx',
    mustContain: ["import '@zeus-web/themes/default.css'"],
  },
  {
    path: 'examples/next-app/src/components/demo.tsx',
    mustContain: ["'use client'", "from '@/components/ui/button'"],
  },
  {
    path: 'examples/next-app/src/components/ui/button.tsx',
    mustContain: ["'use client'", '@zeus-web/button/react'],
    mustNotContain: ['customElements.define'],
  },
  {
    path: 'examples/next-app/src/components/ui/input.tsx',
    mustContain: ["'use client'", '@zeus-web/input/react'],
    mustNotContain: ['customElements.define'],
  },
  {
    path: 'examples/next-app/src/components/ui/tabs.tsx',
    mustContain: ["'use client'", '@zeus-web/tabs/react'],
    mustNotContain: ['customElements.define'],
  },
  {
    path: 'examples/next-app/src/components/ui/dialog.tsx',
    mustContain: ["'use client'", '@zeus-web/dialog/react'],
    mustNotContain: ['customElements.define'],
  },
]

function checkFile(file: RequiredFile): string[] {
  const absolutePath = resolve(root, file.path)

  if (!existsSync(absolutePath)) {
    return [`Missing example file: ${file.path}`]
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
    console.error(pc.red('Examples contract check failed:'))

    for (const error of errors) {
      console.error(`- ${error}`)
    }

    process.exit(1)
  }

  console.log(pc.green('Examples contract check passed.'))
}

main()
```

然后根 `package.json` 增加：

```json
{
  "scripts": {
    "examples:contract": "tsx scripts/checks/check-examples.ts",
    "examples:check": "pnpm examples:contract && pnpm -r --filter './examples/**' check"
  }
}
```

---

# 9. Phase 9.2 验收命令

```bash
pnpm examples:contract
pnpm --filter @zeus-web/example-next-app check
pnpm --filter @zeus-web/example-next-app build

pnpm examples:check
pnpm examples:build

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
1. examples/next-app 可以 typecheck。
2. examples/next-app 可以 next build。
3. examples/next-app 使用 App Router。
4. examples/next-app 的 UI 文件都有 "use client"。
5. examples/next-app 使用 @zeus-web/<name>/react 单组件入口。
6. examples/next-app 不手写 customElements.define。
7. examples/next-app 引入 @zeus-web/themes/default.css。
8. docs 中出现 Next.js App Router example 页面。
9. examples contract check 通过。
```

---

# 10. 建议提交

```txt
example: add next app router example
docs: document next app example
test: add examples contract check
```

Phase 9.2 完成后，后续建议进入：

```txt
Phase 9.3：Auto docs from aiMetadata / registry
Phase 9.4：Interactive playground
Phase 10：Accessibility & interaction hardening
```
