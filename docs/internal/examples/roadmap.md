可以，这个方向比我前面说的“一个 showcase 总页”更合理。最终形态应该是：

```txt
React Showcase App
  /                         总览
  /components/button         Button 全能力页
  /components/input          Input 全能力页
  /components/checkbox       Checkbox 全能力页
  ...
  /icons                     Icon 全展示页
  /themes                    Theme token 全展示页
  /playground                组合场景页

Vue Showcase App
  同样的路由结构
```

核心目标不是“展示好看”，而是 **用真实应用形态验证所有组件能力**。

---

# 总体定位

这两个 example 应该定义为：

```txt
examples/react-showcase
examples/vue-showcase
```

不是普通 demo，而是：

```txt
production-grade component laboratory
```

每个组件一个页面，每个页面固定结构：

```txt
1. 组件说明
2. import 用法
3. 基础用法
4. variants
5. sizes
6. states
7. controlled / uncontrolled
8. events log
9. accessibility
10. theme token preview
11. icon integration
12. real-world pattern
13. unit test coverage
14. e2e test coverage
```

这样后续每新增一个组件，就必须新增：

```txt
route
page
unit test
e2e test
coverage metadata
```

---

# 推荐技术选型

## React example

```txt
React
Vite
TypeScript
@tanstack/react-router 或 react-router
Vitest
Testing Library
Playwright
```

我更推荐：

```txt
@tanstack/react-router
```

原因：

```txt
1. 类型安全更好。
2. 适合做路由化组件实验室。
3. 后续每个组件页能形成清晰 route tree。
4. 和现代生产应用更接近。
```

如果你想更通用、更少心智负担，也可以用：

```txt
react-router
```

我的建议：

```txt
React Showcase 用 @tanstack/react-router
Vue Showcase 用 vue-router
```

---

## Vue example

```txt
Vue 3
Vite
TypeScript
vue-router
Vitest
@vue/test-utils
Playwright
```

Vue 侧就用官方生态：

```txt
vue-router
```

---

# 路由结构设计

## React

```txt
examples/react-showcase/src/
  main.tsx
  router.tsx
  routeTree.gen.ts
  app/
    AppShell.tsx
    Sidebar.tsx
    Topbar.tsx
    SearchCommand.tsx
  routes/
    __root.tsx
    index.tsx
    components/
      index.tsx
      button.tsx
      input.tsx
      checkbox.tsx
      switch.tsx
      tabs.tsx
      dialog.tsx
      label.tsx
      textarea.tsx
      radio-group.tsx
      select.tsx
      card.tsx
      badge.tsx
      separator.tsx
      skeleton.tsx
      alert.tsx
      collapsible.tsx
      accordion.tsx
      tooltip.tsx
      progress.tsx
      avatar.tsx
    icons.tsx
    themes.tsx
    playground.tsx
  components/
    DemoSection.tsx
    DemoGrid.tsx
    EventLog.tsx
    PropTable.tsx
    StateMatrix.tsx
    ThemeTokenPreview.tsx
    IconPreview.tsx
```

## Vue

```txt
examples/vue-showcase/src/
  main.ts
  router.ts
  App.vue
  app/
    AppShell.vue
    Sidebar.vue
    Topbar.vue
  routes/
    Home.vue
    ComponentsIndex.vue
    components/
      ButtonPage.vue
      InputPage.vue
      CheckboxPage.vue
      SwitchPage.vue
      TabsPage.vue
      DialogPage.vue
      LabelPage.vue
      TextareaPage.vue
      RadioGroupPage.vue
      SelectPage.vue
      CardPage.vue
      BadgePage.vue
      SeparatorPage.vue
      SkeletonPage.vue
      AlertPage.vue
      CollapsiblePage.vue
      AccordionPage.vue
      TooltipPage.vue
      ProgressPage.vue
      AvatarPage.vue
    IconsPage.vue
    ThemesPage.vue
    PlaygroundPage.vue
  components/
    DemoSection.vue
    DemoGrid.vue
    EventLog.vue
    PropTable.vue
    StateMatrix.vue
    ThemeTokenPreview.vue
    IconPreview.vue
```

---

# 组件页标准模板

每个组件页必须长这样。

```txt
/components/button
```

页面结构：

```txt
Header
  - Component name
  - Package name
  - React import / Vue import
  - Web Component import

Sections
  1. Basic
  2. Variants
  3. Sizes
  4. Disabled / Loading / Error
  5. Controlled
  6. Uncontrolled
  7. Events
  8. With icons
  9. Theme tokens
  10. Accessibility notes
  11. Production pattern
```

例如 Button 页：

```txt
/components/button
  Basic
  Variants: default / primary / secondary / outline / ghost / danger
  Sizes: sm / md / lg / icon
  States: disabled / loading / focus-visible
  Events: press event log
  Icons: prefix / suffix / icon-only
  Production pattern: toolbar / form actions / destructive confirmation
```

Input 页：

```txt
/components/input
  Basic
  Types: text / email / password / search / number
  States: disabled / invalid / readonly
  Prefix/Suffix
  Controlled value
  Event log: value-change / focus-change
  Accessibility: label / aria-describedby / aria-errormessage
  Production pattern: search form / settings form
```

Tabs 页：

```txt
/components/tabs
  Horizontal
  Vertical
  Controlled active tab
  Disabled trigger
  Event log: value-change
  Production pattern: settings page
```

Dialog 页：

```txt
/components/dialog
  Basic dialog
  Controlled open
  Title / description
  Close button
  Form inside dialog
  Escape close
  Focus return
  Production pattern: create project modal
```

---

# Roadmap

## Phase 0：Showcase 设计收口

目标：先定规范，不写太多业务。

产物：

```txt
docs/internal/design/showcase-apps.md
examples/showcase-shared
```

要定义：

```txt
组件页模板
路由规范
测试规范
组件 metadata
theme metadata
icon metadata
```

验收：

```txt
文档明确 React/Vue showcase 的职责
每个组件都有 route 规划
overlay 明确 deferred
```

---

## Phase 1：Shared Metadata

目标：所有 route 和导航不要手写两份，React/Vue 共用一份数据。

新增：

```txt
examples/showcase-shared/src/components.ts
examples/showcase-shared/src/routes.ts
examples/showcase-shared/src/themes.ts
examples/showcase-shared/src/icons.ts
```

核心数据：

```ts
export const componentRoutes = [
  {
    name: 'button',
    path: '/components/button',
    group: 'Actions',
    packageName: '@zeus-web/button',
    status: 'ready',
  },
  {
    name: 'input',
    path: '/components/input',
    group: 'Forms',
    packageName: '@zeus-web/input',
    status: 'ready',
  },
]
```

验收：

```bash
pnpm --filter @zeus-web/example-showcase-shared check
```

---

## Phase 2：React Router App Shell

目标：React 侧先跑起来。

新增：

```txt
examples/react-showcase
```

包含：

```txt
AppShell
Sidebar
Topbar
Router
Home
ComponentsIndex
```

页面先只做：

```txt
/
 /components
 /components/button
 /components/input
 /icons
 /themes
 /playground
```

验收：

```bash
pnpm showcase:react
pnpm --filter @zeus-web/example-react-showcase build
```

---

## Phase 3：Vue Router App Shell

目标：Vue 侧和 React 侧路由结构对齐。

新增：

```txt
examples/vue-showcase
```

页面先只做：

```txt
/
 /components
 /components/button
 /components/input
 /icons
 /themes
 /playground
```

验收：

```bash
pnpm showcase:vue
pnpm --filter @zeus-web/example-vue-showcase build
```

---

## Phase 4：组件页模板抽象

目标：每个组件页结构统一，避免写成 20 个风格完全不同的页面。

React 抽象：

```txt
DemoPage
DemoSection
DemoGrid
StateMatrix
EventLog
PropTable
ThemeTokenPreview
```

Vue 抽象：

```txt
DemoPage.vue
DemoSection.vue
DemoGrid.vue
StateMatrix.vue
EventLog.vue
PropTable.vue
ThemeTokenPreview.vue
```

验收：

```txt
Button/Input 页面使用同一套模板
React/Vue 视觉结构一致
```

---

## Phase 5：P0 组件页完成

先做最核心、最常用的组件。

```txt
button
input
checkbox
switch
tabs
dialog
```

每个页面必须覆盖：

```txt
basic
variants / states
controlled
events
with icons
theme preview
production pattern
```

验收：

```bash
pnpm showcase:build
pnpm showcase:test
```

---

## Phase 6：Forms 组件页完成

```txt
label
textarea
radio-group
select
```

重点验证：

```txt
label association
aria-describedby
aria-errormessage
value-change
checked-change
controlled/uncontrolled
```

验收：

```bash
pnpm showcase:build
pnpm showcase:test
```

---

## Phase 7：Layout / Feedback 组件页完成

```txt
card
badge
separator
skeleton
alert
progress
avatar
```

重点验证：

```txt
theme tokens
sizes
semantic variants
loading states
fallback states
```

---

## Phase 8：Disclosure / Navigation 组件页完成

```txt
collapsible
accordion
tooltip
```

重点验证：

```txt
open state
controlled/uncontrolled
keyboard behavior
focus behavior
event log
```

---

## Phase 9：Icons Page

新增：

```txt
/icons
```

能力：

```txt
icon grid
search
category filter
copy React import
copy Vue import
copy WC import
copy raw svg import
size preview
currentColor preview
```

React 展示：

```tsx
import { IconCheck } from '@zeus-web/icons/react'
```

Vue 展示：

```vue
<script setup>
import { IconCheck } from '@zeus-web/icons/vue'
</script>
```

验收：

```txt
所有 recommended icons 可展示
搜索 check/menu/settings 生效
复制 import 生效
```

---

## Phase 10：Themes Page

新增：

```txt
/themes
```

能力：

```txt
default/slate/zinc/neutral/stone 切换
light/dark 切换
radius 切换
motion 切换
semantic token palette
component preview under current theme
```

展示 tokens：

```txt
background
foreground
primary
primary-foreground
muted
muted-foreground
border
input
ring
destructive
```

验收：

```txt
切换主题后所有组件视觉变化正常
dark mode 下文本对比度正常
```

---

## Phase 11：Playground Page

新增：

```txt
/playground
```

目的：模拟真实生产应用。

建议做 3 个真实场景：

```txt
1. Admin Dashboard
2. Settings Form
3. Project Create Flow
```

覆盖组合：

```txt
Card + Badge + Progress + Alert
Form + Label + Input + Select + Checkbox + Switch
Tabs + Accordion + Dialog + Tooltip
Icons + Theme tokens
```

验收：

```txt
一个页面能看出这套组件能不能做真实业务系统
```

---

## Phase 12：Unit Test

React：

```txt
@testing-library/react
@testing-library/user-event
```

Vue：

```txt
@vue/test-utils
```

每个组件页测试重点：

```txt
页面可渲染
关键 demo 存在
交互可触发
event log 更新
搜索/过滤生效
```

不是每个组件都写复杂测试，按页面维度：

```txt
button page
form controls page
dialog page
tabs page
icons page
themes page
```

验收：

```bash
pnpm showcase:test
```

---

## Phase 13：E2E Test

Playwright 覆盖：

```txt
React:
  首页可访问
  sidebar route 跳转
  button 页可访问
  input 页可输入
  dialog 可打开关闭
  theme 可切换
  icons 可搜索

Vue:
  首页可访问
  sidebar route 跳转
  button 页可访问
  input 页可输入
  dialog 可打开关闭
  theme 可切换
  icons 可搜索
```

验收：

```bash
pnpm showcase:e2e
```

---

## Phase 14：CI 接入

当前 CI 已经跑 `site:check`，后续加：

```bash
pnpm showcase:build
pnpm showcase:test
```

E2E 可以单独 job：

```bash
pnpm exec playwright install --with-deps chromium
pnpm showcase:e2e
```

建议 CI 分层：

```txt
PR 必跑:
  showcase:build
  showcase:test

main/nightly 跑:
  showcase:e2e
```

---

# 最终目标

做完后你会得到两个非常有价值的应用：

```txt
React Showcase
  验证 registry + zweb add + React styled 组件生产使用

Vue Showcase
  验证 @zeus-web/*/vue + themes + icons 生产使用
```

同时它们还能作为：

```txt
1. 组件文档预览
2. 回归测试应用
3. 发布前验收应用
4. 给用户看的真实示例
5. 后续 AI 生成 UI 的参考样本
```

---

# 推荐优先级

```txt
P0:
  Phase 0–5
  先跑通 shared metadata + router + app shell + button/input/checkbox/switch/tabs/dialog

P1:
  Phase 6–10
  补齐所有当前 registry 组件页 + icons + themes

P2:
  Phase 11–14
  playground + unit + e2e + CI
```

---

# 建议分支

```txt
feat/showcase-router-apps
```

# 建议 PR title

```txt
feat(examples): add router-based React and Vue showcase apps
```

# 最小 MVP 验收标准

第一版不需要所有细节都完美，但必须满足：

```txt
React 和 Vue 都有 router
每个当前 registry 组件都有独立 route
每个 route 至少有 basic/states/events/theme 四块
/icons 可以搜索 icon
/themes 可以切换主题
/showcase:build 能通过
/showcase:test 能通过
```

这就是你设想的“一个页面一组组件，测试所有组件能力”的正确落地路线。
