# Registry

The registry package is `@zeus-web/registry`.

It contains source templates consumed by `zweb add`.

## Source of truth

Registry metadata is stored in:

```txt
packages/registry/registry.json
```

Templates are stored under:

```txt
packages/registry/templates
```

Current Phase 22 registry items:

```txt
cn
globals
button
input
```

## Why copy source?

Registry components are meant to be owned by your app.

After running:

```bash
zweb add button
```

you can edit:

```txt
src/components/ui/button.tsx
```

or, in Vue projects:

```txt
src/components/ui/button.vue
```

## Registry dependencies

Components may depend on other registry items.

For example, `button` depends on:

```txt
cn
globals
```

So:

```bash
zweb add button
```

writes:

```txt
src/lib/cn.ts
src/styles/zeus.css
src/components/ui/button.tsx
```

Vue projects receive:

```txt
src/components/ui/button.vue
```

## Framework filtering

Registry items may contain both React and Vue templates.

The CLI reads `zeus-ui.json` and only copies files matching the configured framework.

React projects receive `.tsx` files.

Vue projects receive `.vue` files.

## Per-component primitives

Registry source imports per-component primitive wrappers.

React:

```tsx
import { Button as ButtonPrimitive } from '@zeus-web/button/react'
```

Vue:

```ts
import { Button as ButtonPrimitive } from '@zeus-web/button/vue'
```

The registry should not import from aggregate framework packages.

## Local imports

Generated components import local utilities:

```tsx
import { cn } from '@/lib/cn'
```

The CLI rewrites this according to `zeus-ui.json` aliases.

## Registry item shape

```json
{
  "name": "button",
  "type": "component",
  "description": "Styled button component built on top of @zeus-web/button primitives.",
  "frameworks": ["react", "vue"],
  "dependencies": ["@zeus-web/button"],
  "registryDependencies": ["cn", "globals"],
  "files": [
    {
      "framework": "react",
      "source": "templates/react/button.tsx",
      "target": "components/ui/button.tsx"
    },
    {
      "framework": "vue",
      "source": "templates/vue/button.vue",
      "target": "components/ui/button.vue"
    }
  ]
}
```

## Registry vs native package

The registry copies app-owned source.

`@zeus-web/ui` provides package-owned styled native Web Components.

Use registry source for React/Vue app customization.

Use `@zeus-web/ui` for no-framework styled custom elements.
