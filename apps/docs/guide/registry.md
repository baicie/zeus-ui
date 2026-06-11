# Registry

The registry package is `@zeus-web/registry`.

It contains shadcn-like component source files under:

```txt
packages/registry/default
```

The CLI reads:

```txt
@zeus-web/registry/registry.json
```

and copies files into your project according to `components.json`.

## Why copy source?

Registry components are meant to be owned by your app. You can edit the generated files after running `zweb add`.

## Per-component primitives

Registry source imports per-component wrapper entries.

```tsx
import { Button as ButtonPrimitive } from '@zeus-web/button/react'
```

Do not import from `@zeus-web/react` in registry source unless you intentionally want the aggregate wrapper package.

## Local imports

Generated components import local utilities:

```tsx
import { cn } from '@/lib/utils'
```

The CLI rewrites this according to `components.json` aliases.

## Registry item shape

```json
{
  "name": "button",
  "type": "registry:ui",
  "dependencies": ["@zeus-web/button"],
  "files": [
    {
      "path": "default/button.tsx",
      "target": "components/ui/button.tsx",
      "type": "registry:ui"
    }
  ]
}
```
