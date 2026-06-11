下面给 **Phase 5：Registry Styled UI MVP** 的详细设计与完整代码。

基于当前 `mvp` 分支，Phase 4 已经把 `@zeus-web/themes` 做起来了，`tokens/default/slate/zinc/neutral/stone` 都已经导出，`themeNames / semanticColorTokens` 等元信息也已经存在。

当前 `@zeus-web/registry` 已经有 `registry.json`，并且 `input/button/checkbox/switch/tabs/dialog` 都已经登记了。 但现在还缺真正的 styled source 文件，也就是 `button.tsx / input.tsx / dialog.tsx` 这些 shadcn-like 可复制源码。CLI 的 `add` 当前也还只是打印计划，而且只认识 `input`。

# Phase 5 目标

```txt
Phase 5：Registry Styled UI MVP

目标：
1. 给 registry 增加可复制源码文件。
2. registry 组件默认面向 React + Tailwind。
3. registry 组件依赖对应单 primitive 包，而不是 @zeus-web/react 聚合包。
4. 每个 registry item 都只安装自己的 primitive。
5. 提供 cn 工具源码。
6. 提供 registry 校验逻辑。
7. CLI add 先升级为完整 add plan，不在 Phase 5 真复制文件。
8. 真正写文件、安装依赖、合并 CSS 放到 Phase 6。
```

---

# 1. Phase 5 文件变更总览

```txt
修改：
  packages/registry/package.json
  packages/registry/registry.json
  packages/registry/src/index.ts
  packages/cli/src/commands/add.ts

新增：
  packages/registry/default/lib/utils.ts
  packages/registry/default/input.tsx
  packages/registry/default/button.tsx
  packages/registry/default/checkbox.tsx
  packages/registry/default/switch.tsx
  packages/registry/default/tabs.tsx
  packages/registry/default/dialog.tsx
  packages/registry/src/validate.ts
  packages/registry/__tests__/registry.spec.ts
  packages/cli/__tests__/add.spec.ts
```

Phase 5 不做真实文件复制，是为了保证边界清楚：

```txt
Phase 5：registry 数据和源码正确
Phase 6：CLI 读取 registry 并复制到用户项目
```

---

# 2. `packages/registry/package.json`

当前 registry 包只把 `dist` 和 `registry.json` 放进 files。 Phase 5 要把 `default` 模板目录也发出去。

替换为：

```json
{
  "name": "@zeus-web/registry",
  "type": "module",
  "version": "0.0.0",
  "description": "Registry for Zeus Web shadcn-like components.",
  "license": "MIT",
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./registry.json": {
      "default": "./registry.json"
    }
  },
  "files": ["dist", "registry.json", "default"],
  "scripts": {
    "dev": "tsup src/index.ts --format esm --dts --clean --watch",
    "build": "tsup src/index.ts --format esm --dts --clean",
    "check": "tsc -p tsconfig.json --noEmit",
    "test": "vitest --root ../.. --project unit packages/registry/__tests__/registry.spec.ts"
  }
}
```

---

# 3. `packages/registry/src/index.ts`

当前只有最基本的类型。 Phase 5 需要扩展成 registry schema，并导出校验函数。

替换为：

```ts
export type RegistryItemType =
  | 'registry:ui'
  | 'registry:block'
  | 'registry:lib'
  | 'registry:style'

export type RegistryFileType = 'registry:ui' | 'registry:lib' | 'registry:style'

export interface RegistryItemFile {
  path: string
  target: string
  type: RegistryFileType
}

export interface RegistryItem {
  name: string
  type: RegistryItemType
  description?: string
  dependencies?: string[]
  devDependencies?: string[]
  files: RegistryItemFile[]
}

export interface Registry {
  $schema?: string
  name: string
  homepage?: string
  items: RegistryItem[]
}

export interface RegistryValidationResult {
  valid: boolean
  errors: string[]
}

export * from './validate'
```

---

# 4. `packages/registry/src/validate.ts`

新增：

```ts
import type { Registry, RegistryValidationResult } from './index'

export function validateRegistry(registry: Registry): RegistryValidationResult {
  const errors: string[] = []
  const itemNames = new Set<string>()

  if (registry.name !== '@zeus-web/registry') {
    errors.push('registry.name must be @zeus-web/registry')
  }

  if (!Array.isArray(registry.items)) {
    errors.push('registry.items must be an array')
    return {
      valid: false,
      errors,
    }
  }

  for (const item of registry.items) {
    if (!item.name) {
      errors.push('registry item name is required')
      continue
    }

    if (itemNames.has(item.name)) {
      errors.push(`duplicated registry item: ${item.name}`)
    }

    itemNames.add(item.name)

    if (!item.type) {
      errors.push(`registry item "${item.name}" type is required`)
    }

    if (!Array.isArray(item.files) || item.files.length === 0) {
      errors.push(`registry item "${item.name}" must include files`)
    }

    for (const file of item.files ?? []) {
      if (!file.path) {
        errors.push(`registry item "${item.name}" has file without path`)
      }

      if (!file.target) {
        errors.push(`registry item "${item.name}" has file without target`)
      }

      if (!file.type) {
        errors.push(`registry item "${item.name}" has file without type`)
      }
    }

    if (item.type === 'registry:ui') {
      const expectedPrimitive = `@zeus-web/${item.name}`
      const dependencies = item.dependencies ?? []

      if (!dependencies.includes(expectedPrimitive)) {
        errors.push(
          `registry ui item "${item.name}" must depend on ${expectedPrimitive}`,
        )
      }

      if (!dependencies.includes('class-variance-authority')) {
        errors.push(
          `registry ui item "${item.name}" must depend on class-variance-authority`,
        )
      }

      if (!dependencies.includes('clsx')) {
        errors.push(`registry ui item "${item.name}" must depend on clsx`)
      }

      if (!dependencies.includes('tailwind-merge')) {
        errors.push(
          `registry ui item "${item.name}" must depend on tailwind-merge`,
        )
      }

      const hasUiFile = item.files.some(file =>
        file.target.startsWith('components/ui/'),
      )

      if (!hasUiFile) {
        errors.push(`registry ui item "${item.name}" must target components/ui`)
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
```

---

# 5. `packages/registry/registry.json`

当前 `registry.json` 已经有 6 个 item，但文件路径是 `input.tsx/button.tsx`。 Phase 5 建议改成 `default/*.tsx`，并把 shared util 放进每个组件的 files 里，保证 `zweb add input` 可以独立得到 `utils.ts`。

替换为：

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
    }
  ]
}
```

---

# 6. Registry shared util

## `packages/registry/default/lib/utils.ts`

新增：

```ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
```

---

# 7. Registry styled components

这些是用户项目里最终复制出来的源码，默认 React + Tailwind + class-variance-authority。
注意：它们依赖的是单 primitive 包，比如 `@zeus-web/button/react`，不是 `@zeus-web/react` 聚合包。

---

## `packages/registry/default/button.tsx`

新增：

```tsx
import * as React from 'react'
import { Button as ButtonPrimitive } from '@zeus-web/button/react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors',
    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
    'disabled:pointer-events-none disabled:opacity-50',
    '[&_[data-slot=button-prefix]]:inline-flex [&_[data-slot=button-prefix]]:items-center',
    '[&_[data-slot=button-suffix]]:inline-flex [&_[data-slot=button-suffix]]:items-center',
  ].join(' '),
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow hover:bg-primary/90',
        primary:
          'bg-primary text-primary-foreground shadow hover:bg-primary/90',
        secondary:
          'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
        outline:
          'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        danger:
          'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
      },
      size: {
        sm: 'h-8 rounded-md px-3 text-xs',
        md: 'h-9 px-4 py-2',
        lg: 'h-10 rounded-md px-8',
        icon: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
)

export interface ButtonProps
  extends
    React.ComponentPropsWithoutRef<typeof ButtonPrimitive>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <ButtonPrimitive
        ref={ref}
        data-slot="button"
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

## `packages/registry/default/input.tsx`

新增：

```tsx
import * as React from 'react'
import { Input as InputPrimitive } from '@zeus-web/input/react'

import { cn } from '@/lib/utils'

export interface InputProps extends React.ComponentPropsWithoutRef<
  typeof InputPrimitive
> {}

export const Input = React.forwardRef<HTMLElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <InputPrimitive
        ref={ref}
        data-slot="input"
        type={type}
        className={cn(
          [
            'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors',
            'file:border-0 file:bg-transparent file:text-sm file:font-medium',
            'placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-50',
          ].join(' '),
          className,
        )}
        {...props}
      />
    )
  },
)

Input.displayName = 'Input'
```

---

## `packages/registry/default/checkbox.tsx`

新增：

```tsx
import * as React from 'react'
import { Checkbox as CheckboxPrimitive } from '@zeus-web/checkbox/react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const checkboxVariants = cva(
  [
    'inline-flex items-center gap-2 text-sm leading-none',
    'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
    '[&_[data-slot=checkbox-control]]:size-4',
    '[&_[data-slot=checkbox-control]]:rounded-sm',
    '[&_[data-slot=checkbox-control]]:border',
    '[&_[data-slot=checkbox-control]]:border-primary',
    '[&_[data-slot=checkbox-control]]:bg-background',
    '[&_[data-slot=checkbox-control]]:text-primary-foreground',
    '[&_[data-slot=checkbox-control]]:focus-visible:outline-none',
    '[&_[data-slot=checkbox-control]]:focus-visible:ring-1',
    '[&_[data-slot=checkbox-control]]:focus-visible:ring-ring',
    '[&_[data-slot=checkbox-control]]:disabled:cursor-not-allowed',
    '[&_[data-slot=checkbox-control]]:disabled:opacity-50',
    'data-[state=checked]:[&_[data-slot=checkbox-control]]:bg-primary',
    'data-[state=checked]:[&_[data-slot=checkbox-control]]:text-primary-foreground',
    'data-[state=indeterminate]:[&_[data-slot=checkbox-control]]:bg-primary',
    'data-[state=indeterminate]:[&_[data-slot=checkbox-control]]:text-primary-foreground',
  ].join(' '),
  {
    variants: {
      size: {
        sm: '[&_[data-slot=checkbox-control]]:size-3 text-xs',
        md: '[&_[data-slot=checkbox-control]]:size-4 text-sm',
        lg: '[&_[data-slot=checkbox-control]]:size-5 text-base',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  },
)

export interface CheckboxProps
  extends
    React.ComponentPropsWithoutRef<typeof CheckboxPrimitive>,
    VariantProps<typeof checkboxVariants> {}

export const Checkbox = React.forwardRef<HTMLElement, CheckboxProps>(
  ({ className, size, children, ...props }, ref) => {
    return (
      <CheckboxPrimitive
        ref={ref}
        data-slot="checkbox"
        size={size ?? undefined}
        className={cn(checkboxVariants({ size }), className)}
        {...props}
      >
        {children}
      </CheckboxPrimitive>
    )
  },
)

Checkbox.displayName = 'Checkbox'

export { checkboxVariants }
```

---

## `packages/registry/default/switch.tsx`

新增：

```tsx
import * as React from 'react'
import { Switch as SwitchPrimitive } from '@zeus-web/switch/react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const switchVariants = cva(
  [
    'inline-flex items-center gap-2 text-sm',
    'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
    '[&_[data-slot=switch-track]]:relative',
    '[&_[data-slot=switch-track]]:inline-flex',
    '[&_[data-slot=switch-track]]:shrink-0',
    '[&_[data-slot=switch-track]]:cursor-pointer',
    '[&_[data-slot=switch-track]]:items-center',
    '[&_[data-slot=switch-track]]:rounded-full',
    '[&_[data-slot=switch-track]]:border-2',
    '[&_[data-slot=switch-track]]:border-transparent',
    '[&_[data-slot=switch-track]]:bg-input',
    '[&_[data-slot=switch-track]]:transition-colors',
    '[&_[data-slot=switch-thumb]]:pointer-events-none',
    '[&_[data-slot=switch-thumb]]:block',
    '[&_[data-slot=switch-thumb]]:rounded-full',
    '[&_[data-slot=switch-thumb]]:bg-background',
    '[&_[data-slot=switch-thumb]]:shadow-lg',
    '[&_[data-slot=switch-thumb]]:ring-0',
    '[&_[data-slot=switch-thumb]]:transition-transform',
    'data-[state=checked]:[&_[data-slot=switch-track]]:bg-primary',
  ].join(' '),
  {
    variants: {
      size: {
        sm: [
          '[&_[data-slot=switch-track]]:h-4',
          '[&_[data-slot=switch-track]]:w-7',
          '[&_[data-slot=switch-thumb]]:size-3',
          'data-[state=checked]:[&_[data-slot=switch-thumb]]:translate-x-3',
        ].join(' '),
        md: [
          '[&_[data-slot=switch-track]]:h-5',
          '[&_[data-slot=switch-track]]:w-9',
          '[&_[data-slot=switch-thumb]]:size-4',
          'data-[state=checked]:[&_[data-slot=switch-thumb]]:translate-x-4',
        ].join(' '),
        lg: [
          '[&_[data-slot=switch-track]]:h-6',
          '[&_[data-slot=switch-track]]:w-11',
          '[&_[data-slot=switch-thumb]]:size-5',
          'data-[state=checked]:[&_[data-slot=switch-thumb]]:translate-x-5',
        ].join(' '),
      },
    },
    defaultVariants: {
      size: 'md',
    },
  },
)

export interface SwitchProps
  extends
    React.ComponentPropsWithoutRef<typeof SwitchPrimitive>,
    VariantProps<typeof switchVariants> {}

export const Switch = React.forwardRef<HTMLElement, SwitchProps>(
  ({ className, size, children, ...props }, ref) => {
    return (
      <SwitchPrimitive
        ref={ref}
        data-slot="switch"
        size={size ?? undefined}
        className={cn(switchVariants({ size }), className)}
        {...props}
      >
        {children}
      </SwitchPrimitive>
    )
  },
)

Switch.displayName = 'Switch'

export { switchVariants }
```

---

## `packages/registry/default/tabs.tsx`

新增：

```tsx
import * as React from 'react'
import {
  Tabs as TabsPrimitive,
  TabsContent as TabsContentPrimitive,
  TabsList as TabsListPrimitive,
  TabsTrigger as TabsTriggerPrimitive,
} from '@zeus-web/tabs/react'

import { cn } from '@/lib/utils'

export interface TabsProps extends React.ComponentPropsWithoutRef<
  typeof TabsPrimitive
> {}

export const Tabs = React.forwardRef<HTMLElement, TabsProps>(
  ({ className, ...props }, ref) => {
    return (
      <TabsPrimitive
        ref={ref}
        data-slot="tabs"
        className={cn('flex flex-col gap-2', className)}
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
        data-slot="tabs-list"
        className={cn(
          'inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground',
          className,
        )}
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
        data-slot="tabs-trigger"
        className={cn(
          [
            'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium',
            'ring-offset-background transition-all',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:pointer-events-none disabled:opacity-50',
            'data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow',
          ].join(' '),
          className,
        )}
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
        data-slot="tabs-content"
        className={cn(
          'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          className,
        )}
        {...props}
      />
    )
  },
)

TabsContent.displayName = 'TabsContent'
```

---

## `packages/registry/default/dialog.tsx`

新增：

```tsx
import * as React from 'react'
import {
  Dialog as DialogPrimitive,
  DialogClose as DialogClosePrimitive,
  DialogContent as DialogContentPrimitive,
  DialogDescription as DialogDescriptionPrimitive,
  DialogTitle as DialogTitlePrimitive,
  DialogTrigger as DialogTriggerPrimitive,
} from '@zeus-web/dialog/react'

import { cn } from '@/lib/utils'

export interface DialogProps extends React.ComponentPropsWithoutRef<
  typeof DialogPrimitive
> {}

export const Dialog = React.forwardRef<HTMLElement, DialogProps>(
  ({ className, ...props }, ref) => {
    return (
      <DialogPrimitive
        ref={ref}
        data-slot="dialog"
        className={cn('', className)}
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
        data-slot="dialog-trigger"
        className={cn('', className)}
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
        data-slot="dialog-content"
        className={cn(
          [
            'fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg',
            '-translate-x-1/2 -translate-y-1/2 gap-4',
            'border bg-background p-6 shadow-lg duration-200',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'sm:rounded-lg',
          ].join(' '),
          className,
        )}
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
        data-slot="dialog-title"
        className={cn(
          'text-lg font-semibold leading-none tracking-tight',
          className,
        )}
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
      data-slot="dialog-description"
      className={cn('text-sm text-muted-foreground', className)}
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
        data-slot="dialog-close"
        className={cn(
          [
            'absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity',
            'hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            'disabled:pointer-events-none',
          ].join(' '),
          className,
        )}
        {...props}
      />
    )
  },
)

DialogClose.displayName = 'DialogClose'
```

---

# 8. Registry 测试

## `packages/registry/__tests__/registry.spec.ts`

新增或替换为：

```ts
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { validateRegistry, type Registry } from '../src'

const testDir = dirname(fileURLToPath(import.meta.url))
const registryRoot = resolve(testDir, '..')
const registryJsonPath = resolve(registryRoot, 'registry.json')

function readRegistry(): Registry {
  return JSON.parse(readFileSync(registryJsonPath, 'utf-8')) as Registry
}

describe('@zeus-web/registry registry.json', () => {
  it('uses zeus-web registry name', () => {
    const registry = readRegistry()

    expect(registry.name).toBe('@zeus-web/registry')
  })

  it('contains MVP primitive registry items', () => {
    const registry = readRegistry()

    expect(registry.items.map(item => item.name)).toEqual([
      'input',
      'button',
      'checkbox',
      'switch',
      'tabs',
      'dialog',
    ])
  })

  it('passes registry validation', () => {
    const registry = readRegistry()
    const result = validateRegistry(registry)

    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })

  it('uses per-primitive @zeus-web dependencies', () => {
    const registry = readRegistry()

    for (const item of registry.items) {
      expect(item.type).toBe('registry:ui')
      expect(item.dependencies).toContain(`@zeus-web/${item.name}`)
      expect(item.dependencies).toContain('class-variance-authority')
      expect(item.dependencies).toContain('clsx')
      expect(item.dependencies).toContain('tailwind-merge')
    }
  })

  it('references existing registry source files', () => {
    const registry = readRegistry()

    for (const item of registry.items) {
      for (const file of item.files) {
        expect(
          existsSync(resolve(registryRoot, file.path)),
          `${item.name} -> ${file.path}`,
        ).toBe(true)
      }
    }
  })

  it('ships shared utils source', () => {
    expect(existsSync(resolve(registryRoot, 'default/lib/utils.ts'))).toBe(true)
  })

  it('does not depend on @zeus-web/react aggregate package', () => {
    const registry = readRegistry()
    const sourceFiles = registry.items.flatMap(item => item.files)

    for (const file of sourceFiles) {
      if (!file.path.endsWith('.tsx') && !file.path.endsWith('.ts')) continue

      const source = readFileSync(resolve(registryRoot, file.path), 'utf-8')

      expect(source).not.toContain('@zeus-web/react')
    }
  })

  it('uses single primitive react entries in styled sources', () => {
    const registry = readRegistry()

    for (const item of registry.items) {
      const uiFile = item.files.find(file => file.type === 'registry:ui')
      expect(uiFile).toBeDefined()

      const source = readFileSync(resolve(registryRoot, uiFile!.path), 'utf-8')

      expect(source).toContain(`@zeus-web/${item.name}/react`)
    }
  })
})
```

---

# 9. CLI add plan 升级

当前 CLI `add` 只认识 input，并且注释还写着 `@zeus-ui/registry`。 Phase 5 先把它升级为完整 registry-driven add plan，但不写文件。

## `packages/cli/src/commands/add.ts`

替换为：

```ts
import pc from 'picocolors'

export interface RegistryFilePlan {
  source: string
  target: string
  type: 'registry:ui' | 'registry:lib' | 'registry:style'
}

export interface AddPlan {
  component: string
  dependencies: string[]
  files: RegistryFilePlan[]
}

const registryItems: Record<string, AddPlan> = {
  input: {
    component: 'input',
    dependencies: [
      '@zeus-web/input',
      'class-variance-authority',
      'clsx',
      'tailwind-merge',
    ],
    files: [
      {
        source: 'default/lib/utils.ts',
        target: 'lib/utils.ts',
        type: 'registry:lib',
      },
      {
        source: 'default/input.tsx',
        target: 'components/ui/input.tsx',
        type: 'registry:ui',
      },
    ],
  },
  button: {
    component: 'button',
    dependencies: [
      '@zeus-web/button',
      'class-variance-authority',
      'clsx',
      'tailwind-merge',
    ],
    files: [
      {
        source: 'default/lib/utils.ts',
        target: 'lib/utils.ts',
        type: 'registry:lib',
      },
      {
        source: 'default/button.tsx',
        target: 'components/ui/button.tsx',
        type: 'registry:ui',
      },
    ],
  },
  checkbox: {
    component: 'checkbox',
    dependencies: [
      '@zeus-web/checkbox',
      'class-variance-authority',
      'clsx',
      'tailwind-merge',
    ],
    files: [
      {
        source: 'default/lib/utils.ts',
        target: 'lib/utils.ts',
        type: 'registry:lib',
      },
      {
        source: 'default/checkbox.tsx',
        target: 'components/ui/checkbox.tsx',
        type: 'registry:ui',
      },
    ],
  },
  switch: {
    component: 'switch',
    dependencies: [
      '@zeus-web/switch',
      'class-variance-authority',
      'clsx',
      'tailwind-merge',
    ],
    files: [
      {
        source: 'default/lib/utils.ts',
        target: 'lib/utils.ts',
        type: 'registry:lib',
      },
      {
        source: 'default/switch.tsx',
        target: 'components/ui/switch.tsx',
        type: 'registry:ui',
      },
    ],
  },
  tabs: {
    component: 'tabs',
    dependencies: [
      '@zeus-web/tabs',
      'class-variance-authority',
      'clsx',
      'tailwind-merge',
    ],
    files: [
      {
        source: 'default/lib/utils.ts',
        target: 'lib/utils.ts',
        type: 'registry:lib',
      },
      {
        source: 'default/tabs.tsx',
        target: 'components/ui/tabs.tsx',
        type: 'registry:ui',
      },
    ],
  },
  dialog: {
    component: 'dialog',
    dependencies: [
      '@zeus-web/dialog',
      'class-variance-authority',
      'clsx',
      'tailwind-merge',
    ],
    files: [
      {
        source: 'default/lib/utils.ts',
        target: 'lib/utils.ts',
        type: 'registry:lib',
      },
      {
        source: 'default/dialog.tsx',
        target: 'components/ui/dialog.tsx',
        type: 'registry:ui',
      },
    ],
  },
}

export function listAvailableComponents(): string[] {
  return Object.keys(registryItems)
}

export function createAddPlan(components: string[]): AddPlan[] {
  return components.map(component => {
    const item = registryItems[component]

    if (!item) {
      throw new Error(`Unknown component: ${component}`)
    }

    return item
  })
}

export async function add(args: string[]) {
  const components = args.filter(Boolean)

  if (components.length === 0) {
    console.error(pc.red('Please provide at least one component.'))
    console.log(`Example: zweb add ${listAvailableComponents().join(' ')}`)
    process.exit(1)
  }

  try {
    const plans = createAddPlan(components)

    for (const plan of plans) {
      console.log(pc.green(`Add ${plan.component}`))
      console.log(`Dependencies: ${plan.dependencies.join(', ')}`)
      console.log('Files:')

      for (const file of plan.files) {
        console.log(`  ${file.source} -> ${file.target}`)
      }
    }

    console.log(
      pc.gray(
        'Phase 5 only prints add plan. Phase 6 will copy files and install dependencies.',
      ),
    )
  } catch (error) {
    console.error(pc.red((error as Error).message))
    process.exitCode = 1
  }
}
```

---

# 10. CLI add 测试

## `packages/cli/__tests__/add.spec.ts`

新增：

```ts
import { createAddPlan, listAvailableComponents } from '../src/commands/add'

describe('@zeus-web/cli add plan', () => {
  it('lists MVP components', () => {
    expect(listAvailableComponents()).toEqual([
      'input',
      'button',
      'checkbox',
      'switch',
      'tabs',
      'dialog',
    ])
  })

  it('creates add plan for one component', () => {
    const [plan] = createAddPlan(['button'])

    expect(plan).toMatchObject({
      component: 'button',
      dependencies: [
        '@zeus-web/button',
        'class-variance-authority',
        'clsx',
        'tailwind-merge',
      ],
      files: [
        {
          source: 'default/lib/utils.ts',
          target: 'lib/utils.ts',
          type: 'registry:lib',
        },
        {
          source: 'default/button.tsx',
          target: 'components/ui/button.tsx',
          type: 'registry:ui',
        },
      ],
    })
  })

  it('creates add plan for multiple components', () => {
    const plans = createAddPlan(['input', 'dialog'])

    expect(plans.map(plan => plan.component)).toEqual(['input', 'dialog'])
    expect(plans[0].dependencies).toContain('@zeus-web/input')
    expect(plans[1].dependencies).toContain('@zeus-web/dialog')
  })

  it('throws on unknown component', () => {
    expect(() => createAddPlan(['unknown'])).toThrow(
      'Unknown component: unknown',
    )
  })
})
```

确保 `packages/cli/package.json` 有 test：

```json
{
  "scripts": {
    "test": "vitest --root ../.. --project unit packages/cli/__tests__/add.spec.ts"
  }
}
```

---

# 11. Phase 5 验收命令

```bash
pnpm --filter @zeus-web/registry check
pnpm --filter @zeus-web/registry test
pnpm --filter @zeus-web/registry build

pnpm --filter @zeus-web/cli check
pnpm --filter @zeus-web/cli test
pnpm --filter @zeus-web/cli build

pnpm check
pnpm test
pnpm check:exports
pnpm build
pnpm check:build-output
```

验收标准：

```txt
1. registry.json 包含 input/button/checkbox/switch/tabs/dialog。
2. 每个 item 依赖对应 @zeus-web/<primitive>。
3. 每个 item 包含 default/lib/utils.ts。
4. 每个 item 包含 default/<name>.tsx。
5. 所有 registry source 文件真实存在。
6. styled source 不 import @zeus-web/react 聚合包。
7. styled source 使用 @zeus-web/<name>/react 单组件入口。
8. zweb add button 能打印完整 dependencies 和 files plan。
```

---

# 12. Phase 5 不做什么

```txt
不真实写入用户项目文件。
不自动执行 pnpm add。
不合并 global.css。
不解析 components.json alias。
不处理 overwrite / dry-run。
不做 Vue registry。
```

这些进入 Phase 6。

---

# 13. 建议提交

```txt
feat(registry): add default styled component sources
feat(registry): validate registry json contract
feat(cli): create registry-driven add plan
test(registry): cover registry source files
test(cli): cover add plan generation
```

Phase 5 完成后，Phase 6 就可以实现真正的：

```bash
pnpm dlx @zeus-web/cli add button input dialog
```

实际效果：

```txt
安装依赖：
  @zeus-web/button
  @zeus-web/input
  @zeus-web/dialog
  class-variance-authority
  clsx
  tailwind-merge

复制文件：
  components/ui/button.tsx
  components/ui/input.tsx
  components/ui/dialog.tsx
  lib/utils.ts
```
