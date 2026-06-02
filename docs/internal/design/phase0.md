下面按 `baicie/zeus-ui` 当前代码来给 **Phase 0：Foundation / Monorepo 初始化** 的详细设计与代码草案。

我先说结论：**当前仓库已经有初步初始化，但更像一个通用模板，还没有切到 `@zeus-web` 多包组件库架构。Phase 0 的核心任务不是写组件，而是把 monorepo、包命名、构建、检查、发布、目录边界全部定住。**

当前根 `package.json` 已经是私有 ESM 项目，使用 `pnpm@11.3.0`，Node 要求 `>=18.12.0`，并且已有 `check / lint / format / test / docs / release` 等基础脚本。 但 `build` 和 `dev` 目前只是 `echo` 占位，还没有真实构建逻辑。 当前 workspace 只包含 `packages/*`，还没覆盖 `packages/primitives/*`、`apps/*`、`examples/*` 这些后续需要的目录。 另外当前 TS path 还是 `@baicie/*`，后续要改成 `@zeus-web/*`。

# Phase 0 目标

```txt
Phase 0：建立 zeus-ui / zeus-web 的工程地基

目标不是实现组件，而是完成：
1. monorepo 目录结构
2. @zeus-web npm scope 规范
3. 单组件 primitive 包结构
4. 聚合包结构
5. CLI 包结构
6. themes / registry / docs / examples 基础目录
7. build / check / lint / test / release 基础命令
8. package exports 检查
9. npm 发布边界
```

Phase 0 完成后，仓库应该支持这些命令：

```bash
pnpm install
pnpm build
pnpm check
pnpm lint
pnpm test
pnpm format-check
pnpm check:exports
pnpm release:dry
```

并且能看到这些包的空壳或最小可构建版本：

```txt
@zeus-web/utils
@zeus-web/input
@zeus-web/headless
@zeus-web/react
@zeus-web/vue
@zeus-web/themes
@zeus-web/registry
@zeus-web/cli
```

# Phase 0 最终目录设计

建议把当前 `packages/*` 改成更适合单组件 primitive 的结构：

```txt
zeus-ui/
  package.json
  pnpm-workspace.yaml
  tsconfig.json
  eslint.config.ts
  vitest.config.ts
  .gitignore
  README.md

  scripts/
    build.ts
    check-package-exports.ts
    release.ts
    publish.ts
    tsconfig.base.json
    tsconfig.build.json

  packages/
    primitives/
      input/
        src/
          index.ts
          wc.ts
          react.ts
          vue.ts
        package.json
        tsconfig.json

    utils/
      src/
        index.ts
      package.json
      tsconfig.json

    headless/
      src/
        index.ts
      package.json
      tsconfig.json

    react/
      src/
        index.ts
      package.json
      tsconfig.json

    vue/
      src/
        index.ts
      package.json
      tsconfig.json

    themes/
      src/
        index.ts
        tokens.css
        default.css
      package.json
      tsconfig.json

    registry/
      registry.json
      src/
        index.ts
      package.json
      tsconfig.json

    cli/
      src/
        index.ts
        commands/
          init.ts
          add.ts
      package.json
      tsconfig.json

  apps/
    docs/
      package.json
      index.md

  examples/
    vanilla/
    vite-react/
    vite-vue/
```

这里重点是：**`packages/primitives/input` 未来发布为 `@zeus-web/input`，不是放在 `@zeus-web/headless` 里面。**

# 当前代码需要调整的地方

## 1. `pnpm-workspace.yaml`

当前只有：

```yaml
packages:
  - packages/*
```

这不够，因为单组件包会放在 `packages/primitives/*`。建议改成：

```yaml
shellEmulator: true

packages:
  - 'packages/*'
  - 'packages/primitives/*'
  - 'apps/*'
  - 'examples/*'

allowBuilds:
  esbuild: true
  simple-git-hooks: true
```

# 2. 根 `package.json` 草案

当前根 `package.json` 的基础依赖可以保留，但 `build/dev/release` 要改成真实脚本。当前 release 脚本还是按根目录单包发布，`getPkgDir: () => '.'`，不适合后续多包 monorepo。 publish 也同样是根目录单包模式。

建议改成：

```json
{
  "name": "zeus-ui-workspace",
  "type": "module",
  "private": true,
  "packageManager": "pnpm@11.3.0",
  "engines": {
    "node": ">=18.12.0"
  },
  "scripts": {
    "dev": "pnpm -r --parallel --filter './packages/**' dev",
    "build": "tsx scripts/build.ts",
    "build:packages": "pnpm -r --filter './packages/**' build",
    "clean": "rimraf --glob 'packages/**/dist' --glob 'apps/**/.vitepress/dist' --glob 'examples/**/dist' temp node_modules/.cache",
    "check": "tsc -p tsconfig.json --incremental --noEmit",
    "check:exports": "tsx scripts/check-package-exports.ts",
    "lint": "eslint --cache --cache-location node_modules/.cache/.eslintcache .",
    "format": "prettier --write --cache --cache-location node_modules/.cache/.prettiercache .",
    "format-check": "prettier --check --cache --cache-location node_modules/.cache/.prettiercache .",
    "test": "vitest",
    "test-unit": "vitest --project unit",
    "test-coverage": "vitest run --project unit --coverage",
    "release": "tsx scripts/release.ts",
    "release:dry": "tsx scripts/release.ts --dry",
    "ci-publish": "tsx scripts/publish.ts",
    "docs:dev": "vitepress dev apps/docs",
    "docs:build": "vitepress build apps/docs",
    "docs:preview": "vitepress preview apps/docs",
    "preinstall": "npx only-allow pnpm",
    "postinstall": "simple-git-hooks"
  },
  "devDependencies": {
    "@antfu/eslint-config": "^9.0.0",
    "@baicie/release": "^0.2.0",
    "@baicie/scripts": "^0.1.2",
    "@types/node": "^25.9.1",
    "eslint": "^10.4.1",
    "jsdom": "^29.1.1",
    "lint-staged": "^17.0.7",
    "picocolors": "^1.1.1",
    "prettier": "^3.8.3",
    "rimraf": "^6.1.3",
    "simple-git-hooks": "^2.13.1",
    "tsup": "^8.5.0",
    "tsx": "^4.22.4",
    "typescript": "^6.0.3",
    "vite": "^8.0.16",
    "vitepress": "^1.6.4",
    "vitest": "^4.1.8"
  },
  "simple-git-hooks": {
    "pre-commit": "pnpm lint-staged && pnpm check",
    "commit-msg": "node -e \"import('@baicie/scripts').then(m => m.verifyCommit())\""
  },
  "lint-staged": {
    "*.{js,json,md,yml,yaml}": [
      "prettier --write --cache --cache-location node_modules/.cache/.prettiercache"
    ],
    "*.ts?(x)": [
      "eslint --fix --cache --cache-location node_modules/.cache/.eslintcache",
      "prettier --parser=typescript --write --cache --cache-location node_modules/.cache/.prettiercache"
    ]
  }
}
```

# 3. TypeScript 配置调整

当前 `tsconfig.json` 已经继承 `scripts/tsconfig.base.json`，这是可以保留的。 但 base 里的 path 要从 `@baicie/*` 改成 `@zeus-web/*`。

## `scripts/tsconfig.base.json`

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "ignoreDeprecations": "6.0",
    "composite": true,

    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],

    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,

    "jsx": "react-jsx",
    "jsxImportSource": "@zeus-js/runtime-dom",

    "baseUrl": "..",
    "paths": {
      "@zeus-web/*": ["packages/*/src", "packages/primitives/*/src"]
    },

    "strict": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,

    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,

    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,

    "isolatedModules": true,
    "isolatedDeclarations": true,
    "skipLibCheck": true,
    "newLine": "LF"
  },
  "include": [
    "../packages/*/src",
    "../packages/primitives/*/src",
    "../packages/*/__tests__",
    "../packages/primitives/*/__tests__",
    "../scripts/**/*",
    "../apps/**/*",
    "../examples/**/*"
  ],
  "exclude": [
    "**/dist",
    "**/temp",
    "**/node_modules",
    "**/tsconfig.tsbuildinfo"
  ]
}
```

这里我保留了你当前 base config 的严格检查风格，因为当前配置已经开启了 `strict / noUnusedLocals / noUnusedParameters / isolatedModules / isolatedDeclarations` 等，这对组件库长期维护是好的。

## `scripts/tsconfig.build.json`

当前 build config 只 include `../packages/*/src`，后续会漏掉 `packages/primitives/*`。 建议改成：

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "composite": false,
    "types": ["node"],
    "declaration": true,
    "declarationMap": true,
    "emitDeclarationOnly": true,
    "noEmit": false,
    "stripInternal": true
  },
  "include": ["../packages/*/src", "../packages/primitives/*/src"],
  "exclude": ["**/__tests__", "**/dist", "**/playground", "**/node_modules"]
}
```

# 4. 构建脚本草案

Phase 0 不需要复杂 bundler，先用 `tsup` 扫每个包。后续如果你要复用 `zeus-js` 的 Web Component 输出能力，可以在 primitive 包里再接入。

## `scripts/build.ts`

```ts
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { execa } from 'execa'

const root = process.cwd()

function listPackageDirs() {
  const dirs: string[] = []

  const packageRoot = join(root, 'packages')
  if (existsSync(packageRoot)) {
    for (const name of readdirSync(packageRoot)) {
      const dir = join(packageRoot, name)
      if (existsSync(join(dir, 'package.json'))) {
        dirs.push(dir)
      }
    }
  }

  const primitivesRoot = join(root, 'packages/primitives')
  if (existsSync(primitivesRoot)) {
    for (const name of readdirSync(primitivesRoot)) {
      const dir = join(primitivesRoot, name)
      if (existsSync(join(dir, 'package.json'))) {
        dirs.push(dir)
      }
    }
  }

  return dirs
}

async function main() {
  const dirs = listPackageDirs()

  for (const dir of dirs) {
    await execa('pnpm', ['--dir', dir, 'build'], {
      stdio: 'inherit',
    })
  }
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
```

需要补依赖：

```bash
pnpm add -D execa tsup tsx
```

# 5. package exports 检查脚本

## `scripts/check-package-exports.ts`

```ts
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

interface PackageJson {
  name?: string
  private?: boolean
  exports?: Record<string, unknown>
  main?: string
  types?: string
}

const root = process.cwd()

function listPackageJsonFiles() {
  const files: string[] = []

  const roots = ['packages', 'packages/primitives']

  for (const rel of roots) {
    const abs = join(root, rel)
    if (!existsSync(abs)) continue

    for (const name of readdirSync(abs)) {
      const file = join(abs, name, 'package.json')
      if (existsSync(file)) {
        files.push(file)
      }
    }
  }

  return files
}

let hasError = false

for (const file of listPackageJsonFiles()) {
  const pkg = JSON.parse(readFileSync(file, 'utf8')) as PackageJson

  if (pkg.private) continue

  if (!pkg.name?.startsWith('@zeus-web/')) {
    console.error(`[exports] ${file}: package name must start with @zeus-web/`)
    hasError = true
  }

  if (!pkg.exports) {
    console.error(`[exports] ${pkg.name}: missing exports`)
    hasError = true
  }

  if (!pkg.types && !pkg.exports) {
    console.error(`[exports] ${pkg.name}: missing types or typed exports`)
    hasError = true
  }
}

if (hasError) {
  process.exit(1)
}
```

# 6. Primitive 单组件包模板

Phase 0 建议先放一个 `input` 作为模板包，不做完整 Input 行为，只验证“单组件包独立安装”这个模型。

## `packages/primitives/input/package.json`

```json
{
  "name": "@zeus-web/input",
  "version": "0.0.0",
  "description": "Headless input primitive for Zeus Web.",
  "type": "module",
  "sideEffects": ["./dist/wc.js", "./dist/**/*.css"],
  "files": ["dist", "custom-elements.json"],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./wc": {
      "types": "./dist/wc.d.ts",
      "import": "./dist/wc.js"
    },
    "./react": {
      "types": "./dist/react.d.ts",
      "import": "./dist/react.js"
    },
    "./vue": {
      "types": "./dist/vue.d.ts",
      "import": "./dist/vue.js"
    },
    "./custom-elements.json": {
      "default": "./custom-elements.json"
    }
  },
  "scripts": {
    "build": "tsup src/index.ts src/wc.ts src/react.ts src/vue.ts --format esm --dts --clean",
    "check": "tsc -p tsconfig.json --noEmit"
  },
  "peerDependencies": {
    "@zeus-js/runtime-dom": "^0.1.0"
  },
  "peerDependenciesMeta": {
    "react": {
      "optional": true
    },
    "vue": {
      "optional": true
    }
  }
}
```

## `packages/primitives/input/tsconfig.json`

```json
{
  "extends": "../../../scripts/tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"]
}
```

## `packages/primitives/input/src/index.ts`

```ts
export type InputType =
  | 'text'
  | 'email'
  | 'password'
  | 'search'
  | 'tel'
  | 'url'
  | 'number'

export interface InputProps {
  value?: string
  defaultValue?: string
  type?: InputType
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  required?: boolean
  name?: string
}

export interface InputValueChangeDetail {
  value: string
  nativeEvent: Event
}

export const inputTagName = 'zw-input'
```

## `packages/primitives/input/src/wc.ts`

Phase 0 可以先用最小注册版本，不实现完整 zeus-js defineElement，主要验证包出口、sideEffects、注册入口成立。

```ts
import { inputTagName } from './index'

export class ZeusInputElement extends HTMLElement {
  static get observedAttributes() {
    return [
      'value',
      'type',
      'placeholder',
      'disabled',
      'readonly',
      'required',
      'name',
    ]
  }

  private input?: HTMLInputElement

  connectedCallback() {
    if (this.input) return

    const input = document.createElement('input')
    input.part.add('input')
    input.setAttribute('data-slot', 'input')

    this.input = input
    this.syncAttributes()

    input.addEventListener('input', event => {
      const value = input.value
      this.dispatchEvent(
        new CustomEvent('value-change', {
          detail: {
            value,
            nativeEvent: event,
          },
          bubbles: true,
          composed: true,
        }),
      )
    })

    this.append(input)
  }

  attributeChangedCallback() {
    this.syncAttributes()
  }

  private syncAttributes() {
    if (!this.input) return

    for (const name of ZeusInputElement.observedAttributes) {
      if (this.hasAttribute(name)) {
        const value = this.getAttribute(name)

        if (name === 'disabled' || name === 'readonly' || name === 'required') {
          this.input.toggleAttribute(name, true)
        } else if (value != null) {
          this.input.setAttribute(name, value)
        }
      } else {
        this.input.removeAttribute(name)
      }
    }
  }
}

export function defineInputElement() {
  if (!customElements.get(inputTagName)) {
    customElements.define(inputTagName, ZeusInputElement)
  }
}

defineInputElement()
```

> Phase 1/2 再把这个换成正式 `zeus-js defineElement` 实现。Phase 0 先让包结构跑通。

## `packages/primitives/input/src/react.ts`

```ts
import './wc'

export {
  inputTagName,
  type InputProps,
  type InputType,
  type InputValueChangeDetail,
} from './index'

// Phase 0 暂不强依赖 React，先导出类型和 wc 注册。
// Phase 3 再实现正式 React wrapper。
export const Input = 'zw-input'
```

## `packages/primitives/input/src/vue.ts`

```ts
import './wc'

export {
  inputTagName,
  type InputProps,
  type InputType,
  type InputValueChangeDetail,
} from './index'

// Phase 0 暂不强依赖 Vue，先导出 wc 注册。
// Phase 3 再实现正式 Vue wrapper。
export const ZInput = 'zw-input'
```

# 7. 聚合包空壳

## `packages/headless/package.json`

```json
{
  "name": "@zeus-web/headless",
  "version": "0.0.0",
  "description": "Aggregated headless Web Components for Zeus Web.",
  "type": "module",
  "sideEffects": ["./dist/index.js"],
  "files": ["dist"],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts --clean",
    "check": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@zeus-web/input": "workspace:*"
  }
}
```

## `packages/headless/src/index.ts`

```ts
export * from '@zeus-web/input'
```

## `packages/react/package.json`

```json
{
  "name": "@zeus-web/react",
  "version": "0.0.0",
  "description": "React wrappers for Zeus Web primitives.",
  "type": "module",
  "sideEffects": false,
  "files": ["dist"],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts --clean",
    "check": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@zeus-web/input": "workspace:*"
  },
  "peerDependencies": {
    "react": "^18 || ^19"
  },
  "peerDependenciesMeta": {
    "react": {
      "optional": true
    }
  }
}
```

## `packages/react/src/index.ts`

```ts
export * from '@zeus-web/input/react'
```

## `packages/vue/package.json`

```json
{
  "name": "@zeus-web/vue",
  "version": "0.0.0",
  "description": "Vue wrappers for Zeus Web primitives.",
  "type": "module",
  "sideEffects": false,
  "files": ["dist"],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts --clean",
    "check": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@zeus-web/input": "workspace:*"
  },
  "peerDependencies": {
    "vue": "^3.4 || ^3.5"
  },
  "peerDependenciesMeta": {
    "vue": {
      "optional": true
    }
  }
}
```

## `packages/vue/src/index.ts`

```ts
export * from '@zeus-web/input/vue'
```

# 8. utils 包

## `packages/utils/package.json`

```json
{
  "name": "@zeus-web/utils",
  "version": "0.0.0",
  "description": "Shared utilities for Zeus Web.",
  "type": "module",
  "sideEffects": false,
  "files": ["dist"],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts --clean",
    "check": "tsc -p tsconfig.json --noEmit"
  }
}
```

## `packages/utils/src/index.ts`

```ts
export type ClassValue =
  | string
  | number
  | false
  | null
  | undefined
  | ClassValue[]

export function cx(...inputs: ClassValue[]): string {
  const result: string[] = []

  for (const input of inputs) {
    if (!input) continue

    if (Array.isArray(input)) {
      const value = cx(...input)
      if (value) result.push(value)
      continue
    }

    result.push(String(input))
  }

  return result.join(' ')
}
```

# 9. themes 包

## `packages/themes/package.json`

```json
{
  "name": "@zeus-web/themes",
  "version": "0.0.0",
  "description": "Theme tokens for Zeus Web.",
  "type": "module",
  "sideEffects": ["./dist/*.css"],
  "files": ["dist", "src"],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./tokens.css": "./src/tokens.css",
    "./default.css": "./src/default.css"
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts --clean",
    "check": "tsc -p tsconfig.json --noEmit"
  }
}
```

## `packages/themes/src/index.ts`

```ts
export const themePackageName = '@zeus-web/themes'
```

## `packages/themes/src/tokens.css`

```css
:root {
  --zw-radius: 0.5rem;
  --zw-background: 0 0% 100%;
  --zw-foreground: 240 10% 3.9%;
  --zw-primary: 240 5.9% 10%;
  --zw-primary-foreground: 0 0% 98%;
  --zw-border: 240 5.9% 90%;
  --zw-input: 240 5.9% 90%;
  --zw-ring: 240 5.9% 10%;
}
```

## `packages/themes/src/default.css`

```css
@import './tokens.css';

.dark {
  --zw-background: 240 10% 3.9%;
  --zw-foreground: 0 0% 98%;
  --zw-primary: 0 0% 98%;
  --zw-primary-foreground: 240 5.9% 10%;
  --zw-border: 240 3.7% 15.9%;
  --zw-input: 240 3.7% 15.9%;
  --zw-ring: 240 4.9% 83.9%;
}
```

# 10. registry 包

## `packages/registry/package.json`

```json
{
  "name": "@zeus-web/registry",
  "version": "0.0.0",
  "description": "Registry for Zeus Web shadcn-like components.",
  "type": "module",
  "sideEffects": false,
  "files": ["dist", "registry.json"],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./registry.json": {
      "default": "./registry.json"
    }
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts --clean",
    "check": "tsc -p tsconfig.json --noEmit"
  }
}
```

## `packages/registry/registry.json`

```json
{
  "$schema": "https://zeus-web.dev/schema/registry.json",
  "name": "zeus-web",
  "homepage": "https://zeus-web.dev",
  "items": [
    {
      "name": "input",
      "type": "registry:ui",
      "dependencies": [
        "@zeus-web/input",
        "clsx",
        "tailwind-merge",
        "class-variance-authority"
      ],
      "files": [
        {
          "path": "default/input.tsx",
          "target": "components/ui/input.tsx",
          "type": "registry:ui"
        }
      ]
    }
  ]
}
```

## `packages/registry/src/index.ts`

```ts
export interface RegistryItemFile {
  path: string
  target: string
  type: 'registry:ui' | 'registry:lib' | 'registry:style'
}

export interface RegistryItem {
  name: string
  type: 'registry:ui' | 'registry:block' | 'registry:lib' | 'registry:style'
  dependencies?: string[]
  files: RegistryItemFile[]
}

export interface Registry {
  name: string
  homepage?: string
  items: RegistryItem[]
}
```

# 11. CLI 包

## `packages/cli/package.json`

```json
{
  "name": "@zeus-web/cli",
  "version": "0.0.0",
  "description": "CLI for Zeus Web.",
  "type": "module",
  "bin": {
    "zweb": "./dist/index.js"
  },
  "files": ["dist"],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts --clean --banner.js \"#!/usr/bin/env node\"",
    "check": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "picocolors": "^1.1.1"
  }
}
```

## `packages/cli/src/index.ts`

```ts
#!/usr/bin/env node

import pc from 'picocolors'
import { add } from './commands/add'
import { init } from './commands/init'

const [, , command, ...args] = process.argv

async function main() {
  switch (command) {
    case 'init':
      await init(args)
      break

    case 'add':
      await add(args)
      break

    case undefined:
    case '-h':
    case '--help':
      printHelp()
      break

    default:
      console.error(pc.red(`Unknown command: ${command}`))
      printHelp()
      process.exit(1)
  }
}

function printHelp() {
  console.log(`\n${pc.bold('zweb')} - Zeus Web CLI\n`)
  console.log('Usage:')
  console.log('  zweb init')
  console.log('  zweb add input')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
```

## `packages/cli/src/commands/init.ts`

```ts
import { writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import pc from 'picocolors'

export async function init(_args: string[]) {
  const file = 'components.json'

  if (existsSync(file)) {
    console.log(pc.yellow('components.json already exists.'))
    return
  }

  await writeFile(
    file,
    `${JSON.stringify(
      {
        $schema: 'https://zeus-web.dev/schema/components.json',
        framework: 'react',
        style: 'default',
        tailwind: {
          css: 'src/styles/globals.css',
          cssVariables: true,
        },
        aliases: {
          components: '@/components',
          ui: '@/components/ui',
          lib: '@/lib',
        },
      },
      null,
      2,
    )}\n`,
  )

  console.log(pc.green('Created components.json'))
}
```

## `packages/cli/src/commands/add.ts`

```ts
import pc from 'picocolors'

const primitiveDeps: Record<string, string[]> = {
  input: [
    '@zeus-web/input',
    'clsx',
    'tailwind-merge',
    'class-variance-authority',
  ],
}

export async function add(args: string[]) {
  const components = args.filter(Boolean)

  if (components.length === 0) {
    console.error(pc.red('Please provide at least one component.'))
    console.log('Example: zweb add input')
    process.exit(1)
  }

  for (const component of components) {
    const deps = primitiveDeps[component]

    if (!deps) {
      console.error(pc.red(`Unknown component: ${component}`))
      process.exitCode = 1
      continue
    }

    console.log(pc.green(`Add ${component}`))
    console.log(`Dependencies: ${deps.join(', ')}`)
    console.log(
      pc.gray('Phase 0 only prints plan. Phase 5/6 will copy registry files.'),
    )
  }
}
```

# 12. eslint 配置补齐

当前仓库 `package.json` 里已经依赖了 `@antfu/eslint-config`，但我没有看到 `eslint.config.ts`。建议补：

```ts
import antfu from '@antfu/eslint-config'

export default antfu({
  typescript: true,
  formatters: false,
  ignores: [
    '**/dist',
    '**/coverage',
    '**/node_modules',
    '**/.vitepress/cache',
    '**/.vitepress/dist',
  ],
})
```

# 13. vitest 配置补齐

## `vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: [
      'packages/**/__tests__/**/*.test.ts',
      'packages/primitives/**/__tests__/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
})
```

# 14. README 草案

当前没有查到 `README.md`，建议 Phase 0 就补一个。

````md
# Zeus UI

Zeus UI is a shadcn-like, AI-ready UI system built on headless Web Components and Tailwind CSS.

## Packages

### Primitive packages

Each primitive can be installed independently.

```bash
pnpm add @zeus-web/input
```
````

```ts
import '@zeus-web/input/wc'
```

```html
<zw-input placeholder="Email"></zw-input>
```

### Aggregated packages

```bash
pnpm add @zeus-web/react
```

```tsx
import { Input } from '@zeus-web/react'
```

### CLI

```bash
pnpm dlx @zeus-web/cli init
pnpm dlx @zeus-web/cli add input
```

## Architecture

- `@zeus-web/input`: single headless primitive package
- `@zeus-web/headless`: aggregated Web Component package
- `@zeus-web/react`: aggregated React wrapper package
- `@zeus-web/vue`: aggregated Vue wrapper package
- `@zeus-web/registry`: shadcn-like registry
- `@zeus-web/cli`: CLI for init/add/update

````

# 15. Phase 0 验收标准

Phase 0 不以“组件能完整工作”为验收，而是以“工程基础跑通”为验收。

必须通过：

```bash
pnpm install
pnpm build
pnpm check
pnpm lint
pnpm test
pnpm check:exports
````

必须成立：

```txt
1. @zeus-web/input 是独立包
2. @zeus-web/input 暴露 ./wc / ./react / ./vue
3. @zeus-web/headless 聚合 @zeus-web/input
4. @zeus-web/react 聚合 @zeus-web/input/react
5. @zeus-web/vue 聚合 @zeus-web/input/vue
6. zweb CLI 可以执行 init/add
7. registry 里 input 依赖的是 @zeus-web/input，而不是 @zeus-web/react
8. TS path 使用 @zeus-web/*
9. workspace 覆盖 packages/primitives/*
10. release 脚本后续可以切到多包发布
```

# 16. 建议的提交拆分

```txt
feat: initialize zeus web monorepo foundation

包含：
- update workspace layout
- add primitive package template
- add @zeus-web/input scaffold
- add aggregate packages
- add registry scaffold
- add cli scaffold
- add build/export check scripts
- update tsconfig paths
```

更细一点可以拆成：

```txt
chore: update workspace and tsconfig for zeus web
chore: add package build and export check scripts
feat: add input primitive package scaffold
feat: add aggregate headless react vue packages
feat: add registry and cli scaffolds
docs: add initial readme
```

# 17. 我建议 Phase 0 的边界

不要在 Phase 0 做这些：

```txt
不要实现完整 Dialog
不要实现完整 Tabs
不要做真实 shadcn registry copy
不要做 React/Vue 完整 wrapper
不要做完整 docs
不要做 AI rules
不要做复杂 release 自动化
```

Phase 0 只要把“地基”定好：

```txt
单组件 primitive 包模型
聚合包模型
CLI 包模型
registry 包模型
构建检查模型
@zeus-web 命名模型
```

这一步做好，后面的 Phase 1/2 才不会返工。
