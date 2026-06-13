# Zeus-UI Public Docs Rewrite

## Status

Phase 22 design.

This document defines the public documentation rewrite after the CLI registry, native styled Web-C and primitive usage paths became stable.

## Goal

Public docs must explain three usage paths:

1. CLI registry source for React and Vue applications.
2. Native styled Web Components through `@zeus-web/ui`.
3. Advanced primitive packages for custom design systems.

## Why this phase exists

Earlier docs still referenced older ideas:

- `components.json`
- `src/styles/globals.css`
- `src/lib/utils.ts`
- aggregate `@zeus-web/react`
- aggregate `@zeus-web/vue`
- aggregate `@zeus-web/headless`
- old registry item shapes such as `registry:ui`

Those names no longer describe the current implementation.

## Public entry points

### React/Vue recommended path

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

### Native styled Web-C path

```ts
import '@zeus-web/ui'
```

```html
<zw-button variant="primary">Save</zw-button>
<zw-input placeholder="Email"></zw-input>
```

### Advanced primitive path

```ts
import '@zeus-web/button/wc'
import { Button } from '@zeus-web/button/react'
import { Button } from '@zeus-web/button/vue'
```

## Files updated

```txt
README.md
apps/docs/index.md
apps/docs/guide/getting-started.md
apps/docs/guide/usage-modes.md
apps/docs/guide/cli.md
apps/docs/guide/registry.md
apps/docs/guide/theming.md
apps/docs/examples/native-wc.md
apps/docs/.vitepress/data/site.ts
scripts/checks/check-docs.ts
scripts/checks/check-public-docs.ts
```

## Validation

```bash
pnpm check:public-docs
pnpm docs:check
pnpm docs:build
pnpm site:check
```

## Non-goals

Phase 22 does not change runtime packages, CLI behavior, registry templates or showcase examples.

## Next phase

Phase 23 should implement CLI update and diff support for registry-installed components.
