下面给 **Phase 17：Registry Foundation** 的详细设计与完整代码。

Phase 17 的边界要卡住：**只做 registry 元数据、schema、React/Vue button/input 模板、检查脚本和文档，不做 CLI `init/add`，不切换 showcase。**

当前 `fix/mvp` 已经有 `check:product-layers / check:ui-package` 并且接入 `site:check`。 `@zeus-web/ui` 也已经作为 native styled Web-C 包存在，并导出 `styles.css / button / input`。
所以 Phase 17 是在这个基础上新增 **`@zeus-web/registry`**，为 Phase 18/19 的 CLI 做数据基础。

---

# Phase 17 目标

```txt id="l0efuq"
Phase 17 = @zeus-web/registry foundation

新增：
  - packages/registry
  - registry schema
  - registry.json
  - React button/input styled templates
  - Vue button/input styled templates
  - globals.css template
  - cn utility template
  - check-registry 脚本
  - registry package unit tests
  - registry design doc
  - roadmap Phase 17 Done

不做：
  - 不做 CLI init
  - 不做 CLI add
  - 不做 registry 远程服务
  - 不切换 React/Vue showcase
  - 不新增 native showcase
```

---

# 1. 修改根 `package.json`

新增脚本：

```json id="x3q5cj"
"check:registry": "tsx scripts/checks/check-registry.ts"
```

并把 `site:check` 接入它。

## 修改后相关 scripts

```json id="79ar1o"
{
  "scripts": {
    "check:component-coverage": "tsx scripts/checks/check-component-coverage.ts",
    "check:showcase-metadata": "tsx scripts/checks/check-showcase-metadata.ts",
    "check:showcase-implementation": "tsx scripts/checks/check-showcase-implementation.ts",
    "check:product-layers": "tsx scripts/checks/check-product-layers.ts",
    "check:ui-package": "tsx scripts/checks/check-ui-package.ts",
    "check:registry": "tsx scripts/checks/check-registry.ts",
    "site:check": "pnpm check:component-coverage && pnpm check:showcase-metadata && pnpm check:showcase-implementation && pnpm check:product-layers && pnpm check:ui-package && pnpm check:registry && pnpm docs:check && pnpm docs:build && pnpm examples:check && pnpm showcase:test"
  }
}
```

---

# 2. 新增 `packages/registry/package.json`

```json id="7741kh"
{
  "name": "@zeus-web/registry",
  "type": "module",
  "version": "0.0.0",
  "description": "Source component registry templates for Zeus Web.",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/baicie/zeus-ui.git",
    "directory": "packages/registry"
  },
  "publishConfig": {
    "access": "public",
    "provenance": true
  },
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./schema": {
      "types": "./dist/schema.d.ts",
      "import": "./dist/schema.js"
    },
    "./registry.json": "./dist/registry.json",
    "./templates/react/button.tsx": "./dist/templates/react/button.tsx",
    "./templates/react/input.tsx": "./dist/templates/react/input.tsx",
    "./templates/vue/button.vue": "./dist/templates/vue/button.vue",
    "./templates/vue/input.vue": "./dist/templates/vue/input.vue",
    "./templates/css/globals.css": "./dist/templates/css/globals.css",
    "./templates/lib/cn.ts": "./dist/templates/lib/cn.ts"
  },
  "files": ["dist"],
  "scripts": {
    "dev": "tsup src/index.ts src/schema.ts --format esm --dts --clean --watch",
    "build": "tsup src/index.ts src/schema.ts --format esm --dts --clean && node scripts/copy-registry-assets.mjs",
    "check": "tsc -p tsconfig.json --noEmit",
    "test": "vitest --root ../.. --project unit packages/registry/__tests__/registry-package.spec.ts"
  },
  "devDependencies": {
    "tsup": "8.5.1",
    "typescript": "^6.0.3",
    "vitest": "^4.1.8"
  }
}
```

设计点：

```txt id="h1zw37"
不编译 templates：
  templates 是给 CLI 复制到用户项目的源码，不应该被当前 registry 包的 tsup 编译。

build 只编译：
  src/index.ts
  src/schema.ts

build 后复制：
  registry.json
  templates/**
```

---

# 3. 新增 `packages/registry/tsconfig.json`

```json id="zxit6e"
{
  "extends": "../../scripts/config/tsconfig.base.json",
  "compilerOptions": {
    "composite": false,
    "rootDir": ".",
    "outDir": "dist",
    "isolatedDeclarations": false
  },
  "include": ["src", "__tests__"]
}
```

---

# 4. 新增 `packages/registry/src/schema.ts`

```ts id="oj2o3s"
export type RegistryFramework = 'react' | 'vue' | 'native' | 'shared'

export type RegistryItemType = 'component' | 'utility' | 'style'

export interface RegistryFile {
  framework: RegistryFramework
  source: string
  target: string
}

export interface RegistryItem {
  name: string
  type: RegistryItemType
  description: string
  frameworks: RegistryFramework[]
  dependencies: string[]
  registryDependencies: string[]
  files: RegistryFile[]
}

export interface RegistryManifest {
  schemaVersion: 1
  name: string
  version: string
  items: RegistryItem[]
}

export function findRegistryItem(
  manifest: RegistryManifest,
  name: string,
): RegistryItem | undefined {
  return manifest.items.find(item => item.name === name)
}

export function getRegistryItemNames(manifest: RegistryManifest): string[] {
  return manifest.items.map(item => item.name)
}

export function getRegistryDependencies(
  manifest: RegistryManifest,
  item: RegistryItem,
): RegistryItem[] {
  return item.registryDependencies
    .map(name => findRegistryItem(manifest, name))
    .filter((dependency): dependency is RegistryItem => Boolean(dependency))
}

export function getRegistryFilesForFramework(
  item: RegistryItem,
  framework: RegistryFramework,
): RegistryFile[] {
  return item.files.filter(
    file => file.framework === framework || file.framework === 'shared',
  )
}
```

---

# 5. 新增 `packages/registry/src/index.ts`

```ts id="r2h8ke"
export type {
  RegistryFile,
  RegistryFramework,
  RegistryItem,
  RegistryItemType,
  RegistryManifest,
} from './schema'

export {
  findRegistryItem,
  getRegistryDependencies,
  getRegistryFilesForFramework,
  getRegistryItemNames,
} from './schema'
```

---

# 6. 新增 `packages/registry/registry.json`

```json id="875bgq"
{
  "schemaVersion": 1,
  "name": "@zeus-web/registry",
  "version": "0.0.0",
  "items": [
    {
      "name": "cn",
      "type": "utility",
      "description": "Class name composition utility used by generated Zeus Web components.",
      "frameworks": ["shared"],
      "dependencies": [],
      "registryDependencies": [],
      "files": [
        {
          "framework": "shared",
          "source": "templates/lib/cn.ts",
          "target": "lib/cn.ts"
        }
      ]
    },
    {
      "name": "globals",
      "type": "style",
      "description": "Global Zeus Web CSS variables for registry-installed styled components.",
      "frameworks": ["shared"],
      "dependencies": [],
      "registryDependencies": [],
      "files": [
        {
          "framework": "shared",
          "source": "templates/css/globals.css",
          "target": "styles/zeus.css"
        }
      ]
    },
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
    },
    {
      "name": "input",
      "type": "component",
      "description": "Styled input component built on top of @zeus-web/input primitives.",
      "frameworks": ["react", "vue"],
      "dependencies": ["@zeus-web/input"],
      "registryDependencies": ["cn", "globals"],
      "files": [
        {
          "framework": "react",
          "source": "templates/react/input.tsx",
          "target": "components/ui/input.tsx"
        },
        {
          "framework": "vue",
          "source": "templates/vue/input.vue",
          "target": "components/ui/input.vue"
        }
      ]
    }
  ]
}
```

---

# 7. 新增 `packages/registry/templates/lib/cn.ts`

不依赖 `clsx` / `tailwind-merge`，Phase 17 先保持零依赖。后续 CLI 可以允许用户选择是否替换为 `clsx + tailwind-merge`。

```ts id="gpzdl5"
export type ClassDictionary = Record<string, boolean | null | undefined>
export type ClassArray = ClassValue[]
export type ClassValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | ClassDictionary
  | ClassArray

function collectClassNames(value: ClassValue, result: string[]): void {
  if (!value) return

  if (typeof value === 'string' || typeof value === 'number') {
    result.push(String(value))
    return
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectClassNames(item, result)
    }
    return
  }

  if (typeof value === 'object') {
    for (const [key, enabled] of Object.entries(value)) {
      if (enabled) result.push(key)
    }
  }
}

export function cn(...inputs: ClassValue[]): string {
  const result: string[] = []

  for (const input of inputs) {
    collectClassNames(input, result)
  }

  return result.join(' ')
}
```

---

# 8. 新增 `packages/registry/templates/css/globals.css`

这个文件是 CLI 未来复制到用户项目的全局 CSS，不是 `@zeus-web/ui` 的 CSS。

```css id="9p8v9k"
:root {
  --zeus-background: 0 0% 100%;
  --zeus-foreground: 240 10% 3.9%;

  --zeus-primary: 240 5.9% 10%;
  --zeus-primary-foreground: 0 0% 98%;

  --zeus-secondary: 240 4.8% 95.9%;
  --zeus-secondary-foreground: 240 5.9% 10%;

  --zeus-muted: 240 4.8% 95.9%;
  --zeus-muted-foreground: 240 3.8% 46.1%;

  --zeus-accent: 240 4.8% 95.9%;
  --zeus-accent-foreground: 240 5.9% 10%;

  --zeus-destructive: 0 84.2% 60.2%;
  --zeus-destructive-foreground: 0 0% 98%;

  --zeus-border: 240 5.9% 90%;
  --zeus-input: 240 5.9% 90%;
  --zeus-ring: 240 5.9% 10%;

  --zeus-radius-sm: 0.25rem;
  --zeus-radius-md: 0.375rem;
  --zeus-radius-lg: 0.5rem;
}

.dark {
  --zeus-background: 240 10% 3.9%;
  --zeus-foreground: 0 0% 98%;

  --zeus-primary: 0 0% 98%;
  --zeus-primary-foreground: 240 5.9% 10%;

  --zeus-secondary: 240 3.7% 15.9%;
  --zeus-secondary-foreground: 0 0% 98%;

  --zeus-muted: 240 3.7% 15.9%;
  --zeus-muted-foreground: 240 5% 64.9%;

  --zeus-accent: 240 3.7% 15.9%;
  --zeus-accent-foreground: 0 0% 98%;

  --zeus-destructive: 0 62.8% 30.6%;
  --zeus-destructive-foreground: 0 0% 98%;

  --zeus-border: 240 3.7% 15.9%;
  --zeus-input: 240 3.7% 15.9%;
  --zeus-ring: 240 4.9% 83.9%;
}
```

说明：

```txt id="k21a68"
registry 模板用 --zeus-*。
native @zeus-web/ui 用 --zw-*。

二者不是 bug：
  - --zw-* 是包内 native styled Web-C token 门面
  - --zeus-* 是 CLI 安装到用户项目的 CSS token 门面

Phase 18/19 可以在 init 时生成 Tailwind theme 映射到 --zeus-*。
```

---

# 9. 新增 `packages/registry/templates/react/button.tsx`

```tsx id="k2nvo7"
import type { ComponentProps } from 'react'
import { Button as ButtonPrimitive } from '@zeus-web/button/react'

import { cn } from '@/lib/cn'

export type ButtonVariant =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'

export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

export interface ButtonProps extends ComponentProps<typeof ButtonPrimitive> {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
}

const buttonVariantClasses: Record<ButtonVariant, string> = {
  default:
    'border border-[hsl(var(--zeus-border))] bg-[hsl(var(--zeus-background))] text-[hsl(var(--zeus-foreground))] hover:bg-[hsl(var(--zeus-accent))] hover:text-[hsl(var(--zeus-accent-foreground))]',
  primary:
    'border border-[hsl(var(--zeus-primary))] bg-[hsl(var(--zeus-primary))] text-[hsl(var(--zeus-primary-foreground))] hover:bg-[hsl(var(--zeus-primary)/0.9)]',
  secondary:
    'border border-transparent bg-[hsl(var(--zeus-secondary))] text-[hsl(var(--zeus-secondary-foreground))] hover:bg-[hsl(var(--zeus-secondary)/0.8)]',
  outline:
    'border border-[hsl(var(--zeus-border))] bg-transparent text-[hsl(var(--zeus-foreground))] hover:bg-[hsl(var(--zeus-accent))] hover:text-[hsl(var(--zeus-accent-foreground))]',
  ghost:
    'border border-transparent bg-transparent text-[hsl(var(--zeus-foreground))] hover:bg-[hsl(var(--zeus-accent))] hover:text-[hsl(var(--zeus-accent-foreground))]',
  danger:
    'border border-[hsl(var(--zeus-destructive))] bg-[hsl(var(--zeus-destructive))] text-[hsl(var(--zeus-destructive-foreground))] hover:bg-[hsl(var(--zeus-destructive)/0.9)]',
}

const buttonSizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-4 text-sm',
  lg: 'h-10 px-6 text-sm',
  icon: 'h-9 w-9 p-0',
}

export function Button({
  className,
  variant = 'default',
  size = 'md',
  ...props
}: ButtonProps) {
  return (
    <ButtonPrimitive
      variant={variant}
      size={size}
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--zeus-radius-md)] font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--zeus-ring)/0.45)] focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        buttonVariantClasses[variant],
        buttonSizeClasses[size],
        className,
      )}
      {...props}
    />
  )
}
```

---

# 10. 新增 `packages/registry/templates/react/input.tsx`

```tsx id="49bi20"
import type { ComponentProps } from 'react'
import { Input as InputPrimitive } from '@zeus-web/input/react'

import { cn } from '@/lib/cn'

export type InputSize = 'sm' | 'md' | 'lg'

export interface InputProps extends ComponentProps<typeof InputPrimitive> {
  size?: InputSize
  className?: string
}

const inputSizeClasses: Record<InputSize, string> = {
  sm: 'h-8 px-2.5 text-xs',
  md: 'h-9 px-3 text-sm',
  lg: 'h-10 px-3.5 text-sm',
}

export function Input({ className, size = 'md', ...props }: InputProps) {
  return (
    <InputPrimitive
      size={size}
      className={cn(
        'flex w-full min-w-0 rounded-[var(--zeus-radius-md)] border border-[hsl(var(--zeus-input))] bg-[hsl(var(--zeus-background))] text-[hsl(var(--zeus-foreground))]',
        'placeholder:text-[hsl(var(--zeus-muted-foreground))]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--zeus-ring)/0.35)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-[hsl(var(--zeus-destructive))] aria-invalid:ring-[hsl(var(--zeus-destructive)/0.35)]',
        inputSizeClasses[size],
        className,
      )}
      {...props}
    />
  )
}
```

---

# 11. 新增 `packages/registry/templates/vue/button.vue`

```vue id="o41z00"
<script setup lang="ts">
import { computed } from 'vue'
import { Button as ButtonPrimitive } from '@zeus-web/button/vue'

import { cn } from '@/lib/cn'

type ButtonVariant =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'

type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

const props = withDefaults(
  defineProps<{
    variant?: ButtonVariant
    size?: ButtonSize
    class?: string
    disabled?: boolean
  }>(),
  {
    variant: 'default',
    size: 'md',
    class: '',
    disabled: false,
  },
)

const buttonVariantClasses: Record<ButtonVariant, string> = {
  default:
    'border border-[hsl(var(--zeus-border))] bg-[hsl(var(--zeus-background))] text-[hsl(var(--zeus-foreground))] hover:bg-[hsl(var(--zeus-accent))] hover:text-[hsl(var(--zeus-accent-foreground))]',
  primary:
    'border border-[hsl(var(--zeus-primary))] bg-[hsl(var(--zeus-primary))] text-[hsl(var(--zeus-primary-foreground))] hover:bg-[hsl(var(--zeus-primary)/0.9)]',
  secondary:
    'border border-transparent bg-[hsl(var(--zeus-secondary))] text-[hsl(var(--zeus-secondary-foreground))] hover:bg-[hsl(var(--zeus-secondary)/0.8)]',
  outline:
    'border border-[hsl(var(--zeus-border))] bg-transparent text-[hsl(var(--zeus-foreground))] hover:bg-[hsl(var(--zeus-accent))] hover:text-[hsl(var(--zeus-accent-foreground))]',
  ghost:
    'border border-transparent bg-transparent text-[hsl(var(--zeus-foreground))] hover:bg-[hsl(var(--zeus-accent))] hover:text-[hsl(var(--zeus-accent-foreground))]',
  danger:
    'border border-[hsl(var(--zeus-destructive))] bg-[hsl(var(--zeus-destructive))] text-[hsl(var(--zeus-destructive-foreground))] hover:bg-[hsl(var(--zeus-destructive)/0.9)]',
}

const buttonSizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-4 text-sm',
  lg: 'h-10 px-6 text-sm',
  icon: 'h-9 w-9 p-0',
}

const classes = computed(() =>
  cn(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--zeus-radius-md)] font-medium transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--zeus-ring)/0.45)] focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
    buttonVariantClasses[props.variant],
    buttonSizeClasses[props.size],
    props.class,
  ),
)
</script>

<template>
  <ButtonPrimitive
    :variant="variant"
    :size="size"
    :disabled="disabled"
    :class="classes"
  >
    <slot />
  </ButtonPrimitive>
</template>
```

---

# 12. 新增 `packages/registry/templates/vue/input.vue`

```vue id="v2afzi"
<script setup lang="ts">
import { computed } from 'vue'
import { Input as InputPrimitive } from '@zeus-web/input/vue'

import { cn } from '@/lib/cn'

type InputSize = 'sm' | 'md' | 'lg'

const props = withDefaults(
  defineProps<{
    size?: InputSize
    class?: string
    disabled?: boolean
    invalid?: boolean
    placeholder?: string
    modelValue?: string
  }>(),
  {
    size: 'md',
    class: '',
    disabled: false,
    invalid: false,
    placeholder: '',
    modelValue: '',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const inputSizeClasses: Record<InputSize, string> = {
  sm: 'h-8 px-2.5 text-xs',
  md: 'h-9 px-3 text-sm',
  lg: 'h-10 px-3.5 text-sm',
}

const classes = computed(() =>
  cn(
    'flex w-full min-w-0 rounded-[var(--zeus-radius-md)] border border-[hsl(var(--zeus-input))] bg-[hsl(var(--zeus-background))] text-[hsl(var(--zeus-foreground))]',
    'placeholder:text-[hsl(var(--zeus-muted-foreground))]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--zeus-ring)/0.35)]',
    'disabled:cursor-not-allowed disabled:opacity-50',
    props.invalid &&
      'border-[hsl(var(--zeus-destructive))] ring-2 ring-[hsl(var(--zeus-destructive)/0.35)]',
    inputSizeClasses[props.size],
    props.class,
  ),
)

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement | null
  emit('update:modelValue', target?.value ?? '')
}
</script>

<template>
  <InputPrimitive
    :size="size"
    :disabled="disabled"
    :invalid="invalid"
    :placeholder="placeholder"
    :value="modelValue"
    :class="classes"
    @input="handleInput"
  />
</template>
```

---

# 13. 新增 `packages/registry/scripts/copy-registry-assets.mjs`

```js id="uxw4me"
import { cp, copyFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(root, '..')
const distDir = resolve(packageRoot, 'dist')

await mkdir(distDir, {
  recursive: true,
})

await copyFile(
  resolve(packageRoot, 'registry.json'),
  resolve(distDir, 'registry.json'),
)

await cp(resolve(packageRoot, 'templates'), resolve(distDir, 'templates'), {
  recursive: true,
})
```

---

# 14. 新增 `packages/registry/__tests__/registry-package.spec.ts`

```ts id="6wn838"
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  findRegistryItem,
  getRegistryDependencies,
  getRegistryFilesForFramework,
  getRegistryItemNames,
  type RegistryManifest,
} from '../src'

const packageRoot = resolve(process.cwd(), 'packages/registry')

function read(relativePath: string): string {
  return readFileSync(resolve(packageRoot, relativePath), 'utf-8')
}

function readManifest(): RegistryManifest {
  return JSON.parse(read('registry.json')) as RegistryManifest
}

describe('@zeus-web/registry package contract', () => {
  it('declares package exports', () => {
    const packageJson = JSON.parse(read('package.json')) as {
      name: string
      exports: Record<string, unknown>
    }

    expect(packageJson.name).toBe('@zeus-web/registry')
    expect(packageJson.exports).toHaveProperty('.')
    expect(packageJson.exports).toHaveProperty('./schema')
    expect(packageJson.exports).toHaveProperty('./registry.json')
    expect(packageJson.exports).toHaveProperty('./templates/react/button.tsx')
    expect(packageJson.exports).toHaveProperty('./templates/react/input.tsx')
    expect(packageJson.exports).toHaveProperty('./templates/vue/button.vue')
    expect(packageJson.exports).toHaveProperty('./templates/vue/input.vue')
    expect(packageJson.exports).toHaveProperty('./templates/css/globals.css')
    expect(packageJson.exports).toHaveProperty('./templates/lib/cn.ts')
  })

  it('contains required registry items', () => {
    const manifest = readManifest()
    const names = getRegistryItemNames(manifest)

    expect(manifest.schemaVersion).toBe(1)
    expect(names).toEqual(['cn', 'globals', 'button', 'input'])
  })

  it('resolves item dependencies', () => {
    const manifest = readManifest()
    const button = findRegistryItem(manifest, 'button')
    const input = findRegistryItem(manifest, 'input')

    expect(button).toBeTruthy()
    expect(input).toBeTruthy()

    expect(button?.dependencies).toEqual(['@zeus-web/button'])
    expect(input?.dependencies).toEqual(['@zeus-web/input'])

    expect(
      getRegistryDependencies(manifest, button!).map(item => item.name),
    ).toEqual(['cn', 'globals'])

    expect(
      getRegistryDependencies(manifest, input!).map(item => item.name),
    ).toEqual(['cn', 'globals'])
  })

  it('resolves files by framework', () => {
    const manifest = readManifest()
    const button = findRegistryItem(manifest, 'button')!

    expect(getRegistryFilesForFramework(button, 'react')).toEqual([
      {
        framework: 'react',
        source: 'templates/react/button.tsx',
        target: 'components/ui/button.tsx',
      },
    ])

    expect(getRegistryFilesForFramework(button, 'vue')).toEqual([
      {
        framework: 'vue',
        source: 'templates/vue/button.vue',
        target: 'components/ui/button.vue',
      },
    ])
  })

  it('ships every source template referenced by registry.json', () => {
    const manifest = readManifest()

    for (const item of manifest.items) {
      for (const file of item.files) {
        expect(
          existsSync(resolve(packageRoot, file.source)),
          `${item.name} missing template ${file.source}`,
        ).toBe(true)
      }
    }
  })

  it('templates use primitives and local utility imports', () => {
    expect(read('templates/react/button.tsx')).toContain(
      "import { Button as ButtonPrimitive } from '@zeus-web/button/react'",
    )
    expect(read('templates/react/input.tsx')).toContain(
      "import { Input as InputPrimitive } from '@zeus-web/input/react'",
    )
    expect(read('templates/vue/button.vue')).toContain(
      "import { Button as ButtonPrimitive } from '@zeus-web/button/vue'",
    )
    expect(read('templates/vue/input.vue')).toContain(
      "import { Input as InputPrimitive } from '@zeus-web/input/vue'",
    )

    expect(read('templates/react/button.tsx')).toContain(
      "import { cn } from '@/lib/cn'",
    )
    expect(read('templates/vue/button.vue')).toContain(
      "import { cn } from '@/lib/cn'",
    )
  })
})
```

---

# 15. 新增 `scripts/checks/check-registry.ts`

```ts id="be9vkx"
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import pc from 'picocolors'

type RegistryFramework = 'react' | 'vue' | 'native' | 'shared'
type RegistryItemType = 'component' | 'utility' | 'style'

interface RegistryFile {
  framework: RegistryFramework
  source: string
  target: string
}

interface RegistryItem {
  name: string
  type: RegistryItemType
  description: string
  frameworks: RegistryFramework[]
  dependencies: string[]
  registryDependencies: string[]
  files: RegistryFile[]
}

interface RegistryManifest {
  schemaVersion: 1
  name: string
  version: string
  items: RegistryItem[]
}

const root = process.cwd()
const packageRoot = resolve(root, 'packages/registry')

const requiredFiles = [
  'package.json',
  'tsconfig.json',
  'src/index.ts',
  'src/schema.ts',
  'registry.json',
  'templates/react/button.tsx',
  'templates/react/input.tsx',
  'templates/vue/button.vue',
  'templates/vue/input.vue',
  'templates/css/globals.css',
  'templates/lib/cn.ts',
  'scripts/copy-registry-assets.mjs',
  '__tests__/registry-package.spec.ts',
]

const requiredItemNames = ['cn', 'globals', 'button', 'input']

const allowedFrameworks = new Set<RegistryFramework>([
  'react',
  'vue',
  'native',
  'shared',
])

const allowedTypes = new Set<RegistryItemType>([
  'component',
  'utility',
  'style',
])

function read(relativePath: string): string {
  return readFileSync(resolve(packageRoot, relativePath), 'utf-8')
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(read(relativePath)) as T
}

function assertFileExists(relativePath: string, errors: string[]): void {
  if (!existsSync(resolve(packageRoot, relativePath))) {
    errors.push(`Missing packages/registry/${relativePath}`)
  }
}

function checkPackageJson(errors: string[]): void {
  const packageJson = readJson<{
    name?: string
    description?: string
    exports?: Record<string, unknown>
    scripts?: Record<string, string>
    sideEffects?: boolean
  }>('package.json')

  if (packageJson.name !== '@zeus-web/registry') {
    errors.push(
      'packages/registry/package.json name must be @zeus-web/registry',
    )
  }

  if (
    packageJson.description !==
    'Source component registry templates for Zeus Web.'
  ) {
    errors.push('packages/registry/package.json description is incorrect')
  }

  if (packageJson.sideEffects !== false) {
    errors.push('packages/registry/package.json sideEffects must be false')
  }

  const requiredExports = [
    '.',
    './schema',
    './registry.json',
    './templates/react/button.tsx',
    './templates/react/input.tsx',
    './templates/vue/button.vue',
    './templates/vue/input.vue',
    './templates/css/globals.css',
    './templates/lib/cn.ts',
  ]

  for (const exportName of requiredExports) {
    if (!packageJson.exports?.[exportName]) {
      errors.push(`packages/registry/package.json missing export ${exportName}`)
    }
  }

  for (const script of ['build', 'check', 'test']) {
    if (!packageJson.scripts?.[script]) {
      errors.push(`packages/registry/package.json missing script ${script}`)
    }
  }
}

function checkManifestShape(
  manifest: RegistryManifest,
  errors: string[],
): void {
  if (manifest.schemaVersion !== 1) {
    errors.push('registry.json schemaVersion must be 1')
  }

  if (manifest.name !== '@zeus-web/registry') {
    errors.push('registry.json name must be @zeus-web/registry')
  }

  if (!Array.isArray(manifest.items) || manifest.items.length === 0) {
    errors.push('registry.json must contain items')
    return
  }

  const names = new Set<string>()

  for (const item of manifest.items) {
    if (!item.name) {
      errors.push('registry item missing name')
      continue
    }

    if (names.has(item.name)) {
      errors.push(`duplicate registry item name: ${item.name}`)
    }

    names.add(item.name)

    if (!allowedTypes.has(item.type)) {
      errors.push(`${item.name}: invalid item type ${item.type}`)
    }

    if (!item.description) {
      errors.push(`${item.name}: description is required`)
    }

    if (!Array.isArray(item.frameworks) || item.frameworks.length === 0) {
      errors.push(`${item.name}: frameworks must be non-empty`)
    } else {
      for (const framework of item.frameworks) {
        if (!allowedFrameworks.has(framework)) {
          errors.push(`${item.name}: invalid framework ${framework}`)
        }
      }
    }

    if (!Array.isArray(item.dependencies)) {
      errors.push(`${item.name}: dependencies must be an array`)
    }

    if (!Array.isArray(item.registryDependencies)) {
      errors.push(`${item.name}: registryDependencies must be an array`)
    }

    if (!Array.isArray(item.files) || item.files.length === 0) {
      errors.push(`${item.name}: files must be non-empty`)
    }

    for (const file of item.files) {
      if (!allowedFrameworks.has(file.framework)) {
        errors.push(`${item.name}: invalid file framework ${file.framework}`)
      }

      if (!file.source.startsWith('templates/')) {
        errors.push(`${item.name}: file source must start with templates/`)
      }

      if (file.target.startsWith('/') || file.target.includes('..')) {
        errors.push(`${item.name}: unsafe file target ${file.target}`)
      }

      if (!existsSync(resolve(packageRoot, file.source))) {
        errors.push(`${item.name}: missing template ${file.source}`)
      }
    }
  }

  for (const requiredName of requiredItemNames) {
    if (!names.has(requiredName)) {
      errors.push(`registry.json missing required item ${requiredName}`)
    }
  }

  for (const item of manifest.items) {
    for (const dependency of item.registryDependencies) {
      if (!names.has(dependency)) {
        errors.push(`${item.name}: missing registry dependency ${dependency}`)
      }
    }
  }
}

function findItem(
  manifest: RegistryManifest,
  name: string,
): RegistryItem | undefined {
  return manifest.items.find(item => item.name === name)
}

function checkComponentItems(
  manifest: RegistryManifest,
  errors: string[],
): void {
  const button = findItem(manifest, 'button')
  const input = findItem(manifest, 'input')

  if (!button) {
    errors.push('registry missing button item')
  } else {
    if (!button.dependencies.includes('@zeus-web/button')) {
      errors.push('button item must depend on @zeus-web/button')
    }

    if (!button.registryDependencies.includes('cn')) {
      errors.push('button item must depend on registry item cn')
    }

    if (!button.registryDependencies.includes('globals')) {
      errors.push('button item must depend on registry item globals')
    }
  }

  if (!input) {
    errors.push('registry missing input item')
  } else {
    if (!input.dependencies.includes('@zeus-web/input')) {
      errors.push('input item must depend on @zeus-web/input')
    }

    if (!input.registryDependencies.includes('cn')) {
      errors.push('input item must depend on registry item cn')
    }

    if (!input.registryDependencies.includes('globals')) {
      errors.push('input item must depend on registry item globals')
    }
  }
}

function checkTemplateContents(errors: string[]): void {
  const reactButton = read('templates/react/button.tsx')
  const reactInput = read('templates/react/input.tsx')
  const vueButton = read('templates/vue/button.vue')
  const vueInput = read('templates/vue/input.vue')
  const cn = read('templates/lib/cn.ts')
  const globals = read('templates/css/globals.css')

  const requiredTemplateContents = [
    {
      file: 'templates/react/button.tsx',
      source: reactButton,
      contains: [
        "import { Button as ButtonPrimitive } from '@zeus-web/button/react'",
        "import { cn } from '@/lib/cn'",
        'export function Button',
        '--zeus-primary',
      ],
    },
    {
      file: 'templates/react/input.tsx',
      source: reactInput,
      contains: [
        "import { Input as InputPrimitive } from '@zeus-web/input/react'",
        "import { cn } from '@/lib/cn'",
        'export function Input',
        '--zeus-input',
      ],
    },
    {
      file: 'templates/vue/button.vue',
      source: vueButton,
      contains: [
        "import { Button as ButtonPrimitive } from '@zeus-web/button/vue'",
        "import { cn } from '@/lib/cn'",
        '<ButtonPrimitive',
        '--zeus-primary',
      ],
    },
    {
      file: 'templates/vue/input.vue',
      source: vueInput,
      contains: [
        "import { Input as InputPrimitive } from '@zeus-web/input/vue'",
        "import { cn } from '@/lib/cn'",
        '<InputPrimitive',
        '--zeus-input',
      ],
    },
    {
      file: 'templates/lib/cn.ts',
      source: cn,
      contains: ['export function cn', 'ClassValue'],
    },
    {
      file: 'templates/css/globals.css',
      source: globals,
      contains: [
        ':root',
        '.dark',
        '--zeus-primary',
        '--zeus-destructive',
        '--zeus-radius-md',
      ],
    },
  ]

  for (const item of requiredTemplateContents) {
    for (const text of item.contains) {
      if (!item.source.includes(text)) {
        errors.push(`${item.file} must contain ${text}`)
      }
    }
  }
}

function main(): void {
  const errors: string[] = []

  if (!existsSync(packageRoot)) {
    errors.push('Missing packages/registry package')
  } else {
    for (const file of requiredFiles) {
      assertFileExists(file, errors)
    }

    if (errors.length === 0) {
      checkPackageJson(errors)

      const manifest = readJson<RegistryManifest>('registry.json')
      checkManifestShape(manifest, errors)
      checkComponentItems(manifest, errors)
      checkTemplateContents(errors)
    }
  }

  if (errors.length > 0) {
    console.error(pc.red('@zeus-web/registry check failed:'))
    for (const error of errors) {
      console.error(`- ${error}`)
    }
    process.exit(1)
  }

  console.log(pc.green('@zeus-web/registry check passed.'))
}

main()
```

---

# 16. 更新 Phase 15 检查脚本

如果 `scripts/checks/check-product-layers.ts` 里 roadmap 检查还停在 Phase 17 next work，需要同步更新到 Phase 18。

把 roadmap 相关 `mustContain` 改成：

```ts id="xlkifw"
{
  path: 'docs/internal/examples/showcase-roadmap.md',
  mustContain: [
    '| Phase 15 | Done   | Product layering contract for primitives, themes, native styled Web-C, registry, CLI and showcase usage          |',
    '| Phase 16 | Done   | Native styled Web-C package with styled button and input entrypoints                                             |',
    '| Phase 17 | Done   | Registry foundation with React and Vue button/input templates                                                    |',
    'The showcase has ten layers of checks:',
    'Product layer checks validate Zeus-UI package boundaries and usage entry decisions.',
    'Native styled Web-C checks validate @zeus-web/ui package exports, CSS entrypoints and primitive composition.',
    'Registry checks validate @zeus-web/registry schema, metadata, templates and primitive dependencies.',
    'pnpm check:product-layers',
    'pnpm check:ui-package',
    'pnpm check:registry',
    'Phase 18: Add CLI init command and project configuration.',
  ],
}
```

并把 `checkPhaseOrder()` 替换成：

```ts id="d7p34y"
function checkPhaseOrder(source: string): string[] {
  const errors: string[] = []
  const phase15Index = source.indexOf('| Phase 15 |')
  const phase16Index = source.indexOf('| Phase 16 |')
  const phase17Index = source.indexOf('| Phase 17 |')
  const phase18Index = source.indexOf('Phase 18:')

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
    errors.push('showcase-roadmap.md must contain Phase 18 next work')
  }

  if (phase15Index >= 0 && phase16Index >= 0 && phase16Index < phase15Index) {
    errors.push('Phase 16 status must appear after Phase 15 status')
  }

  if (phase16Index >= 0 && phase17Index >= 0 && phase17Index < phase16Index) {
    errors.push('Phase 17 status must appear after Phase 16 status')
  }

  if (phase17Index >= 0 && phase18Index >= 0 && phase18Index < phase17Index) {
    errors.push('Phase 18 next work must appear after Phase 17 status')
  }

  return errors
}
```

---

# 17. 新增设计文档 `docs/internal/design/zeus-ui-registry-foundation.md`

````md id="g2ljzi"
# Zeus-UI Registry Foundation

## Status

Phase 17 design.

This document defines the local source component registry used by future CLI commands.

## Package

```txt
@zeus-web/registry
```
````

## Goal

The registry stores framework-specific source templates and metadata.

It enables future commands:

```bash
zeus-web add button
zeus-web add input
```

Phase 17 only creates the registry package. It does not implement CLI commands.

## Registry responsibilities

The registry owns:

- item metadata
- dependency metadata
- React source templates
- Vue source templates
- global CSS template
- utility templates

The registry does not own:

- primitive behavior
- native styled Web-C runtime entrypoints
- CLI project detection
- file writing
- dependency installation

## Registry items

Phase 17 includes:

```txt
cn
globals
button
input
```

## Component dependency model

The `button` registry item depends on:

```txt
@zeus-web/button
registry item cn
registry item globals
```

The `input` registry item depends on:

```txt
@zeus-web/input
registry item cn
registry item globals
```

## Template ownership

Registry templates are source files that will be copied into user projects.

Once copied, the user owns them.

That is different from `@zeus-web/ui`, where styles remain package-owned.

## Token model

Registry templates use `--zeus-*` CSS variables.

Native styled Web-C uses `--zw-*` CSS variables.

This separation is intentional:

- `--zw-*` is the native package token facade.
- `--zeus-*` is the application source template token facade.

Future CLI `init` should generate or install `styles/zeus.css`.

## Target paths

Default future targets:

```txt
components/ui/button.tsx
components/ui/input.tsx
components/ui/button.vue
components/ui/input.vue
lib/cn.ts
styles/zeus.css
```

The CLI will apply project aliases later.

## Build model

`@zeus-web/registry` compiles only its schema helpers.

Templates are copied as assets.

This avoids compiling framework templates with user-project aliases such as:

```txt
@/lib/cn
```

## Phase 17 non-goals

Phase 17 does not implement:

- `zeus-web init`
- `zeus-web add`
- overwrite handling
- dry-run
- registry sync into showcase
- remote registry service

## Next phase

Phase 18 should implement CLI `init`.

Phase 19 should implement CLI `add`.

````

---

# 18. 更新 roadmap

## `docs/internal/examples/showcase-roadmap.md`

### Status 表追加

```md id="ujv9q1"
| Phase 17 | Done   | Registry foundation with React and Vue button/input templates                                                    |
````

### Engineering guarantees 改成 10 层

```md id="m9dbqn"
The showcase has ten layers of checks:

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
```

### Commands 增加

```bash id="zczwr7"
pnpm check:registry
pnpm --filter @zeus-web/registry build
pnpm --filter @zeus-web/registry check
pnpm --filter @zeus-web/registry test
```

完整 Commands：

````md id="iuotua"
## Commands

```bash
pnpm check:product-layers
pnpm check:ui-package
pnpm check:registry
pnpm check:showcase-metadata
pnpm check:showcase-implementation
pnpm --filter @zeus-web/ui build
pnpm --filter @zeus-web/ui check
pnpm --filter @zeus-web/ui test
pnpm --filter @zeus-web/registry build
pnpm --filter @zeus-web/registry check
pnpm --filter @zeus-web/registry test
pnpm showcase:test
pnpm showcase:build
pnpm showcase:e2e
pnpm showcase:e2e:ui
pnpm showcase:e2e:headed
pnpm showcase:ci
pnpm site:check
pnpm site:build
```
````

````id="8qiowp"

### Next work 改成

```md id="h4syuj"
## Next work

Future phases should continue with CLI usage:

- Phase 18: Add CLI init command and project configuration.
- Phase 19: Add CLI add command for registry component installation.
- Phase 20: Switch React and Vue showcase to registry-installed styled usage.
- Phase 21: Add native showcase for @zeus-web/ui.
- Phase 22: Rewrite public docs around CLI, native styled Web-C and advanced primitive usage.
````

---

# 19. Phase 17 文件清单

```txt id="24co7e"
package.json
scripts/checks/check-registry.ts
scripts/checks/check-product-layers.ts

packages/registry/package.json
packages/registry/tsconfig.json
packages/registry/src/index.ts
packages/registry/src/schema.ts
packages/registry/registry.json
packages/registry/templates/lib/cn.ts
packages/registry/templates/css/globals.css
packages/registry/templates/react/button.tsx
packages/registry/templates/react/input.tsx
packages/registry/templates/vue/button.vue
packages/registry/templates/vue/input.vue
packages/registry/scripts/copy-registry-assets.mjs
packages/registry/__tests__/registry-package.spec.ts

docs/internal/design/zeus-ui-registry-foundation.md
docs/internal/examples/showcase-roadmap.md
```

---

# 20. 验收命令

```bash id="pgtx5o"
pnpm check:registry
pnpm --filter @zeus-web/registry check
pnpm --filter @zeus-web/registry build
pnpm --filter @zeus-web/registry test
```

全量：

```bash id="z0dox5"
pnpm check
pnpm build
pnpm site:check
pnpm showcase:ci
pnpm release:verify --allow-zero
```

---

# 21. Phase 17 完成判断

```txt id="3xje3g"
完成：
  - packages/registry 存在
  - registry.json 定义 cn / globals / button / input
  - button/input 有 React 模板
  - button/input 有 Vue 模板
  - cn utility 模板存在
  - globals.css 模板存在
  - schema helpers 可被 CLI 未来复用
  - build 会复制 registry.json 和 templates
  - check-registry 可阻止 registry 漂移
  - site:check 已接入 check:registry
  - roadmap Phase 17 Done

未做：
  - 没有 CLI init
  - 没有 CLI add
  - 没有 showcase 切 registry
  - 没有远程 registry 服务
```

---

# 22. 建议分支与 PR

分支名：

```txt id="tc4vb9"
feat/registry-foundation
```

PR title：

```txt id="spzc6q"
feat(registry): add source component registry foundation
```
