下面是基于当前 `zeus-ui/mvp` 最新实现重新整理的 **最新版 roadmap**。核心前提保持不变：

> `zeus-web` 不再自己手写 `wc/react/vue wrapper`，只写组件源、主题、registry、CLI、AI metadata、docs/examples；Web Component 产物、React wrapper、Vue wrapper、manifest、dts 继续交给 `@zeus-js/web-c` 生态生成。

当前代码已经进入比较完整的 MVP 后半段：`CLI` 已经有 `init / add / ai` 命令，入口已接入 `ai`。
`@zeus-web/ai` 包也已经存在，并具备 build/check/test 脚本。
CLI 也已经依赖 `@zeus-web/ai / registry / themes`。

---

# 最新 Roadmap 总览

```txt
Phase 0  架构归位：接入 zeus web-c 输出生态
Phase 1  Primitive 基础包结构与构建规则
Phase 2  Headless Primitives MVP
Phase 3  聚合入口与多端产物闭环
Phase 4  Theme System MVP
Phase 5  Registry Styled UI MVP
Phase 6  CLI add Copy MVP
Phase 7  CLI init + components.json + install MVP
Phase 8  AI Metadata + zweb ai MVP
Phase 9  Docs / Examples / Playground
Phase 10 Accessibility & Interaction 完整化
Phase 11 组件扩展第一批
Phase 12 Registry / CLI 生产级增强
Phase 13 Theming / Styling 进阶
Phase 14 Icons 生态
Phase 15 Testing / Release / 0.1.0
```

---

# Phase 0：架构归位，已完成

目标是把项目路线从“自己手写 wrapper”纠正为：

```txt
源码组件：zeus-web 维护
wc/react/vue/dts/manifest：zeus/packages/web-c 生成
registry/cli/themes/docs/ai：zeus-web 维护
```

当前 package rules 已经在约束 primitive 包不能手写 `src/wc.ts / src/react.ts / src/vue.ts`，必须使用 Zeus output pipeline。

状态：**完成**

---

# Phase 1：Primitive 基础包结构与构建规则，已完成

目标：

```txt
packages/primitives/<name>
  src/index.ts
  src/<name>.tsx
  package.json
  tsconfig.json
  __tests__/*.spec.ts
```

要求：

```txt
1. 每个 primitive 使用 @zeus-js/zeus 写源码。
2. 每个 primitive 使用共享 rolldown.config.ts。
3. 每个 primitive 产出 wc/react/vue/custom-elements/zeus.components。
4. 每个 primitive 必须有 analyzer 测试。
```

当前 package rules 已经要求 primitive 包使用共享 `rolldown.config.ts`，并要求 `peerDependencies.@zeus-js/zeus`。

状态：**完成**

---

# Phase 2：Headless Primitives MVP，已完成

已包含第一批组件：

```txt
input
button
checkbox
switch
tabs
dialog
```

能力矩阵：

```txt
props
events
slots
methods
css parts
data-slot
data-state
React/Vue wrapper 事件 metadata
WC manifest
```

当前 AI metadata 和测试也已经覆盖这 6 个 MVP 组件。

状态：**完成**

---

# Phase 3：聚合入口与多端产物闭环，已完成

目标：

```txt
@zeus-web/headless
@zeus-web/react
@zeus-web/vue
```

职责：

```txt
@zeus-web/headless：聚合导入所有 wc entries
@zeus-web/react：聚合 React wrappers
@zeus-web/vue：聚合 Vue wrappers
```

同时确保：

```txt
1. 单 primitive 可独立安装。
2. 聚合包只是方便入口。
3. 用户仍然可以只安装 @zeus-web/input。
```

状态：**完成**

---

# Phase 4：Theme System MVP，已完成

目标：

```txt
@zeus-web/themes
  default.css
  slate.css
  zinc.css
  neutral.css
  stone.css
  tokens.css
```

当前 themes 已被 CLI 作为依赖接入。

能力：

```txt
1. shadcn-like CSS variables。
2. Tailwind semantic token。
3. light/dark。
4. 多主题。
5. 给 registry styled source 提供 bg-background / text-foreground / border-input / ring-ring 等 token。
```

状态：**完成**

---

# Phase 5：Registry Styled UI MVP，已完成

目标：

```txt
@zeus-web/registry
  registry.json
  default/lib/utils.ts
  default/button.tsx
  default/input.tsx
  default/checkbox.tsx
  default/switch.tsx
  default/tabs.tsx
  default/dialog.tsx
```

规则：

```txt
1. registry 组件是 React + Tailwind 源码。
2. 用户通过 zweb add 复制到本地。
3. registry source 使用 @zeus-web/<name>/react 单组件入口。
4. 不依赖 @zeus-web/react 聚合包。
5. cn 工具随组件复制。
```

状态：**完成**

---

# Phase 6：CLI add Copy MVP，已完成

`zweb add` 已经进入真实可用阶段：

```bash
zweb add button input
zweb add dialog --dry-run
zweb add button --overwrite
zweb add input --cwd ./playground
```

当前 `add` 已经能读取 `components.json`、解析 alias、复制 registry 文件，并返回 planned/written/skipped。

已支持：

```txt
--dry-run
--overwrite
--cwd
--no-install
--package-manager
```

状态：**完成**

---

# Phase 7：CLI init + Config + Install MVP，已完成

`zweb init` 目标：

```txt
1. 创建 components.json。
2. 写入 theme css。
3. 安装 @zeus-web/themes。
4. 支持 --style / --css / --cwd / --overwrite / --no-install。
```

当前 `components.json` 结构已经包含：

```txt
framework
style
tailwind.css
tailwind.cssVariables
aliases.components
aliases.ui
aliases.lib
```

相关 config 逻辑已经支持读取、校验、alias 解析和 registry target 解析。

状态：**完成**

---

# Phase 8：AI Metadata + zweb ai MVP，已完成

已有能力：

```txt
@zeus-web/ai
zweb ai
zweb ai --json
zweb ai --cursor
zweb ai --output docs/ai.md
```

CLI 入口已接入 `ai` 命令。`@zeus-web/ai` metadata 覆盖了组件说明、安装方式、React import、WC import、styled import、props、events、slots、examples、AI rules。

实现细节：

```txt
- metadata 通过 validateAiMetadata 校验（包含 installCommand/sourceTarget 检查）
- zweb ai --output xxx --json 保留用户指定的 output
- zweb ai 读取 components.json 按 alias 重写 guide 中的 import 路径
```

状态：**已完成**

---

# Phase 9：Docs / Examples，已完成

Phase 9 已落地，面向用户体验的文档和示例验证。

已完成：

```txt
apps/docs/
  index.md              VitePress 文档首页
  guide/getting-started.md
  guide/cli.md
  guide/theming.md
  guide/registry.md
  guide/ai.md
  components/button.md
  components/input.md
  components/checkbox.md
  components/switch.md
  components/tabs.md
  components/dialog.md
  examples/react-vite.md
  examples/native-wc.md

examples/react-vite/    React + registry-style styled wrappers
examples/native-wc/    原生 Web Component 使用路径

根脚本：
  pnpm docs:build
  pnpm examples:check
  pnpm examples:build
  pnpm site:build
```

**不做的内容**（留到后续阶段）：Next.js example、Playground、docs 自动生成。

状态：**已完成**

---

## Phase 9.1：Docs Polish + Contract Check，已完成

在 Phase 9 基础上完成文档质量和 CI 保障。

已完成：

```txt
apps/docs/.vitepress/data/site.ts  统一 nav/sidebar 元数据
apps/docs/.vitepress/theme/         自定义 VitePress 主题
  index.ts
  style.css                        品牌色、首页渐变、grid/card/badge 组件
apps/docs/index.md                polish 首页：gradient hero、3 actions、badge/card/command
apps/docs/guide/                  强化 guide 文档
  getting-started.md               zw-grid card、Initialize 章节、直接 primitive 用法
  cli.md                          命令总表 + 表格化选项
  theming.md                      zw-badge-row + token 表格
  registry.md                     registry item shape JSON
  ai.md                           3 种生成方式分离 + recommended AI instruction

scripts/checks/check-docs.ts      docs contract 检查脚本
  14 个必需页面 mustContain 检查
  2 个禁止模式检查（@zeus-ui / zeus-ui）
  config.ts 结构检查（data/site.ts 引用）
  theme 文件存在性检查

根脚本：
  pnpm docs:check                 check-docs.ts + @zeus-web/docs check
  pnpm site:check                docs:check && docs:build && examples:check
```

不做：Playground、API 自动生成、自定义 Vue 组件。

状态：**已完成**

---

# Phase 10：Accessibility & Interaction 完整化

这阶段补“组件库质量”，不是继续扩组件数量。

重点：

```txt
Dialog:
  focus trap
  return focus
  outside click close
  aria-labelledby / aria-describedby
  overlay primitive

Tabs:
  ArrowLeft / ArrowRight / Home / End
  vertical keyboard behavior
  roving tabindex

Checkbox:
  indicator 默认渲染策略
  indeterminate visual

Switch:
  keyboard behavior
  label association

Input:
  aria-invalid
  describedby
  prefix/suffix click/focus 行为

Button:
  loading aria-busy
  icon-only aria-label 提示
```

建议补测试：

```txt
unit behavior tests
jsdom interaction tests
a11y metadata tests
```

状态：**未开始**

---

# Phase 11：组件扩展第一批

这阶段开始补 shadcn-like 常用组件。

## P0 表单类

```txt
label
textarea
radio-group
select
form-field
```

优先原因：

```txt
这些和 input/checkbox/switch 强关联，可以快速组成表单。
```

## P1 展示类

```txt
card
badge
separator
avatar
skeleton
alert
```

优先原因：

```txt
实现简单，docs/example 价值高。
```

## P2 交互类

```txt
popover
tooltip
dropdown-menu
accordion
collapsible
toast
```

优先原因：

```txt
复杂度高，需要 Phase 10 的 a11y 基础支撑。
```

状态：**未开始**

---

# Phase 12：Registry / CLI 生产级增强

当前 CLI 已经能用，但还不是 shadcn 级体验。

## Phase 12.1 `zweb add` 增强

```txt
zweb add
  支持多个组件
  支持 --all
  支持 --path
  支持 --registry
  支持 --yes
  支持 --skip-deps
  支持 --force
```

## Phase 12.2 `zweb update`

```bash
zweb update button
zweb update --all
```

能力：

```txt
1. 对比本地文件和 registry 文件。
2. 显示 diff。
3. 支持 overwrite。
4. 支持 dry-run。
```

## Phase 12.3 `zweb doctor`

```bash
zweb doctor
```

检查：

```txt
components.json 是否存在
tailwind css 是否引入主题
依赖是否安装
alias 是否可解析
registry 文件是否存在
```

## Phase 12.4 Remote Registry

```txt
支持本地内置 registry
支持远程 registry URL
支持 registry lock
```

状态：**未开始**

---

# Phase 13：Theming / Styling 进阶

当前 theme 是 MVP CSS variables。

后续增强：

```txt
1. 支持 radius preset。
2. 支持 accent color preset。
3. 支持 CSS vars 导出 JSON。
4. 支持主题生成器。
5. 支持 zweb theme 命令。
6. 支持 dark mode class/data-theme 策略选择。
7. 支持 motion token。
```

命令设想：

```bash
zweb theme list
zweb theme add zinc
zweb theme set slate
zweb theme tokens --json
```

状态：**未开始**

---

# Phase 14：Icons 生态

依赖 `@zeus-js/output-icons` 生态，不自己手写多端图标。

目标：

```txt
packages/icons
  src/*.svg
  dist/react
  dist/vue
  dist/wc
  dist/svg
```

能力：

```txt
1. React Icon
2. Vue Icon
3. WC Icon
4. raw SVG
5. registry icon usage
6. AI metadata icon rules
```

优先级：**P2**
原因：组件 MVP 和 CLI 生产化更重要。

---

# Phase 15：Testing / Release / 0.1.0

最终发 0.1.0 前需要做一次系统性收尾。

## 测试矩阵

```txt
pnpm check
pnpm test
pnpm check:exports
pnpm build
pnpm check:build-output
```

当前构建脚本会扫描 `packages` 和 `packages/primitives`，primitive 优先构建。

## 需要增加的测试

```txt
1. CLI e2e：临时目录执行 init/add/ai。
2. Registry source typecheck。
3. Example app build。
4. Bundle size check。
5. Generated wrapper smoke test。
6. AI guide snapshot test。
7. Theme CSS token completeness test。
```

## 0.1.0 发布标准

```txt
1. input/button/checkbox/switch/tabs/dialog 可用。
2. wc/react/vue 产物正常。
3. zweb init 可用。
4. zweb add 可用。
5. zweb ai 可用。
6. themes 可用。
7. registry 可用。
8. docs 有 getting started。
9. examples/react-vite 可跑。
10. CI 全绿。
```

状态：**未开始**

---

# 版本节奏建议

```txt
0.0.x
  内部 MVP，继续破坏性调整。

0.1.0-alpha.0
  primitives + themes + registry + cli init/add/ai 首次公开试用。

0.1.0-beta.0
  docs/examples/a11y 第一轮补齐。

0.1.0
  首个可推荐试用版本。

0.2.0
  扩展表单和展示组件。

0.3.0
  扩展 popover/tooltip/dropdown/toast 等交互组件。

0.4.0
  CLI update/doctor/remote registry。

1.0.0
  API 稳定、a11y 完整、docs/example 完整。
```

---

# 当前最推荐的下一步

不要马上进入新组件扩展。建议顺序是：

```txt
1. Phase 10：开始补 Dialog/Tabs a11y。
2. Phase 11：再扩 label/textarea/radio/select。
3. Phase 12：CLI update/doctor/remote registry。
4. Phase 13：Theming 进阶。
```

```txt
docs: add vitepress documentation site and examples
```
