# Icons

Zeus Web provides a multi-framework icon package.

## Install

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

## Raw SVG

```ts
import checkIcon from '@zeus-web/icons/svg/check.svg'
```

## CLI

```bash
zweb icon list
zweb icon search check
zweb icon show check
```

## AI usage rules

- Use `@zeus-web/icons/react` in React examples.
- Use `@zeus-web/icons/vue` in Vue examples.
- Use `@zeus-web/icons/wc` in native Web Component examples.
- Use `aria-hidden` for decorative icons.
- For icon-only buttons, put the accessible name on the button.
