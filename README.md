# Zeus Web

Zeus Web is a framework-neutral UI system built on Web Components, source registry templates and package-owned styled native entries.

It supports three usage paths:

1. **CLI registry source** for React and Vue applications.
2. **Native styled Web Components** through `@zeus-web/ui`.
3. **Advanced primitives** through per-component packages.

## Recommended path: CLI registry source

Use this when you are building a React or Vue app and want editable source components in your project.

```bash
pnpm dlx @zeus-web/cli init
pnpm dlx @zeus-web/cli add button input
```

This creates:

```txt
zeus-ui.json
zeus-ui.lock.json
src/lib/cn.ts
src/styles/zeus.css
src/components/ui/button.tsx
src/components/ui/input.tsx
```

For Vue projects, generated component files use `.vue`:

```txt
src/components/ui/button.vue
src/components/ui/input.vue
```

Use the generated components:

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

Vue:

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

Use this when you want styled Web Components without React or Vue.

```bash
pnpm add @zeus-web/ui
```

Aggregate entry:

```ts
import '@zeus-web/ui'
```

HTML:

```html
<zw-button variant="primary">Save</zw-button>
<zw-input placeholder="Email"></zw-input>
```

Per-component entries:

```ts
import '@zeus-web/ui/button'
import '@zeus-web/ui/input'
```

CSS-only entry:

```ts
import '@zeus-web/ui/styles.css'
import '@zeus-web/button/wc'
import '@zeus-web/input/wc'
```

## Advanced primitive usage

Use this when you are building your own design system on top of headless primitives.

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

Native Web Component primitive:

```ts
import '@zeus-web/button/wc'
```

```html
<zw-button>Save</zw-button>
```

## Advanced component workspace

Product-level advanced components live in `packages/advanced/*`.

This workspace is reserved for high-performance and high-complexity components such as:

```txt
@zeus-web/virtual
@zeus-web/chat
@zeus-web/revogrid
@zeus-web/data-grid
@zeus-web/agent-console
```

Advanced components are headless-first. They own behavior, state, events, methods, accessibility and performance contracts. Final product styles are layered through `packages/registry` and `packages/ui`.

See the detailed design and roadmap:

```txt
docs/design/zeus-ui-advanced-components.md
```

## Package map

| Package              | Purpose                                                 |
| -------------------- | ------------------------------------------------------- |
| `@zeus-web/cli`      | `zweb init`, `zweb add`, AI metadata and icon commands. |
| `@zeus-web/registry` | Source templates consumed by the CLI.                   |
| `@zeus-web/ui`       | Package-owned styled native Web Components.             |
| `@zeus-web/themes`   | Design tokens and component-level CSS variables.        |
| `@zeus-web/icons`    | Icon assets and generated wrappers.                     |
| `@zeus-web/button`   | Headless button primitive with WC/React/Vue entries.    |
| `@zeus-web/input`    | Headless input primitive with WC/React/Vue entries.     |
| `@zeus-web/virtual`  | Planned advanced virtual scrolling foundation.          |
| `@zeus-web/chat`     | Planned ChatGPT-style headless chat component family.   |
| `@zeus-web/data-grid` | Planned high-performance headless data grid.           |

## Local development

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

## Release validation

```bash
pnpm release:verify --allow-zero
```
