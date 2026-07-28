# 开始使用

Zeus Web 支持三种使用路径：

<div class="zw-grid">
  <div class="zw-card">
    <h3>CLI Registry 源码</h3>
    <p>使用 <code>zweb init</code> 和 <code>zweb add</code>，将可编辑的 React 或 Vue 源码复制到你的应用中。</p>
  </div>
  <div class="zw-card">
    <h3>原生带样式 Web Components</h3>
    <p>如果你希望不依赖 React 或 Vue 直接使用带样式的自定义元素，请使用 <code>@zeus-web/ui</code>。</p>
  </div>
  <div class="zw-card">
    <h3>高级 Primitives</h3>
    <p>构建自己的设计系统时，安装按组件拆分的 primitives。</p>
  </div>
</div>

## React 或 Vue 应用

初始化项目：

```bash
pnpm dlx @zeus-web/cli init
```

这会创建：

```txt
zeus-ui.json
src/lib/cn.ts
src/styles/zeus.css
```

添加组件：

```bash
pnpm dlx @zeus-web/cli add button input
```

这会将 React 文件复制到你的项目中：

```txt
src/components/ui/button.tsx
src/components/ui/input.tsx
```

对于 Vue 项目，CLI 会复制：

```txt
src/components/ui/button.vue
src/components/ui/input.vue
```

## React 用法

```tsx
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function Example() {
  return (
    <form className="space-y-4">
      <Input placeholder="Email" type="email" />
      <Button variant="primary">Submit</Button>
    </form>
  )
}
```

## Vue 用法

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

安装：

```bash
pnpm add @zeus-web/ui
```

导入聚合入口：

```ts
import '@zeus-web/ui'
```

使用自定义元素：

```html
<zw-button variant="primary">Save</zw-button>
<zw-input placeholder="Email"></zw-input>
```

按组件导入：

```ts
import '@zeus-web/ui/button'
import '@zeus-web/ui/input'
```

## 高级 Primitive 用法

安装一个 primitive：

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

原生 primitive：

```ts
import '@zeus-web/button/wc/auto'
```

```html
<zw-button>Save</zw-button>
```

## 下一步

- 在 [使用模式](/zh/guide/usage-modes) 中了解三种使用模式。
- 在 [CLI](/zh/guide/cli) 中了解 CLI 选项。
- 在 [Registry](/zh/guide/registry) 中了解源码 Registry 的内部机制。
- 在 [原生 Web Components](/zh/examples/native-wc) 中了解原生用法。
