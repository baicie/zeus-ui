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

## Registry manifest schema

`registry.json` uses `schemaVersion: 2`. A valid manifest declares provenance:

```json
{
  "schemaVersion": 2,
  "name": "@zeus-web/registry",
  "version": "1.0.0",
  "license": "MIT",
  "authors": [
    {
      "name": "Zeus Web Contributors",
      "url": "https://github.com/baicie/zeus-ui"
    }
  ],
  "items": []
}
```

`schemaVersion: 1` is rejected without a silent migration path.

Validate any registry manifest, including a third-party one:

```bash
zweb registry validate
zweb registry validate ./registry.json --json
```

## Publishing a third-party component package

Copying source with `zweb add` and publishing a custom element package are two
different products, not two implementations of the same thing:

| Mode                       | What ships                                | Owner              | Upgrade                              |
| -------------------------- | ----------------------------------------- | ------------------ | ------------------------------------ |
| Registry source copy       | `.tsx` / `.vue` templates                 | your app           | `zweb update`, local edits preserved |
| **Custom element package** | `dist/wc/*`, CEM, DTS, React/Vue wrappers | the package author | bump the package version             |

`zweb add` never produces a custom element. A CE package is built with
`@zeus-js/bundler-plugin` and `@zeus-js/output-wc` in the author's own
repository, then published to npm.

Third-party packages must declare a stable publish shape: `exports` for the WC
entry, `./wc/auto`, `./custom-elements.json`, `./zeus.components.json`, plus
`./react` and `./vue` wrappers; `files: ["dist"]`; and an exact
`@zeus-js/zeus` peer pin. Validate before publishing:

```bash
zweb author check
zweb author check ./dist-package --json
```

`zweb author check` reports diagnostics as `{ code, path, message }` and fails
on a consumer Zeus version that does not match the peer pin.

See `docs/internal/authoring-sdk.md` in the repository for the full contract,
diagnostic codes, plugin metadata and security notes.
