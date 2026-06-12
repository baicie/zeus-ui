# Usage Modes

Zeus Web has three product usage modes.

## 1. CLI registry source

Use this for React and Vue applications.

The CLI copies editable source into your project.

```bash
pnpm dlx @zeus-web/cli init
pnpm dlx @zeus-web/cli add button input
```

Generated files:

```txt
zeus-ui.json
zeus-ui.lock.json
src/lib/cn.ts
src/styles/zeus.css
src/components/ui/button.tsx
src/components/ui/input.tsx
```

Vue projects receive `.vue` component files:

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

Use this mode when:

- you want shadcn-like ownership of component source
- you are building a React or Vue app
- you want to customize generated components
- you want AI tools to inspect local component source

## 2. Native styled Web Components

Use this for no-framework or framework-neutral surfaces.

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

Use this mode when:

- you do not want React or Vue wrappers
- you need styled custom elements
- you are building static pages or micro-frontends
- you want package-owned styling

Per-component entries are also available:

```ts
import '@zeus-web/ui/button'
import '@zeus-web/ui/input'
```

## 3. Advanced primitives

Use this when you want behavior primitives and will own the styling layer.

```bash
pnpm add @zeus-web/button
```

React:

```tsx
import { Button } from '@zeus-web/button/react'
```

Vue:

```ts
import { Button } from '@zeus-web/button/vue'
```

Native primitive:

```ts
import '@zeus-web/button/wc'
```

Use this mode when:

- you are building a design system
- you need low-level primitives
- you do not want registry-generated source
- you do not want package-owned styled UI

## Decision table

| Requirement                    | Recommended mode             |
| ------------------------------ | ---------------------------- |
| React app with editable source | CLI registry source          |
| Vue app with editable source   | CLI registry source          |
| No-framework app               | Native styled Web Components |
| Static HTML / micro-frontend   | Native styled Web Components |
| Custom design system           | Advanced primitives          |
| Package-owned styles           | Native styled Web Components |
| App-owned styles               | CLI registry source          |
| Headless behavior only         | Advanced primitives          |
