重新按新增要求整理后，最终架构应该是：

```txt id="v0e11r"
zeus-js
  只负责 Web Component 编译/运行时/输出生态，后续不再扩展 UI 使用层

zeus-web
  只负责组件库使用层
  核心模式 = 单组件 headless primitive 包 + 聚合包 + shadcn-like registry + CLI + themes + AI rules
```

核心变化是：**底层 headless UI 必须拆成独立 primitive 包**。比如用户只想用 Input，就可以只安装：

```bash id="wls7tm"
pnpm add @zeus-web/input
```

而不是必须安装整个 `@zeus-web/headless`。

# 1. 最终架构总览

```txt id="xm6ag9"
┌────────────────────────────────────────────┐
│ apps/docs                                  │
│ 文档、组件预览、registry preview、AI docs    │
└────────────────────────────────────────────┘
                    ↓
┌────────────────────────────────────────────┐
│ @zeus-web/cli                              │
│ zweb init / add / update / registry / ai    │
└────────────────────────────────────────────┘
                    ↓
┌────────────────────────────────────────────┐
│ @zeus-web/registry                         │
│ shadcn-like 可复制源码组件                   │
│ 依赖单个 primitive 包，而不是全量大包          │
└────────────────────────────────────────────┘
                    ↓
┌────────────────────────────────────────────┐
│ @zeus-web/themes                           │
│ CSS Variables / Tailwind tokens / themes    │
└────────────────────────────────────────────┘
                    ↓
┌────────────────────────────────────────────┐
│ @zeus-web/react / @zeus-web/vue             │
│ 聚合 wrapper 包，方便一次性使用               │
└────────────────────────────────────────────┘
                    ↓
┌────────────────────────────────────────────┐
│ @zeus-web/headless                         │
│ 聚合 Web Component headless 包              │
└────────────────────────────────────────────┘
                    ↓
┌────────────────────────────────────────────┐
│ @zeus-web/button / input / dialog / ...     │
│ 单组件 headless primitive 包                │
└────────────────────────────────────────────┘
                    ↓
┌────────────────────────────────────────────┐
│ zeus-js                                    │
│ defineElement / Host / Slot / compiler      │
└────────────────────────────────────────────┘
```

你之前 `zeus-js` 里已经有 `defineElement / Host / Slot / Web Component output / React wrapper / Vue wrapper / dts output` 这些方向，后续 `zeus-web` 不应该再重复做编译基础设施，而是消费这些能力。原有内部路线里也已经明确了 `Headless Components` 负责行为，`Registry` 负责可复制、可定制 UI。

## 2. 最终包设计

## 2.1 单组件 primitive 包

每个底层 headless 组件都是一个独立 npm 包：

```txt id="m6iicp"
@zeus-web/button
@zeus-web/input
@zeus-web/textarea
@zeus-web/checkbox
@zeus-web/switch
@zeus-web/radio-group
@zeus-web/tabs
@zeus-web/dialog
@zeus-web/popover
@zeus-web/tooltip
@zeus-web/select
@zeus-web/dropdown-menu
@zeus-web/combobox
```

用户可以最小安装：

```bash id="m3epox"
pnpm add @zeus-web/input
```

原生 Web Component 使用：

```ts id="j0dlbs"
import '@zeus-web/input/wc'
```

```html id="k9q2ji"
<zw-input placeholder="Email"></zw-input>
```

React 使用：

```tsx id="p50xx7"
import { Input } from '@zeus-web/input/react'
;<Input placeholder="Email" />
```

Vue 使用：

```vue id="k2peml"
<script setup lang="ts">
import { ZInput } from '@zeus-web/input/vue'
</script>

<template>
  <ZInput placeholder="Email" />
</template>
```

## 2.2 聚合包

为了方便用户，也提供聚合包：

```txt id="m6o0ot"
@zeus-web/headless
@zeus-web/react
@zeus-web/vue
```

使用：

```tsx id="zbn2kq"
import { Button, Dialog, Input } from '@zeus-web/react'
```

聚合包只做 re-export：

```ts id="oofr3g"
export * from '@zeus-web/button/react'
export * from '@zeus-web/dialog/react'
export * from '@zeus-web/input/react'
```

这样同时满足两类用户：

```txt id="th61m4"
追求最小依赖：
  pnpm add @zeus-web/input

追求使用方便：
  pnpm add @zeus-web/react
```

## 3. 包命名最终建议

## npm scope

```txt id="jsfviq"
@zeus-web
```

## CLI 包

```txt id="vk30da"
@zeus-web/cli
```

## CLI bin

```txt id="q7nzlm"
zweb
```

使用：

```bash id="zwub3c"
pnpm dlx @zeus-web/cli init
pnpm dlx @zeus-web/cli add input
pnpm dlx @zeus-web/cli add button dialog tabs
```

## Web Component 标签前缀

建议用：

```txt id="f5p2tm"
zw-
```

例如：

```html id="r2x9v3"
<zw-button></zw-button>
<zw-input></zw-input>
<zw-dialog></zw-dialog>
<zw-tabs></zw-tabs>
```

不用 `z-`，因为太泛；`zw-` 更明确代表 `zeus-web`。

## 4. 单组件包结构

以 `@zeus-web/input` 为例：

```txt id="jyuwm4"
packages/primitives/input/
  src/
    input.tsx
    input.types.ts
    input.events.ts
    input.meta.ts
    wc.ts
    react.tsx
    vue.ts
    index.ts
  package.json
```

建议每个 primitive 包都输出：

```txt id="ceadgp"
.
./wc
./react
./vue
./custom-elements.json
```

`package.json` 示例：

```json id="pjjzsr"
{
  "name": "@zeus-web/input",
  "version": "0.1.0",
  "type": "module",
  "sideEffects": ["./dist/wc.js", "./dist/**/*.css"],
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
      "default": "./dist/custom-elements.json"
    }
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

## 5. Monorepo 结构

推荐单独建仓库：`baicie/zeus-web`。

```txt id="b04wo6"
zeus-web/
  package.json
  pnpm-workspace.yaml
  tsconfig.base.json
  eslint.config.ts
  prettier.config.ts

  packages/
    primitives/
      button/
      input/
      textarea/
      checkbox/
      switch/
      radio-group/
      tabs/
      dialog/
      popover/
      tooltip/
      select/
      dropdown-menu/
      combobox/

    headless/
      src/index.ts
      package.json

    react/
      src/index.ts
      package.json

    vue/
      src/index.ts
      package.json

    themes/
      src/
        tokens.css
        default.css
        slate.css
        zinc.css
        neutral.css
      package.json

    registry/
      registry.json
      default/
        button/
        input/
        dialog/
        tabs/
      blocks/
        login-form/
        dashboard-shell/
        data-table-page/
      rules/
        zeus-web.md
        accessibility.md
        ai-usage.md
      package.json

    cli/
      src/
        commands/
          init.ts
          add.ts
          update.ts
          list.ts
          search.ts
          registry.ts
          ai.ts
        index.ts
      package.json

    utils/
      src/
        cn.ts
        compose-event.ts
        dom.ts
      package.json

  apps/
    docs/

  examples/
    vanilla/
    vite-react/
    vite-vue/
    registry-react/
    registry-vue/
```

`pnpm-workspace.yaml`：

```yaml id="jww8ph"
packages:
  - 'packages/primitives/*'
  - 'packages/*'
  - 'apps/*'
  - 'examples/*'
```

## 6. Registry 依赖策略

这是新增要求影响最大的地方。

之前 registry 组件可能会依赖：

```json id="wcc4sl"
{
  "dependencies": ["@zeus-web/react"]
}
```

现在要改成：**registry 组件依赖对应单组件 primitive 包**。

例如 `zweb add input` 生成的 registry item 依赖：

```json id="r2yuoj"
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
      "path": "default/input/input.tsx",
      "target": "components/ui/input.tsx",
      "type": "registry:ui"
    }
  ]
}
```

生成的 `input.tsx`：

```tsx id="ggpwhn"
import { Input as InputPrimitive } from '@zeus-web/input/react'
import { cn } from '@/lib/utils'

export function Input({ className, ...props }) {
  return (
    <InputPrimitive
      data-slot="input"
      className={cn(
        'border-input placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs transition-colors outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}
```

这样用户只添加 Input，就不会安装 Button、Dialog、Tabs 等无关 primitive。

## 7. DOM 策略

最终定为：

```txt id="wtcy1k"
默认 Light DOM
支持 Shadow DOM option
```

规则：

```txt id="pqh2vc"
headless primitive 默认 light DOM
registry styled 组件默认 light DOM + Tailwind
企业嵌入 / SDK / 强隔离组件允许 shadow DOM
```

原因：

```txt id="zjcpi0"
Light DOM 更适合 Tailwind
Light DOM 更适合 shadcn-like 源码复制
Light DOM 更适合 data-state / className / class 覆盖
Shadow DOM 更适合隔离，但不适合作为默认 UI 库模式
```

## 8. Phase 0：项目初始化与边界确认

## 目标

建立 `zeus-web` 独立项目，并明确只做使用层。

## 要做的事

```txt id="kh71o4"
0.1 新建 baicie/zeus-web 仓库
0.2 确定 npm scope：@zeus-web
0.3 确定 CLI：@zeus-web/cli
0.4 确定 CLI bin：zweb
0.5 确定 Web Component 前缀：zw-
0.6 配置 pnpm workspace
0.7 配置 tsconfig / eslint / prettier
0.8 配置 vitest / playwright
0.9 配置 changesets
0.10 配置 GitHub Actions
0.11 配置 release dry-run
0.12 确定 zeus-js 作为底层 peer/dev dependency
```

## 验收标准

```bash id="jkkobv"
pnpm install
pnpm build
pnpm check
pnpm test
pnpm release:dry
```

全部通过。

## 9. Phase 1：Primitive Package 架构

## 目标

先把“单组件独立包”的标准定好。

## 要做的事

```txt id="bndngf"
1.1 建立 packages/primitives/* 目录规范
1.2 定义 primitive package template
1.3 定义 package exports 规范
1.4 定义 ./wc / ./react / ./vue 子路径规范
1.5 定义 sideEffects 规范
1.6 定义 peerDependencies 规范
1.7 定义 custom-elements.json 输出规范
1.8 定义组件命名规范
1.9 定义事件命名规范
1.10 定义 data-state / data-disabled / data-slot 规范
```

## 每个 primitive 必须支持

```txt id="qycu3m"
@zeus-web/input
@zeus-web/input/wc
@zeus-web/input/react
@zeus-web/input/vue
@zeus-web/input/custom-elements.json
```

## 验收标准

做一个空的 `@zeus-web/input` 模板包，能 build、能导出类型、能被 example 安装。

## 10. Phase 2：Headless Primitive MVP

## 目标

实现第一批独立 headless primitive 包。

## 首批组件

```txt id="xn94uo"
@zeus-web/button
@zeus-web/input
@zeus-web/checkbox
@zeus-web/switch
@zeus-web/tabs
@zeus-web/dialog
```

注意这版把 `input` 放进 MVP，因为你已经明确提出“input 包可以单独安装”。

## 每个组件要做的事

```txt id="j9gj1i"
2.x.1 实现 primitive Web Component
2.x.2 输出 ./wc
2.x.3 输出 ./react
2.x.4 输出 ./vue
2.x.5 输出类型
2.x.6 输出 custom-elements.json
2.x.7 补单测
2.x.8 补 keyboard 测试
2.x.9 补 accessibility 测试
2.x.10 补 vanilla/react/vue examples
```

## 验收标准

最小安装可用：

```bash id="h38wrt"
pnpm add @zeus-web/input
```

React 中可用：

```tsx id="fqt6h2"
import { Input } from '@zeus-web/input/react'
;<Input placeholder="Email" />
```

原生 HTML 中可用：

```ts id="bz761k"
import '@zeus-web/input/wc'
```

```html id="g8o3y7"
<zw-input placeholder="Email"></zw-input>
```

## 11. Phase 3：聚合包

## 目标

在单组件包之上，提供方便使用的聚合包。

## 包

```txt id="qhpzze"
@zeus-web/headless
@zeus-web/react
@zeus-web/vue
```

## 要做的事

```txt id="qfitul"
3.1 @zeus-web/headless re-export 所有 primitive 的 wc 入口
3.2 @zeus-web/react re-export 所有 primitive react wrapper
3.3 @zeus-web/vue re-export 所有 primitive vue wrapper
3.4 验证 tree-shaking
3.5 验证只 import Input 不打入 Dialog
3.6 验证 sideEffects 不误删 wc 注册模块
```

## 验收标准

聚合使用可用：

```tsx id="egqhx6"
import { Button, Dialog, Input } from '@zeus-web/react'
```

单包使用仍可用：

```tsx id="pi0dn2"
import { Input } from '@zeus-web/input/react'
```

## 12. Phase 4：主题系统

## 目标

提供 Tailwind + CSS Variables 的主题能力。

## 包

```txt id="f14nfe"
@zeus-web/themes
```

## 要做的事

```txt id="uuzqma"
4.1 定义 tokens.css
4.2 定义 default.css
4.3 定义 light/dark mode
4.4 定义 color tokens
4.5 定义 radius tokens
4.6 定义 spacing / typography tokens
4.7 定义 Tailwind v4 适配方式
4.8 兼容 Tailwind v3
4.9 支持 slate / zinc / neutral / stone
4.10 支持用户覆盖变量
```

## 验收标准

registry 组件只依赖 CSS variables，不写死主题色。

## 13. Phase 5：Registry MVP

## 目标

做 shadcn-like 可复制源码层。

## 组件

```txt id="ch98f4"
button
input
checkbox
switch
tabs
dialog
```

## 要做的事

```txt id="kvcy0s"
5.1 定义 registry.json
5.2 定义 registry-item schema
5.3 每个 registry item 依赖单组件 primitive 包
5.4 编写 button 源码模板
5.5 编写 input 源码模板
5.6 编写 checkbox 源码模板
5.7 编写 switch 源码模板
5.8 编写 tabs 源码模板
5.9 编写 dialog 源码模板
5.10 编写 theme.css
5.11 编写 utils.ts
```

## 关键规则

```txt id="pzrg5o"
zweb add input
  只安装 @zeus-web/input

zweb add dialog
  只安装 @zeus-web/dialog

zweb add button dialog tabs
  安装 @zeus-web/button、@zeus-web/dialog、@zeus-web/tabs
```

## 验收标准

```bash id="q2llq7"
zweb add input
```

生成：

```txt id="jck8lj"
src/components/ui/input.tsx
```

安装：

```txt id="jr72uj"
@zeus-web/input
clsx
tailwind-merge
class-variance-authority
```

不会安装整个 `@zeus-web/react`。

## 14. Phase 6：CLI MVP

## 目标

实现 `zweb init / add`。

## 命令

```bash id="jpbaqv"
zweb init
zweb add input
zweb add button dialog tabs
zweb add --all
zweb list
zweb search input
```

## 要做的事

```txt id="ye7qkj"
6.1 实现项目类型检测
6.2 检测 React / Vue / Vite / Next
6.3 检测 TypeScript
6.4 检测 Tailwind
6.5 生成 components.json
6.6 读取 registry item
6.7 安装单组件 primitive 依赖
6.8 复制组件源码
6.9 合并 theme.css
6.10 生成 utils.ts
6.11 支持 --dry-run
6.12 支持 --overwrite
6.13 支持冲突检测
```

## components.json

```json id="g3t6qn"
{
  "$schema": "https://zeus-web.dev/schema/components.json",
  "framework": "react",
  "style": "default",
  "tailwind": {
    "css": "src/styles/globals.css",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "ui": "@/components/ui",
    "lib": "@/lib"
  }
}
```

## 验收标准

空 Vite React 项目中：

```bash id="d77qmz"
pnpm dlx @zeus-web/cli init
pnpm dlx @zeus-web/cli add input button dialog
pnpm dev
```

可以直接运行。

## 15. Phase 7：文档与 Playground

## 目标

让用户能理解三种使用方式：

```txt id="pydhvi"
单组件 primitive 包
聚合包
registry 可复制源码
```

## 文档结构

```txt id="ynrvd9"
docs/
  introduction
  installation
  primitive-packages
  aggregated-packages
  cli
  registry
  theming
  dark-mode
  components/
    button
    input
    checkbox
    switch
    tabs
    dialog
  accessibility/
  ai/
```

## 每个组件文档必须包含

```txt id="vxb94z"
Primitive install
Registry install
React usage
Vue usage
Web Component usage
Props
Events
Slots
Data attributes
Keyboard interactions
Accessibility
```

## 验收标准

Input 文档里必须同时有：

```bash id="x2czha"
pnpm add @zeus-web/input
```

和：

```bash id="cex41d"
zweb add input
```

两种方式。

## 16. Phase 8：表单组件扩展

## 目标

补齐表单 primitive 独立包。

## 新增 primitive 包

```txt id="iwt2di"
@zeus-web/textarea
@zeus-web/label
@zeus-web/radio-group
@zeus-web/select
@zeus-web/slider
@zeus-web/field
@zeus-web/input-otp
```

## 要做的事

```txt id="sh8ops"
8.1 每个表单组件独立包
8.2 每个包输出 ./wc / ./react / ./vue
8.3 每个 registry item 只依赖对应 primitive
8.4 支持 data-invalid
8.5 支持 data-required
8.6 支持 aria-describedby
8.7 支持 form association 可行性调研
8.8 补表单 examples
```

## 验收标准

```bash id="lwfr9q"
zweb add input textarea label checkbox button
```

可以拼出完整登录表单。

## 17. Phase 9：Overlay 与复杂交互组件

## 目标

实现复杂交互 primitive 包。

## 新增 primitive 包

```txt id="p16ejq"
@zeus-web/tooltip
@zeus-web/popover
@zeus-web/dropdown-menu
@zeus-web/context-menu
@zeus-web/hover-card
@zeus-web/sheet
@zeus-web/alert-dialog
@zeus-web/command
@zeus-web/combobox
@zeus-web/toast
```

## 需要抽象的内部能力

这些能力可以放到内部工具包：

```txt id="gpak7k"
@zeus-web/focus-scope
@zeus-web/dismissable-layer
@zeus-web/portal
@zeus-web/popper
@zeus-web/roving-focus
```

是否公开发包可以后续决定，但内部需要拆清楚。

## 要做的事

```txt id="dq28j0"
9.1 focus trap
9.2 outside click
9.3 escape key
9.4 scroll lock
9.5 portal
9.6 positioning
9.7 nested overlay
9.8 roving tabindex
9.9 typeahead
9.10 overlay stack manager
```

## 验收标准

```txt id="ywwpuy"
Dialog 里能打开 Popover
Dropdown 支持键盘选择
Tooltip 不抢焦点
Toast 支持自动消失
Command 支持搜索和键盘选择
```

## 18. Phase 10：数据展示与中后台组件

## 目标

支撑 SQL GUI、管理后台、docs 后台等项目。

## 新增包

```txt id="gjow6w"
@zeus-web/table
@zeus-web/pagination
@zeus-web/breadcrumb
@zeus-web/resizable
@zeus-web/sidebar
@zeus-web/tree
@zeus-web/card
@zeus-web/badge
@zeus-web/skeleton
@zeus-web/empty
```

## 要做的事

```txt id="x8z79e"
10.1 实现基础 Table primitive
10.2 实现 Data Table registry 模板
10.3 实现 Pagination
10.4 实现 Sidebar
10.5 实现 Resizable Panels
10.6 实现 Tree
10.7 实现 Breadcrumb
10.8 实现 dashboard block
```

## 验收标准

```bash id="sp08x3"
zweb add sidebar table pagination breadcrumb
```

能生成一个基础后台布局。

## 19. Phase 11：Icons 与 Blocks

## 目标

从组件库升级为页面片段生态。

## Icons

```txt id="slmc64"
@zeus-web/icons
```

建议 icons 不按每个 icon 一个 npm 包，而是一个 icons 包，内部保证 tree-shaking。

要做的事：

```txt id="xhpvvi"
11.1 建立 icons manifest
11.2 SVG source 管理
11.3 React icon 输出
11.4 Vue icon 输出
11.5 Web Component icon 输出
11.6 支持 no-runtime static icon
11.7 支持 tree-shaking
```

## Blocks

```txt id="qcg9db"
login-form
register-form
dashboard-shell
settings-page
data-table-page
command-menu
empty-state
error-page
```

## 验收标准

```bash id="t0zymz"
zweb add login-form
zweb add dashboard-shell
```

可以生成完整页面片段。

## 20. Phase 12：AI-ready 生态

## 目标

让 AI 能正确使用 `zeus-web`。

## 要做的事

```txt id="qdfr6g"
12.1 生成 llms.txt
12.2 生成 llms-full.txt
12.3 生成 Cursor rules
12.4 生成 Copilot instructions
12.5 生成 AGENTS.md snippet
12.6 生成组件 AI metadata
12.7 生成 registry AI metadata
12.8 生成 usage examples
12.9 生成 anti-pattern examples
12.10 CLI 支持 ai export
```

## CLI

```bash id="y5uak9"
zweb ai export
zweb ai cursor
zweb ai copilot
zweb ai agents
```

## 组件 AI metadata 示例

```json id="zi777f"
{
  "name": "input",
  "primitivePackage": "@zeus-web/input",
  "registryCommand": "zweb add input",
  "description": "Use Input for text-like form controls.",
  "imports": {
    "primitiveReact": "@zeus-web/input/react",
    "registryReact": "@/components/ui/input"
  },
  "examples": [
    "<Input placeholder=\"Email\" />",
    "<Input type=\"password\" placeholder=\"Password\" />"
  ],
  "rules": [
    "Use Label with Input when the field needs a visible label.",
    "Use aria-label when no visible label exists.",
    "Use data-invalid for invalid state."
  ]
}
```

## 验收标准

AI 生成代码时：

```txt id="oamzfc"
不会把 registry import 和 primitive import 混用
不会乱造不存在的 props
知道 zweb add input 只安装 @zeus-web/input
知道 Button/Input/Dialog 的正确使用方式
```

## 21. Phase 13：质量体系

## 目标

保证多包、多组件、多入口不会失控。

## 要做的事

```txt id="nuxqb4"
13.1 primitive 单测
13.2 wc 注册测试
13.3 react wrapper 测试
13.4 vue wrapper 测试
13.5 accessibility 测试
13.6 keyboard interaction 测试
13.7 visual regression 测试
13.8 bundle size 测试
13.9 tree-shaking 测试
13.10 CLI e2e 测试
13.11 registry smoke test
13.12 package exports 检查
```

## 重点测试

```txt id="gtf37r"
安装 @zeus-web/input 不应包含 dialog 代码
import { Input } from '@zeus-web/react' 不应打入所有组件
import '@zeus-web/input/wc' 必须能注册 zw-input
sideEffects 不能导致 wc 注册被 tree-shaking 删除
```

## 验收标准

```bash id="p5xj0u"
pnpm check
pnpm lint
pnpm test
pnpm test:e2e
pnpm test:a11y
pnpm size
pnpm registry:check
pnpm examples:check
```

全部通过。

## 22. Phase 14：发布与版本策略

## 目标

管理大量 primitive 包的发版。

## 发布顺序

```txt id="arokhu"
@zeus-web/utils
@zeus-web/themes

@zeus-web/button
@zeus-web/input
@zeus-web/checkbox
@zeus-web/switch
@zeus-web/tabs
@zeus-web/dialog

@zeus-web/headless
@zeus-web/react
@zeus-web/vue

@zeus-web/registry
@zeus-web/cli
```

## 版本节奏

```txt id="msuobf"
0.1.0：项目初始化 + primitive package template
0.2.0：首批 primitive 单组件包
0.3.0：聚合包 + React/Vue 使用层
0.4.0：themes + registry MVP
0.5.0：CLI init/add
0.6.0：docs + playground
0.7.0：form primitive 扩展
0.8.0：overlay primitive 扩展
0.9.0：admin/data components + blocks + AI
1.0.0：稳定版
```

## 验收标准

```txt id="ezsxpk"
npm provenance 正常
changesets 正常
tag 正常
docs 自动部署
CLI 可 pnpm dlx 使用
单组件包可独立安装
聚合包 tree-shaking 正常
```

## 23. Phase 15：稳定版 1.0

## 目标

对外宣布稳定。

## 1.0 前必须完成

```txt id="jtqcwm"
15.1 单组件包模型稳定
15.2 registry schema 稳定
15.3 CLI init/add/update 稳定
15.4 React/Vue wrapper 类型稳定
15.5 Tailwind theme 稳定
15.6 docs 完整
15.7 AI rules 可用
15.8 a11y 测试覆盖核心组件
15.9 examples 全部可 build
15.10 release 流程稳定
```

## 24. 最终路线总览

```txt id="t1mvle"
Phase 0   项目初始化与边界确认
Phase 1   Primitive Package 架构
Phase 2   Headless Primitive MVP：button/input/checkbox/switch/tabs/dialog
Phase 3   聚合包：headless/react/vue
Phase 4   Tailwind + CSS Variables 主题系统
Phase 5   shadcn-like Registry MVP
Phase 6   CLI MVP：init/add/list/search
Phase 7   文档与 Playground
Phase 8   表单组件扩展
Phase 9   Overlay 与复杂交互组件
Phase 10  数据展示与中后台组件
Phase 11  Icons 与 Blocks
Phase 12  AI-ready 生态
Phase 13  质量体系
Phase 14  发布与版本策略
Phase 15  1.0 稳定版
```

## 25. 最推荐的实际推进顺序

不要一上来铺所有组件，先打穿最小闭环。

## 第一闭环：单组件包成立

```txt id="qb0g5s"
Phase 0 → Phase 1 → Phase 2
```

目标：

```bash id="vyvf88"
pnpm add @zeus-web/input
```

可以使用：

```tsx id="sclp0p"
import { Input } from '@zeus-web/input/react'
```

这是新增要求的核心验收点。

## 第二闭环：聚合使用成立

```txt id="fy32tw"
Phase 3
```

目标：

```tsx id="x80jbh"
import { Button, Dialog, Input } from '@zeus-web/react'
```

并且 tree-shaking 正常。

## 第三闭环：shadcn-like 成立

```txt id="ughcfe"
Phase 4 → Phase 5 → Phase 6
```

目标：

```bash id="ktn4tv"
pnpm dlx @zeus-web/cli init
pnpm dlx @zeus-web/cli add input button dialog
```

生成可改源码，并且只安装对应 primitive 包。

## 第四闭环：生态成立

```txt id="cv9id4"
Phase 7 → Phase 12
```

目标：

```txt id="h2ibj2"
文档完善
组件丰富
blocks 可用
AI 能正确生成 zeus-web 代码
```

## 26. 最终一句话结论

最终 `zeus-web` 应该这样设计：

```txt id="lhy086"
底层每个 headless primitive 都是独立 npm 包：
@zeus-web/input
@zeus-web/button
@zeus-web/dialog

中层提供聚合包：
@zeus-web/headless
@zeus-web/react
@zeus-web/vue

上层提供 shadcn-like 使用体验：
@zeus-web/registry
@zeus-web/themes
@zeus-web/cli

CLI 默认按需安装单组件 primitive：
zweb add input 只安装 @zeus-web/input
```

这条路线比“一个大 headless 包 + 一个 registry”更适合长期维护，也更符合你想要的“使用方面生态”：**用户想轻量用就单包安装，想方便用就聚合包，想高度定制就 registry 复制源码。**
