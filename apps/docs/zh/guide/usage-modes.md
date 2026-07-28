# 使用模式

Zeus Web 提供三种产品使用模式。

## 1. CLI Registry 源码

适用于 React 和 Vue 应用。

CLI 会将可编辑的源码复制到你的项目中。

```bash
pnpm dlx @zeus-web/cli init
pnpm dlx @zeus-web/cli add button input
```

生成的文件：

```txt
zeus-ui.json
zeus-ui.lock.json
src/lib/cn.ts
src/styles/zeus.css
src/components/ui/button.tsx
src/components/ui/input.tsx
```

Vue 项目会获得 `.vue` 组件文件：

```txt
src/components/ui/button.vue
src/components/ui/input.vue
```

```vue
<script setup lang="ts">
import Button from '@/components/ui/button.vue'
import Input from '@/components/ui/input.vue'
</script>
```

适合在以下情况使用：

- 你希望像 shadcn 一样拥有组件源码
- 你正在构建 React 或 Vue 应用
- 你希望自定义生成的组件
- 你希望 AI 工具能够检查本地组件源码

## 2. 原生带样式 Web Components

适用于无框架或框架中立的界面。

```bash
pnpm add @zeus-web/ui
```

```ts
import '@zeus-web/ui'
```

```html
<zw-button variant="primary">Save</zw-button>
<zw-input placeholder="Email"></zw-input>
```

适合在以下情况使用：

- 你不希望使用 React 或 Vue wrappers
- 你需要带样式的自定义元素
- 你正在构建静态页面或微前端
- 你希望样式由包管理

也可以使用按组件拆分的入口：

```ts
import '@zeus-web/ui/button'
import '@zeus-web/ui/input'
```

## 3. 高级 Primitives

如果你希望使用行为 primitives 并自行管理样式层，请选择此模式。

```bash
pnpm add @zeus-web/button
```

React：

```tsx
import { Button } from '@zeus-web/button/react'
```

Vue：

```ts
import { Button } from '@zeus-web/button/vue'
```

原生 primitive：

```ts
import '@zeus-web/button/wc/auto'
```

适合在以下情况使用：

- 你正在构建设计系统
- 你需要低层 primitives
- 你不希望使用 Registry 生成的源码
- 你不希望使用包管理的带样式 UI

## 决策表

| 需求                        | 推荐模式                  |
| --------------------------- | ------------------------- |
| 使用可编辑源码的 React 应用 | CLI Registry 源码         |
| 使用可编辑源码的 Vue 应用   | CLI Registry 源码         |
| 无框架应用                  | 原生带样式 Web Components |
| 静态 HTML / 微前端          | 原生带样式 Web Components |
| 自定义设计系统              | 高级 Primitives           |
| 包管理的样式                | 原生带样式 Web Components |
| 应用管理的样式              | CLI Registry 源码         |
| 仅需要 Headless 行为        | 高级 Primitives           |
