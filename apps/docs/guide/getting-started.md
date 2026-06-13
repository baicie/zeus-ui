# Getting Started

Zeus Web supports three usage paths:

<div class="zw-grid">
  <div class="zw-card">
    <h3>CLI registry source</h3>
    <p>Copy editable React or Vue source into your app with <code>zweb init</code> and <code>zweb add</code>.</p>
  </div>
  <div class="zw-card">
    <h3>Native styled Web Components</h3>
    <p>Use <code>@zeus-web/ui</code> when you want styled custom elements without React or Vue.</p>
  </div>
  <div class="zw-card">
    <h3>Advanced primitives</h3>
    <p>Install per-component primitives when building your own design system.</p>
  </div>
</div>

## React or Vue app

Initialize the project:

```bash
pnpm dlx @zeus-web/cli init
```

This creates:

```txt
zeus-ui.json
src/lib/cn.ts
src/styles/zeus.css
```

Add components:

```bash
pnpm dlx @zeus-web/cli add button input
```

This copies React files into your project:

```txt
src/components/ui/button.tsx
src/components/ui/input.tsx
```

For Vue projects, the CLI copies:

```txt
src/components/ui/button.vue
src/components/ui/input.vue
```

## React usage

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

## Vue usage

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

## Native styled Web Components

Install:

```bash
pnpm add @zeus-web/ui
```

Import the aggregate entry:

```ts
import '@zeus-web/ui'
```

Use custom elements:

```html
<zw-button variant="primary">Save</zw-button>
<zw-input placeholder="Email"></zw-input>
```

Per-component imports:

```ts
import '@zeus-web/ui/button'
import '@zeus-web/ui/input'
```

## Advanced primitive usage

Install a primitive:

```bash
pnpm add @zeus-web/button
```

React wrapper:

```tsx
import { Button } from '@zeus-web/button/react'

export function Example() {
  return <Button>Save</Button>
}
```

Vue wrapper:

```vue
<script setup lang="ts">
import { Button } from '@zeus-web/button/vue'
</script>

<template>
  <Button>Save</Button>
</template>
```

Native primitive:

```ts
import '@zeus-web/button/wc'
```

```html
<zw-button>Save</zw-button>
```

## Next

- Learn the three usage modes in [Usage Modes](/guide/usage-modes).
- Learn CLI options in [CLI](/guide/cli).
- Learn source registry internals in [Registry](/guide/registry).
- Learn native usage in [Native Web Components](/examples/native-wc).
