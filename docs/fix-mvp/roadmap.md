结论先定死：**`fix/mvp` 不要推倒重来，headless primitive 保留；真正要补的是“原生 styled Web-C 层 + React/Vue registry + CLI 安装层”。**

你原始路线应该调整成：

```txt
Zeus
  -> 提供 compiler / web-c / wrapper / lazy registration 底座

Zeus-UI
  -> primitives：headless 行为层
  -> themes：token / CSS variables / theme presets
  -> ui：原生 styled Web Component 分发层
  -> registry：React/Vue shadcn-like 源码模板层
  -> cli：init / add / update / diff 安装管理
  -> showcase：展示 CLI 安装后的 styled 使用方式
```

当前 `fix/mvp` 已经有 showcase/test/e2e/CI 基础，根脚本里也有 `showcase:test / showcase:build / showcase:e2e / showcase:ci:*`。 所以后续不要继续在 showcase 上堆页面了，要把“组件使用入口”补全。

---

# 一、最终产品定位

## 1. Primitive 层：给设计系统作者

继续保留：

```txt
@zeus-web/button
@zeus-web/input
@zeus-web/dialog
...
```

定位：

```txt
行为 + a11y + 状态 + event + part/data-slot + web-c/react/vue wrapper
```

不承诺完整视觉样式。

用户：

```tsx
import { Button } from '@zeus-web/button/react'
```

这是高级入口，不是普通用户主入口。

---

## 2. Native styled Web-C 层：给原生/微前端用户

新增：

```txt
@zeus-web/ui
```

使用方式：

```ts
import '@zeus-web/ui/styles.css'
import '@zeus-web/ui/button'
import '@zeus-web/ui/input'
```

```html
<zw-button variant="primary">Save</zw-button>
<zw-input placeholder="Email"></zw-input>
```

这个入口必须开箱有样式。

它不重新实现行为，只组合：

```txt
@zeus-web/button/wc + button.css + theme tokens
```

---

## 3. React/Vue registry + CLI 层：给业务项目用户

主推入口：

```bash
pnpm dlx zeus-web init
pnpm dlx zeus-web add button input dialog
```

用户项目里生成：

```txt
src/components/ui/button.tsx
src/components/ui/input.tsx
src/lib/cn.ts
src/styles/zeus.css
zeus-ui.json
```

用户实际写：

```tsx
import { Button } from '@/components/ui/button'
```

这才是你想要的 shadcn-like 使用体验。

---

# 二、目录结构最终建议

```txt
packages/
  primitives/
    button/
    input/
    checkbox/
    switch/
    dialog/
    ...

  themes/
    src/
      tokens.css
      default.css
      slate.css
      zinc.css
      components.css
      index.ts

  ui/
    src/
      index.ts
      styles.css
      button.ts
      button.css
      input.ts
      input.css
      dialog.ts
      dialog.css
    package.json

  registry/
    registry.json
    schema.ts
    react/
      button.tsx
      input.tsx
      dialog.tsx
    vue/
      button.vue
      input.vue
      dialog.vue
    native/
      button.ts
      input.ts
    css/
      globals.css
    lib/
      cn.ts

  cli/
    src/
      commands/
        init.ts
        add.ts
        update.ts
        diff.ts
      registry/
      project/
      utils/
    package.json

examples/
  react-showcase/
  vue-showcase/
  native-showcase/
  primitive-showcase/   # 可选，不急
```

---

# 三、后续 fix/mvp 路线图

我建议从 **Phase 15** 继续，不要重排前面 Phase 8–14。前面 showcase/CI 已经闭环，后续是产品化补层。

---

# Phase 15：产品分层重定义与文档收口

## 目标

先把路线定死，避免后面继续摇摆。

## 交付物

新增：

```txt
docs/internal/design/zeus-ui-product-layers.md
docs/internal/design/zeus-ui-usage-model.md
docs/internal/design/zeus-ui-package-boundaries.md
```

内容明确：

```txt
primitives:
  headless，不保证最终样式

themes:
  tokens / CSS variables / theme preset

ui:
  原生 styled Web-C，有默认样式

registry:
  React/Vue 源码模板

cli:
  安装 registry 到用户项目

showcase:
  展示真实用户入口，不展示 primitive 作为默认入口
```

## 验收

```txt
所有文档都明确三种使用方式：
  1. native styled web-c
  2. React/Vue CLI registry
  3. primitive advanced usage
```

---

# Phase 16：`@zeus-web/ui` 原生 styled Web-C 基础包

## 目标

解决“原生使用没样式”的问题。

## 交付物

新增：

```txt
packages/ui/
  package.json
  src/index.ts
  src/styles.css
  src/button.ts
  src/button.css
  src/input.ts
  src/input.css
```

## `packages/ui/package.json`

```json
{
  "name": "@zeus-web/ui",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "sideEffects": ["*.css", "./dist/*.css"],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./styles.css": "./dist/styles.css",
    "./button": {
      "types": "./dist/button.d.ts",
      "default": "./dist/button.js"
    },
    "./button.css": "./dist/button.css",
    "./input": {
      "types": "./dist/input.d.ts",
      "default": "./dist/input.js"
    },
    "./input.css": "./dist/input.css"
  },
  "scripts": {
    "build": "tsup src/index.ts src/button.ts src/input.ts --format esm --dts && cp src/*.css dist/",
    "check": "tsc --noEmit",
    "test": "vitest --run"
  },
  "dependencies": {
    "@zeus-web/button": "workspace:*",
    "@zeus-web/input": "workspace:*",
    "@zeus-web/themes": "workspace:*"
  },
  "devDependencies": {
    "tsup": "8.5.1",
    "typescript": "^6.0.3",
    "vitest": "^4.1.8"
  }
}
```

## `src/button.ts`

```ts
import '@zeus-web/themes/default.css'
import './button.css'
import '@zeus-web/button/wc'
```

## `src/input.ts`

```ts
import '@zeus-web/themes/default.css'
import './input.css'
import '@zeus-web/input/wc'
```

## `src/index.ts`

```ts
import './styles.css'

import './button'
import './input'
```

## `src/styles.css`

```css
@import '@zeus-web/themes/default.css';
@import './button.css';
@import './input.css';
```

## 样式策略

用 primitive 暴露的这些稳定选择器：

```txt
data-slot
data-variant
data-size
data-state
data-disabled
part
```

短期先用 light DOM / data-slot：

```css
zw-button [data-slot='button'] {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--zeus-radius-md);
  font-size: var(--zeus-font-size-sm);
  font-weight: 500;
}

zw-button [data-slot='button'][data-variant='primary'] {
  background: hsl(var(--zeus-primary));
  color: hsl(var(--zeus-primary-foreground));
}
```

后续如果 primitive 切 Shadow DOM，再补 `::part`。

## 验收

```bash
pnpm --filter @zeus-web/ui build
pnpm --filter @zeus-web/ui check
```

手动验证：

```ts
import '@zeus-web/ui/styles.css'
import '@zeus-web/ui/button'
```

```html
<zw-button variant="primary">Save</zw-button>
```

必须有样式。

---

# Phase 17：Registry Schema 与基础模板

## 目标

建立 shadcn-like registry，不先做 CLI，先把组件模板和元数据稳定下来。

## 交付物

新增：

```txt
packages/registry/
  package.json
  registry.json
  src/schema.ts
  react/button.tsx
  react/input.tsx
  vue/button.vue
  vue/input.vue
  css/globals.css
  lib/cn.ts
```

## `registry.json` 示例

```json
{
  "$schema": "./schema.json",
  "version": 1,
  "items": [
    {
      "name": "button",
      "type": "component",
      "frameworks": ["react", "vue"],
      "dependencies": ["@zeus-web/button"],
      "registryDependencies": ["cn"],
      "files": [
        {
          "framework": "react",
          "source": "react/button.tsx",
          "target": "components/ui/button.tsx"
        },
        {
          "framework": "vue",
          "source": "vue/button.vue",
          "target": "components/ui/button.vue"
        }
      ]
    }
  ]
}
```

## React `button.tsx`

```tsx
import type { ComponentProps } from 'react'
import { Button as ButtonPrimitive } from '@zeus-web/button/react'

import { cn } from '@/lib/cn'

export interface ButtonProps extends ComponentProps<typeof ButtonPrimitive> {
  className?: string
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
        'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:pointer-events-none disabled:opacity-50',
        variant === 'primary' &&
          'bg-primary text-primary-foreground hover:bg-primary/90',
        variant === 'outline' &&
          'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        size === 'sm' && 'h-8 px-3',
        size === 'md' && 'h-9 px-4',
        size === 'lg' && 'h-10 px-6',
        size === 'icon' && 'h-9 w-9',
        className,
      )}
      {...props}
    />
  )
}
```

## 验收

新增 check：

```txt
scripts/checks/check-registry.ts
```

检查：

```txt
registry.json schema 正确
每个 item source 文件存在
dependencies 存在于 workspace 或 npm dependency
target 路径合法
name 不重复
```

命令：

```json
{
  "check:registry": "tsx scripts/checks/check-registry.ts"
}
```

---

# Phase 18：CLI `init`

## 目标

先让用户项目具备 Zeus-UI 使用环境。

## 命令

```bash
pnpm dlx zeus-web init
```

## 生成

```txt
zeus-ui.json
src/lib/cn.ts
src/styles/zeus.css
```

## `zeus-ui.json`

```json
{
  "$schema": "https://zeus-ui.dev/schema.json",
  "framework": "react",
  "style": "tailwind",
  "typescript": true,
  "aliases": {
    "components": "@/components",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "styles": "@/styles"
  }
}
```

## CLI 检测能力

必须检测：

```txt
React / Vue
Vite / Next / Nuxt
TypeScript / JavaScript
Tailwind config
src 目录
路径 alias
package manager
```

## 验收

在临时 fixtures 下跑：

```bash
pnpm --filter @zeus-web/cli test
```

测试 fixtures：

```txt
fixtures/react-vite
fixtures/vue-vite
fixtures/empty-project
```

---

# Phase 19：CLI `add`

## 目标

真正实现：

```bash
pnpm dlx zeus-web add button input
```

## 行为

```txt
读取 zeus-ui.json
解析 registry.json
复制对应 framework 模板
自动复制 cn.ts / globals.css
安装依赖
支持 --dry-run
支持 --overwrite
支持 --cwd
```

## 示例

```bash
zeus-web add button
```

生成：

```txt
src/components/ui/button.tsx
```

安装：

```txt
@zeus-web/button
```

## 需要考虑的点

### 1. 依赖版本

registry 里的 dependency 不应该写死版本，CLI 根据当前包版本安装：

```txt
@zeus-web/button@latest
```

本地 monorepo 测试时允许：

```txt
workspace:*
```

### 2. 覆盖策略

默认不覆盖：

```txt
button.tsx already exists
Use --overwrite to replace it.
```

### 3. diff 策略

Phase 19 可以只做 dry-run，不做复杂三方 merge。

```bash
zeus-web add button --dry-run
```

输出：

```txt
CREATE src/components/ui/button.tsx
INSTALL @zeus-web/button
```

---

# Phase 20：React/Vue Showcase 切到 CLI styled usage

## 目标

当前 showcase 不再直接展示 primitive 使用，而是展示 CLI 安装后的 styled 组件。

## 调整

React showcase：

```txt
examples/react-showcase/src/components/ui/button.tsx
examples/react-showcase/src/components/ui/input.tsx
```

Vue showcase：

```txt
examples/vue-showcase/src/components/ui/button.vue
examples/vue-showcase/src/components/ui/input.vue
```

这些文件来源应该和 registry 保持一致。

## 最佳方式

新增脚本：

```txt
scripts/examples/sync-showcase-registry.ts
```

把 registry 模板同步到 showcase：

```bash
pnpm sync:showcase-registry
```

避免 showcase 和 registry 漂移。

## 验收

```bash
pnpm sync:showcase-registry --check
pnpm showcase:test
pnpm showcase:build
pnpm showcase:e2e
```

---

# Phase 21：Native Showcase

## 目标

证明原生 Web-C 不是裸奔。

新增：

```txt
examples/native-showcase/
```

使用：

```ts
import '@zeus-web/ui/styles.css'
import '@zeus-web/ui/button'
import '@zeus-web/ui/input'
```

页面：

```html
<zw-button variant="primary">Save</zw-button>
<zw-input placeholder="Email"></zw-input>
```

## CI

新增：

```bash
pnpm --filter @zeus-web/example-native-showcase build
```

E2E 可以先只 smoke：

```txt
/ renders styled zw-button
/ renders styled zw-input
```

---

# Phase 22：Docs 重写三种使用方式

## 目标

彻底消除用户困惑。

文档首页必须直接写：

```txt
Recommended:
  React/Vue -> CLI add
  Native Web Component -> @zeus-web/ui
  Advanced / Design System -> primitives
```

## 文档结构

```txt
docs/
  getting-started/
    react.md
    vue.md
    native.md
  primitives/
    button.md
    input.md
  cli/
    init.md
    add.md
    update.md
  registry/
    authoring.md
  theming/
    tokens.md
    dark-mode.md
```

---

# Phase 23：CLI `update` / `diff`

## 目标

shadcn-like 组件升级体验。

命令：

```bash
zeus-web diff button
zeus-web update button
```

## 第一版不要做复杂 merge

先做：

```txt
diff:
  比较 registry 当前模板和用户本地文件

update:
  如果本地未修改，直接覆盖
  如果本地已修改，生成 .new 文件或提示手动处理
```

输出：

```txt
button.tsx has local changes.
Generated button.tsx.new.
Please merge manually.
```

---

# Phase 24：稳定版发布前收口

## 目标

准备真正 MVP 发布。

检查项：

```txt
所有 primitive 有：
  - wc
  - react
  - vue
  - types
  - data-slot / part
  - docs
  - tests

所有 styled registry 组件有：
  - react template
  - vue template
  - dependency metadata
  - showcase usage
  - e2e coverage

所有 native styled 组件有：
  - @zeus-web/ui export
  - css
  - native showcase example
```

发布前命令：

```bash
pnpm check
pnpm build
pnpm site:check
pnpm showcase:ci
pnpm release:verify --allow-zero
```

---

# 四、几个你可能没考虑到但必须提前定的点

## 1. Tailwind class 扫描问题

CLI registry 生成到用户项目里，所以 Tailwind 能扫到 class。
不要让用户依赖 node_modules 里的 Tailwind class，这是坑。

所以：

```txt
React/Vue styled 组件 = 源码复制到项目
Native Web-C styled = 普通 CSS，不用 Tailwind
```

这点很关键。

---

## 2. Shadow DOM 策略

短期建议：

```txt
primitive 默认 light DOM
稳定 data-slot / data-state / part
```

未来如果切 Shadow DOM：

```txt
@zeus-web/ui 改成 ::part 样式
registry React/Vue 不受影响
```

也就是说，必须从现在开始给 primitive 加稳定 `part`。

---

## 3. 样式 token 不要绑定 Tailwind

`@zeus-web/themes` 应该输出 CSS variables，而不是 Tailwind-only。

```css
:root {
  --zeus-primary: 222 47% 11%;
  --zeus-primary-foreground: 210 40% 98%;
}
```

Tailwind 只是消费这些 token：

```ts
colors: {
  primary: 'hsl(var(--zeus-primary))'
}
```

Native Web-C 也消费这些 token：

```css
background: hsl(var(--zeus-primary));
```

---

## 4. Primitive 的 variant 是否保留？

保留，但语义化，不绑定视觉。

```txt
variant="primary"
size="md"
state="open"
disabled
```

primitive 只负责把它们映射成：

```txt
data-variant
data-size
data-state
aria-*
```

styled 层再决定这些 variant 长什么样。

---

## 5. 包命名要避免误导

现在 `@zeus-web/button` 容易让用户以为是最终 UI 组件。
短期不改包名，但文档必须写清楚：

```txt
@zeus-web/button is a primitive package.
For styled native Web Components, use @zeus-web/ui/button.
For React/Vue apps, use zeus-web add button.
```

长期可以考虑：

```txt
@zeus-web/primitives/button
@zeus-web/ui
```

但 MVP 先别大迁移，避免成本过大。

---

## 6. Registry 和 Showcase 必须防漂移

showcase 不能手写一套和 registry 不同的组件。

必须有：

```bash
pnpm sync:showcase-registry --check
```

否则后面 CLI 模板变了，showcase 还是旧的。

---

## 7. CLI 不要一开始做在线 registry

MVP 先内置 registry：

```txt
@zeus-web/registry
```

CLI 从本地包读取模板。
以后再做远程 registry：

```txt
https://registry.zeus-ui.dev
```

这样风险小很多。

---

# 五、最终 MVP 定义

你这个 `fix/mvp` 真正完成，应该满足：

```txt
1. Zeus-UI primitives 可作为底层 headless 行为层使用
2. 原生 Web Component 用户能通过 @zeus-web/ui 获得有样式组件
3. React/Vue 用户能通过 CLI add 获得源码组件
4. showcase 展示的是 CLI 安装后的真实使用方式
5. docs 明确三种入口
6. CI 覆盖 metadata / unit / build / e2e / showcase
```

一句话：

```txt
primitive 是底座，不是最终体验；
@zeus-web/ui 是原生最终体验；
CLI registry 是 React/Vue 最终体验。
```

---

# 六、建议后续分支规划

```txt
docs/zeus-ui-layering
feat/native-styled-ui
feat/registry-foundation
feat/cli-init
feat/cli-add
refactor/showcase-use-registry
feat/native-showcase
docs/usage-model
feat/cli-update-diff
chore/mvp-release-readiness
```

---

# 七、近期最优执行顺序

不要一口气全做。最稳顺序是：

```txt
第一轮：
  Phase 15 文档定架构
  Phase 16 @zeus-web/ui button/input
  Phase 17 registry button/input

第二轮：
  Phase 18 CLI init
  Phase 19 CLI add button/input
  Phase 20 React/Vue showcase 切 registry

第三轮：
  Phase 21 native showcase
  Phase 22 docs
  Phase 23 update/diff
  Phase 24 release readiness
```

这样你不会再在“到底 headless 还是 styled”之间来回摇摆。路线定下来后，每个包的职责都清楚，Zeus 和 Zeus-UI 的关系也清楚。
