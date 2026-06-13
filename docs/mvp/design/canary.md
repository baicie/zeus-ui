下面给一版**基于 `zeus-ui@mvp` 当前代码状态**的 zeus-ui 侧详细设计与代码草案。核心目标是把之前讨论的这套机制真正落到 `zeus-ui`：

```txt
Zeus 发 canary
→ zeus-ui 自动安装 @zeus-js/*@canary
→ zeus-ui 跑 typecheck / build / test / contract
→ API 或能力破坏时自动失败
```

同时要把 `zeus-ui` 内部对 Zeus 的使用收口，避免到处直接依赖 `@zeus-js/runtime-dom`。

---

# 1. 当前代码现状

`zeus-ui` 当前定位已经很清楚：README 写的是一个类似 shadcn、AI-ready 的 UI system，基于 headless Web Components 和 Tailwind CSS。包结构上已有 `@zeus-web/utils`、`@zeus-web/input`、`@zeus-web/headless`、`@zeus-web/react`、`@zeus-web/vue`、`@zeus-web/themes`、`@zeus-web/registry`、`@zeus-web/cli` 等规划。

workspace 当前扫描：

```yaml
packages/*
packages/primitives/*
apps/*
examples/*
```

这说明 primitives 是独立一层，适合继续保持“一组件一 primitive package”。

目前已经有一个 primitive：

```txt
packages/primitives/input
```

它的包名是：

```json
"@zeus-web/input"
```

并且导出 `.`、`./wc`、`./react`、`./vue`、`./vue/global`、`custom-elements.json`、`zeus.components.json`。

构建链路已经走 Zeus web-c toolchain：primitive 的 `rollup.config.mjs` 使用 `createPrimitiveRollupConfig`。
共享 rollup 配置内部使用：

```ts
@zeus-js/bundler-plugin
@zeus-js/output-wc
@zeus-js/output-react-wrapper
@zeus-js/output-vue-wrapper
```

并且会输出 `wc / react / vue` 三类产物。

当前主要问题是：`input.tsx` 直接从 `@zeus-js/runtime-dom` 引入 `DefineElementSetup / defineElement / Host`。
但我们在 Zeus 侧已经把稳定入口收口到了 `@zeus-js/zeus`，并且它已经公开导出了 `DefineElementSetup / defineElement / Host / Slot` 等 API。

所以 zeus-ui 侧最优解是：

> **新增 `@zeus-web/zeus-compat` 防腐层，所有 primitive 不再直接 import `@zeus-js/*`，而是只从 `@zeus-web/zeus-compat` 进入。**

---

# 2. 总体目标架构

建议最终结构：

```txt
zeus-ui
├─ packages/
│  ├─ zeus-compat/              # 新增：Zeus API 防腐层
│  ├─ utils/
│  ├─ headless/
│  ├─ react/
│  ├─ vue/
│  ├─ themes/
│  ├─ registry/
│  ├─ cli/
│  └─ primitives/
│     └─ input/
├─ scripts/
│  ├─ checks/
│  │  ├─ check-package-exports.ts
│  │  ├─ check-zeus-imports.ts    # 新增
│  │  └─ package-rules.ts
│  └─ rollup/
│     └─ createPrimitiveRollupConfig.mjs
└─ .github/workflows/
   ├─ ci.yml
   ├─ test.yml
   └─ zeus-canary-compat.yml      # 新增
```

职责划分：

```txt
@zeus-web/zeus-compat
  只负责消费 @zeus-js/zeus 的公开 API
  统一导出 defineElement / Host / Slot / 类型 / capabilities
  后续 Zeus API 改名，只改这一层

@zeus-web/input
  只写组件逻辑
  不直接 import @zeus-js/runtime-dom
  不直接 import @zeus-js/zeus

scripts/checks/check-zeus-imports.ts
  禁止 primitive 源码绕过 compat 层

zeus-canary-compat.yml
  安装最新 @zeus-js/*@canary
  验证 zeus-ui 是否被 Zeus 新版本破坏
```

---

# 3. Phase 0：统一 tag 前缀

当前 README 示例是：

```html
<zw-input placeholder="Email"></zw-input>
```

但当前源码实际注册的是：

```ts
defineElement<InputProps>('z-input', ...)
```

同时共享 rollup config 默认 `tagPrefix = 'z-'`。

这里建议统一为 **`zw-`**，因为：

```txt
项目名是 Zeus Web
包作用域是 @zeus-web
README 已经使用 zw-input
zw- 比 z- 更不容易和其他库冲突
```

## 修改 `packages/primitives/input/src/input.tsx`

```diff
 export const Input = defineElement<InputProps>(
-  'z-input',
+  'zw-input',
   {
```

## 修改 `scripts/rollup/createPrimitiveRollupConfig.mjs`

```diff
 export function createPrimitiveRollupConfig(options = {}) {
-  const { input = 'src/index.ts', tagPrefix = 'z-', external = [] } = options
+  const { input = 'src/index.ts', tagPrefix = 'zw-', external = [] } = options
```

---

# 4. Phase 1：新增 `@zeus-web/zeus-compat`

## 4.1 新增包

路径：

```txt
packages/zeus-compat/
```

### `packages/zeus-compat/package.json`

```json
{
  "name": "@zeus-web/zeus-compat",
  "type": "module",
  "version": "0.0.0",
  "description": "Compatibility layer between Zeus Web and @zeus-js public APIs.",
  "license": "MIT",
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./capabilities": {
      "types": "./dist/capabilities.d.ts",
      "import": "./dist/capabilities.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "dev": "tsup src/index.ts src/capabilities.ts --format esm --dts --clean --watch",
    "build": "tsup src/index.ts src/capabilities.ts --format esm --dts --clean",
    "check": "tsc -p tsconfig.json --noEmit",
    "test": "vitest --project unit-jsdom"
  },
  "peerDependencies": {
    "@zeus-js/zeus": ">=0.1.0-beta.0 <0.2.0"
  }
}
```

注意：这里不依赖 `@zeus-js/runtime-dom`。从 Zeus 侧看，`@zeus-js/zeus` 已经是用户稳定入口，并且导出了 runtime-dom 中的组件和类型 API。

---

## 4.2 新增 `src/index.ts`

### `packages/zeus-compat/src/index.ts`

```ts
export {
  For,
  Host,
  Show,
  Slot,
  batch,
  computed,
  createContext,
  defineElement,
  effect,
  inject,
  nextTick,
  onCleanup,
  provide,
  render,
  scope,
  state,
  untrack,
  useContext,
  watch,
} from '@zeus-js/zeus'

export type {
  Component,
  Context,
  ContextBridgeProps,
  ContextProviderProps,
  DefineElementContext,
  DefineElementMeta,
  DefineElementOptions,
  DefineElementSetup,
  ForProps,
  HostProps,
  JSXValue,
  ShowProps,
  SlotProps,
} from '@zeus-js/zeus'

export { ZEUS_CAPABILITIES } from '@zeus-js/zeus/capabilities'
export type { ZeusCapabilities } from '@zeus-js/zeus/capabilities'
```

---

## 4.3 新增 `src/capabilities.ts`

### `packages/zeus-compat/src/capabilities.ts`

```ts
import { ZEUS_CAPABILITIES } from '@zeus-js/zeus/capabilities'

export { ZEUS_CAPABILITIES }
export type { ZeusCapabilities } from '@zeus-js/zeus/capabilities'

export interface ZeusCompatRequirement {
  area: string
  key: string
  expected: true
  actual: unknown
}

export function getMissingZeusCompatRequirements(): ZeusCompatRequirement[] {
  const missing: ZeusCompatRequirement[] = []

  const requiredWebComponentFeatures = [
    'defineElement',
    'Host',
    'Slot',
    'props',
    'attrs',
    'events',
    'styles',
  ] as const

  for (const key of requiredWebComponentFeatures) {
    const actual = ZEUS_CAPABILITIES.webComponents[key]

    if (actual !== true) {
      missing.push({
        area: 'webComponents',
        key,
        expected: true,
        actual,
      })
    }
  }

  return missing
}

export function assertZeusCompatRequirements(): void {
  const missing = getMissingZeusCompatRequirements()

  if (missing.length === 0) return

  const details = missing
    .map(
      item =>
        `${item.area}.${item.key}: expected true, got ${String(item.actual)}`,
    )
    .join('\n')

  throw new Error(
    `[zeus-ui] incompatible @zeus-js/zeus capabilities:\n${details}`,
  )
}
```

---

## 4.4 新增 contract test

### `packages/zeus-compat/__tests__/contract.spec.ts`

```ts
import { describe, expect, it } from 'vitest'

import {
  Host,
  Slot,
  ZEUS_CAPABILITIES,
  assertZeusCompatRequirements,
  defineElement,
} from '../src'

describe('@zeus-web/zeus-compat contract', () => {
  it('exposes runtime component APIs required by primitives', () => {
    expect(typeof defineElement).toBe('function')
    expect(Host).toBeDefined()
    expect(Slot).toBeDefined()
  })

  it('declares required Zeus capabilities', () => {
    expect(ZEUS_CAPABILITIES.webComponents.defineElement).toBe(true)
    expect(ZEUS_CAPABILITIES.webComponents.Host).toBe(true)
    expect(ZEUS_CAPABILITIES.webComponents.Slot).toBe(true)
    expect(ZEUS_CAPABILITIES.webComponents.props).toBe(true)
    expect(ZEUS_CAPABILITIES.webComponents.attrs).toBe(true)
    expect(ZEUS_CAPABILITIES.webComponents.events).toBe(true)
  })

  it('passes zeus-ui compatibility requirements', () => {
    expect(() => assertZeusCompatRequirements()).not.toThrow()
  })
})
```

---

# 5. Phase 2：改造 `@zeus-web/input`

当前 `input.tsx` 直接依赖 `@zeus-js/runtime-dom`。

改成只依赖 `@zeus-web/zeus-compat`。

## 5.1 修改 `input.tsx`

### `packages/primitives/input/src/input.tsx`

```diff
-import type { DefineElementSetup } from '@zeus-js/runtime-dom'
-import { defineElement, Host } from '@zeus-js/runtime-dom'
+import type { DefineElementSetup } from '@zeus-web/zeus-compat'
+import { Host, defineElement } from '@zeus-web/zeus-compat'
```

并改 tag：

```diff
 export const Input = defineElement<InputProps>(
-  'z-input',
+  'zw-input',
```

---

## 5.2 修改 `@zeus-web/input` 依赖

当前 `@zeus-web/input` peerDependencies 是 `@zeus-js/runtime-dom`。

建议改成：

```json
{
  "peerDependencies": {
    "@zeus-js/zeus": ">=0.1.0-beta.0 <0.2.0"
  },
  "dependencies": {
    "@zeus-web/zeus-compat": "workspace:*"
  }
}
```

完整片段：

```diff
-  "peerDependencies": {
-    "@zeus-js/runtime-dom": "^0.1.0-beta.0"
-  },
+  "peerDependencies": {
+    "@zeus-js/zeus": ">=0.1.0-beta.0 <0.2.0"
+  },
+  "dependencies": {
+    "@zeus-web/zeus-compat": "workspace:*"
+  },
```

---

# 6. Phase 3：修改共享构建配置

当前 shared rollup config external 里包含：

```ts
;('@zeus-js/runtime-dom', '@zeus-js/signal', 'react', 'vue')
```

改成：

```diff
 external: [
-  '@zeus-js/runtime-dom',
-  '@zeus-js/signal',
+  '@zeus-js/zeus',
+  '@zeus-web/zeus-compat',
   'react',
   'vue',
   ...external,
 ],
```

如果后续某些 primitive 真的需要 signal，也应该通过 `@zeus-web/zeus-compat` 导出，而不是直接 import `@zeus-js/signal`。

---

# 7. Phase 4：新增禁止直接 import Zeus 内部 API 的检查

当前已经有 package rules，会检查 primitive package 必须有 `rollup.config.mjs`、必须走 Zeus output pipeline、不能手写 `src/wc.ts / src/react.ts / src/vue.ts`，这很好。

但还缺一个检查：**primitive 源码不能直接 import `@zeus-js/*`。**

## 7.1 新增脚本

### `scripts/checks/check-zeus-imports.ts`

```ts
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import pc from 'picocolors'

const root = process.cwd()

const checkedRoots = [
  'packages/primitives',
  'packages/headless',
  'packages/react',
  'packages/vue',
  'packages/themes',
  'packages/utils',
  'packages/registry',
  'packages/cli',
]

const allowedFiles = new Set([
  'packages/zeus-compat/src/index.ts',
  'packages/zeus-compat/src/capabilities.ts',
])

const forbiddenImports = [
  '@zeus-js/runtime-dom',
  '@zeus-js/signal',
  '@zeus-js/zeus',
  '@zeus-js/zeus/capabilities',
]

let hasError = false

function toSlash(value: string): string {
  return value.replace(/\\/g, '/')
}

function walk(dir: string, files: string[] = []): string[] {
  if (!existsSync(dir)) return files

  for (const name of readdirSync(dir)) {
    const abs = join(dir, name)
    const stat = statSync(abs)

    if (stat.isDirectory()) {
      if (name === 'dist' || name === 'node_modules') continue
      walk(abs, files)
      continue
    }

    if (/\.(ts|tsx|mts|cts)$/.test(name)) {
      files.push(abs)
    }
  }

  return files
}

for (const relRoot of checkedRoots) {
  const absRoot = join(root, relRoot)

  for (const file of walk(absRoot)) {
    const rel = toSlash(relative(root, file))

    if (allowedFiles.has(rel)) continue

    const source = readFileSync(file, 'utf8')

    for (const specifier of forbiddenImports) {
      const staticImport = new RegExp(
        `from\\s+['"]${specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`,
      )
      const bareImport = new RegExp(
        `import\\s+['"]${specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`,
      )

      if (staticImport.test(source) || bareImport.test(source)) {
        hasError = true
        console.error(
          pc.red(
            `${rel}: do not import ${specifier} directly. Use @zeus-web/zeus-compat instead.`,
          ),
        )
      }
    }
  }
}

if (hasError) process.exit(1)

console.log(pc.green('Zeus import boundary check passed.'))
```

---

## 7.2 修改根 `package.json`

当前 scripts 已有 `check:exports`、`check:build-output` 等。

新增：

```diff
 {
   "scripts": {
     "check": "tsc -p tsconfig.json --incremental --noEmit",
     "check:exports": "tsx scripts/checks/check-package-exports.ts",
+    "check:zeus-imports": "tsx scripts/checks/check-zeus-imports.ts",
     "check:build-output": "tsx scripts/checks/check-build-output.ts"
   }
 }
```

---

## 7.3 修改 package rules

当前 primitive rule 要求 peer depend on `@zeus-js/runtime-dom`。

改成要求：

```txt
peerDependencies.@zeus-js/zeus
dependencies.@zeus-web/zeus-compat
```

### `scripts/checks/package-rules.ts`

修改 `PackageJsonLike`：

```diff
 export interface PackageJsonLike {
   name?: string
   private?: boolean
   scripts?: Record<string, string>
   sideEffects?: boolean | string[]
   exports?: Record<string, unknown>
   peerDependencies?: Record<string, string>
+  dependencies?: Record<string, string>
 }
```

替换 primitive 依赖校验：

```diff
-  if (!pkg.peerDependencies || !pkg.peerDependencies['@zeus-js/runtime-dom']) {
-    errors.push(
-      `${pkg.name}: primitive package must peer depend on @zeus-js/runtime-dom`,
-    )
-  }
+  if (!pkg.peerDependencies || !pkg.peerDependencies['@zeus-js/zeus']) {
+    errors.push(`${pkg.name}: primitive package must peer depend on @zeus-js/zeus`)
+  }
+
+  if (!pkg.dependencies || pkg.dependencies['@zeus-web/zeus-compat'] !== 'workspace:*') {
+    errors.push(
+      `${pkg.name}: primitive package must depend on @zeus-web/zeus-compat workspace:*`,
+    )
+  }
+
+  if (pkg.peerDependencies?.['@zeus-js/runtime-dom']) {
+    errors.push(
+      `${pkg.name}: primitive package must not peer depend on @zeus-js/runtime-dom; use @zeus-js/zeus via @zeus-web/zeus-compat`,
+    )
+  }
```

---

# 8. Phase 5：新增 Zeus canary compatibility workflow

当前 CI 比较基础：主 CI push/PR 会调用 test workflow 和 build。
test workflow 会跑 unit、lint、format、check，但 e2e job 里直接跑 `pnpm run test-e2e`，当前根 `package.json` 没看到 `test-e2e` script。

建议新增独立的 Zeus canary compatibility workflow，不混入普通 CI。

### `.github/workflows/zeus-canary-compat.yml`

```yaml
name: Zeus Canary Compatibility

on:
  repository_dispatch:
    types:
      - zeus-canary-published

  workflow_dispatch:

  schedule:
    - cron: '0 2 * * *'

concurrency:
  group: zeus-canary-compat-${{ github.ref }}
  cancel-in-progress: true

jobs:
  compatibility:
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

      - name: Install deps
        run: pnpm install --frozen-lockfile

      - name: Install latest Zeus canary packages
        run: |
          pnpm add -D \
            @zeus-js/zeus@canary \
            @zeus-js/runtime-dom@canary \
            @zeus-js/signal@canary \
            @zeus-js/compiler@canary \
            @zeus-js/component-analyzer@canary \
            @zeus-js/component-dts@canary \
            @zeus-js/bundler-plugin@canary \
            @zeus-js/output-wc@canary \
            @zeus-js/output-react-wrapper@canary \
            @zeus-js/output-vue-wrapper@canary \
            @zeus-js/output-css@canary \
            @zeus-js/output-icons@canary \
            @zeus-js/preset-component-library@canary \
            @zeus-js/vite-plugin@canary \
            --save-exact

      - name: Print Zeus versions
        run: |
          pnpm list @zeus-js/zeus @zeus-js/bundler-plugin @zeus-js/output-wc @zeus-js/runtime-dom

      - name: Check import boundaries
        run: pnpm check:zeus-imports

      - name: Typecheck
        run: pnpm check

      - name: Lint
        run: pnpm lint

      - name: Unit tests
        run: pnpm test-unit

      - name: Build packages
        run: pnpm build

      - name: Check package exports
        run: pnpm check:exports

      - name: Check build output
        run: pnpm check:build-output
```

为什么要装这么多 `@zeus-js/*@canary`？
因为当前 root devDependencies 已经依赖 `@zeus-js/bundler-plugin`、`compiler`、`component-analyzer`、`component-dts`、`output-*`、`runtime-dom`、`signal`、`zeus` 等 Zeus 包。

---

# 9. Phase 6：普通 CI 补齐检查

当前 CI build job 只跑：

```txt
pnpm install
pnpm build
```

建议改成：

```yaml
build:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v5

    - uses: pnpm/action-setup@v4

    - uses: actions/setup-node@v5
      with:
        node-version-file: .node-version
        cache: pnpm

    - run: pnpm install --frozen-lockfile
    - run: pnpm check:zeus-imports
    - run: pnpm check
    - run: pnpm build
    - run: pnpm check:exports
    - run: pnpm check:build-output
```

`test.yml` 也建议修两个点：

第一，所有 CI install 都用：

```bash
pnpm install --frozen-lockfile
```

第二，`e2e-test` 当前没有 install deps，而且根 `package.json` 没看到 `test-e2e` script。

短期建议先改成：

```yaml
e2e-test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v5
    - uses: pnpm/action-setup@v4
    - uses: actions/setup-node@v5
      with:
        node-version-file: .node-version
        cache: pnpm
    - run: pnpm install --frozen-lockfile
    - run: pnpm build
```

等真正有 e2e script 再恢复：

```yaml
- run: pnpm test-e2e
```

---

# 10. Phase 7：版本策略

当前 root devDependencies 里 Zeus 依赖使用的是：

```json
"@zeus-js/zeus": "^0.1.0-beta.0"
```

以及其他 `@zeus-js/*` 的 `^0.1.0-beta.0`。

建议分成两类：

## root devDependencies：固定版本

```json
{
  "devDependencies": {
    "@zeus-js/zeus": "0.1.0-beta.0",
    "@zeus-js/runtime-dom": "0.1.0-beta.0",
    "@zeus-js/signal": "0.1.0-beta.0",
    "@zeus-js/compiler": "0.1.0-beta.0",
    "@zeus-js/bundler-plugin": "0.1.0-beta.0",
    "@zeus-js/output-wc": "0.1.0-beta.0",
    "@zeus-js/output-react-wrapper": "0.1.0-beta.0",
    "@zeus-js/output-vue-wrapper": "0.1.0-beta.0"
  }
}
```

原因：

```txt
普通 CI 保持可复现
Zeus canary 兼容性由独立 workflow 验证
不要让 ^ 自动漂移导致本地/CI 不一致
```

## package peerDependencies：使用范围

例如 `@zeus-web/input`：

```json
{
  "peerDependencies": {
    "@zeus-js/zeus": ">=0.1.0-beta.0 <0.2.0"
  }
}
```

---

# 11. Phase 8：Renovate / 自动升级 PR

新增：

```txt
renovate.json
```

```json
{
  "extends": ["config:recommended"],
  "packageRules": [
    {
      "matchPackagePatterns": ["^@zeus-js/"],
      "groupName": "zeus packages",
      "rangeStrategy": "pin",
      "automerge": false,
      "labels": ["dependencies", "zeus"]
    }
  ]
}
```

这样正式 beta / rc / latest 升级会通过 PR 进入主线；canary 则由 `zeus-canary-compat.yml` 自动验证。

---

# 12. 最小落地顺序

## 第一步：先做防腐层

```txt
新增 packages/zeus-compat
修改 input.tsx import
修改 input package dependencies / peerDependencies
修改 createPrimitiveRollupConfig external
```

这是最核心的，先把代码入口收口。

## 第二步：加检查

```txt
新增 check:zeus-imports
修改 package-rules
CI 接入 check:zeus-imports
```

确保以后不会再有人直接 import `@zeus-js/runtime-dom`。

## 第三步：加 canary workflow

```txt
新增 zeus-canary-compat.yml
支持 repository_dispatch: zeus-canary-published
支持 workflow_dispatch
支持每日 schedule
```

这样 Zeus 侧发布 canary 后，zeus-ui 能自动验收。

## 第四步：修 CI 小问题

```txt
pnpm install -> pnpm install --frozen-lockfile
e2e-test 先不要跑不存在的 test-e2e
build job 增加 check / check:exports / check:build-output
```

---

# 13. 最终效果

完成后链路是：

```txt
Zeus main 合并
→ Zeus 发布 @zeus-js/*@canary
→ 触发 zeus-ui repository_dispatch
→ zeus-ui 安装最新 canary
→ @zeus-web/zeus-compat contract test
→ primitive 构建
→ wc/react/vue 输出构建
→ typecheck / lint / test / exports / build-output
```

同时 zeus-ui 内部变成：

```txt
primitive 组件
  ↓
@zeus-web/zeus-compat
  ↓
@zeus-js/zeus public API
```

而不是：

```txt
primitive 组件
  ↓
@zeus-js/runtime-dom
```

一句话：**zeus-ui 不再直接依赖 Zeus 内部实现，而是通过 compat 层消费 Zeus public API；Zeus 一发 canary，zeus-ui 自动验收是否被破坏。**
