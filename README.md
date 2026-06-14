# Zeus Web

Zeus Web 是一个框架无关的 UI 系统，基于 Web Components、源码 registry 模板，以及包内自带样式的原生组件入口构建。

它支持三种使用路径：

1. **CLI registry source**：面向 React 和 Vue 应用，复制可编辑源码到项目中。
2. **Native styled Web Components**：通过 `@zeus-web/ui` 使用无框架带样式 Web Components。
3. **Advanced primitives**：通过按组件拆分的包使用高级 headless 能力。

## 推荐路径：CLI registry source

当你在构建 React 或 Vue 应用，并希望把可编辑组件源码放进自己的项目时，推荐使用这个路径。

```bash
pnpm dlx @zeus-web/cli init
pnpm dlx @zeus-web/cli add button input
```

这会生成：

```txt
zeus-ui.json
zeus-ui.lock.json
src/lib/cn.ts
src/styles/zeus.css
src/components/ui/button.tsx
src/components/ui/input.tsx
```

Vue 项目中生成的组件文件使用 `.vue`：

```txt
src/components/ui/button.vue
src/components/ui/input.vue
```

React 使用示例：

```tsx
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function Example() {
  return (
    <form className="space-y-4">
      <Input type="email" placeholder="Email" />
      <Button variant="primary">Submit</Button>
    </form>
  )
}
```

Vue 使用示例：

```vue
<script setup lang="ts">
import Button from '@/components/ui/button.vue'
import Input from '@/components/ui/input.vue'
</script>

<template>
  <form class="space-y-4">
    <Input placeholder="Email" />
    <Button variant="primary">Submit</Button>
  </form>
</template>
```

## 原生带样式 Web Components

当你不想使用 React 或 Vue，但希望直接获得带样式 Web Components 时，使用这个路径。

```bash
pnpm add @zeus-web/ui
```

聚合入口：

```ts
import '@zeus-web/ui'
```

HTML：

```html
<zw-button variant="primary">Save</zw-button>
<zw-input placeholder="Email"></zw-input>
```

按组件入口：

```ts
import '@zeus-web/ui/button'
import '@zeus-web/ui/input'
```

仅 CSS 入口：

```ts
import '@zeus-web/ui/styles.css'
import '@zeus-web/button/wc'
import '@zeus-web/input/wc'
```

## Advanced primitive 用法

当你要基于 headless primitives 构建自己的设计系统时，使用这个路径。

```bash
pnpm add @zeus-web/button
```

React wrapper：

```tsx
import { Button } from '@zeus-web/button/react'

export function Example() {
  return <Button>Save</Button>
}
```

Vue wrapper：

```vue
<script setup lang="ts">
import { Button } from '@zeus-web/button/vue'
</script>

<template>
  <Button>Save</Button>
</template>
```

原生 Web Component primitive：

```ts
import '@zeus-web/button/wc'
```

```html
<zw-button>Save</zw-button>
```

## 高级组件工作区

产品级高级组件放在 `packages/advanced/*`。

这个工作区专门用于高性能、高复杂度组件，例如：

```txt
@zeus-web/virtual
@zeus-web/chat
@zeus-web/revogrid
@zeus-web/data-grid
@zeus-web/agent-console
```

高级组件坚持 headless-first。它们负责行为、状态、事件、方法、可访问性与性能契约；最终产品样式通过 `packages/registry` 和 `packages/ui` 分层提供。

详细设计与路线图见：

```txt
docs/design/zeus-ui-advanced-components.md
```

## 包地图

| Package               | 用途                                               |
| --------------------- | -------------------------------------------------- |
| `@zeus-web/cli`       | `zweb init`、`zweb add`、AI metadata、icon 命令。  |
| `@zeus-web/registry`  | CLI 使用的源码模板 registry。                      |
| `@zeus-web/ui`        | 包内自带样式的原生 Web Components。                |
| `@zeus-web/themes`    | 设计 token 与组件级 CSS 变量。                     |
| `@zeus-web/icons`     | 图标资源与生成的 wrapper。                         |
| `@zeus-web/button`    | 带 WC/React/Vue 入口的 headless button primitive。 |
| `@zeus-web/input`     | 带 WC/React/Vue 入口的 headless input primitive。  |
| `@zeus-web/virtual`   | 规划中的高级虚拟滚动基础设施。                     |
| `@zeus-web/chat`      | 规划中的 ChatGPT 风格 headless chat 组件族。       |
| `@zeus-web/data-grid` | 规划中的高性能 headless data grid。                |

## 本地开发

```bash
pnpm install
pnpm build
pnpm check
pnpm lint
pnpm test
pnpm site:check
pnpm showcase:ci
```

## Showcase

```bash
pnpm showcase:react
pnpm showcase:vue
pnpm showcase:native
```

## Release 校验

```bash
pnpm release:verify --allow-zero
```
