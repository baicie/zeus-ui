# 图标

Zeus Web 提供多框架图标包。

## 安装

```bash
pnpm add @zeus-web/icons
```

## React

```tsx
import { IconCheck, IconSearch } from '@zeus-web/icons/react'

export function Example() {
  return (
    <button aria-label="Search">
      <IconSearch aria-hidden />
    </button>
  )
}
```

## Vue

```vue
<script setup lang="ts">
import { IconCheck } from '@zeus-web/icons/vue'
</script>

<template>
  <IconCheck aria-hidden="true" />
</template>
```

## Web Component

```ts
import '@zeus-web/icons/wc'
```

```html
<zw-icon-check aria-hidden="true"></zw-icon-check>
```

## 原始 SVG

```ts
import checkIcon from '@zeus-web/icons/svg/check.svg'
```

## CLI

```bash
zweb icon list
zweb icon search check
zweb icon show check
```

## AI 使用规则

- 在 React 示例中使用 `@zeus-web/icons/react`。
- 在 Vue 示例中使用 `@zeus-web/icons/vue`。
- 在原生 Web Component 示例中使用 `@zeus-web/icons/wc`。
- 装饰性图标使用 `aria-hidden`。
- 只有图标的按钮应把无障碍名称放在按钮上。
