# Zeus-UI Showcase Registry Usage

## Status

Phase 20 design.

This document defines how React and Vue showcase consume registry-installed styled components.

## Goal

The React and Vue showcase should demonstrate the recommended application usage path.

Before Phase 20, the button and input demo pages imported primitive wrappers directly:

```tsx
import { Button } from '@zeus-web/button/react'
import { Input } from '@zeus-web/input/react'
```

After Phase 20, showcase imports local registry-synced components:

```tsx
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
```

Vue uses:

```ts
import Button from '@/components/ui/button.vue'
import Input from '@/components/ui/input.vue'
```

## Why only button and input?

Phase 17 registry only contains styled templates for:

```txt
button
input
```

Therefore Phase 20 only switches those two demos.

Other showcase component demos continue to use primitive wrappers until their registry templates exist.

## Sync model

Registry templates remain the source of truth.

The sync command is:

```bash
pnpm showcase:registry:sync
```

The check command is:

```bash
pnpm showcase:registry:check
```

The sync command writes:

```txt
examples/react-showcase/src/lib/cn.ts
examples/react-showcase/src/styles/zeus.css
examples/react-showcase/src/components/ui/button.tsx
examples/react-showcase/src/components/ui/input.tsx

examples/vue-showcase/src/lib/cn.ts
examples/vue-showcase/src/styles/zeus.css
examples/vue-showcase/src/components/ui/button.vue
examples/vue-showcase/src/components/ui/input.vue
```

It also writes:

```txt
examples/react-showcase/zeus-ui.json
examples/react-showcase/zeus-ui.lock.json
examples/vue-showcase/zeus-ui.json
examples/vue-showcase/zeus-ui.lock.json
```

## Drift prevention

The CI check must fail if generated files drift from registry templates.

```bash
pnpm check:showcase-registry
pnpm showcase:registry:check
```

## Non-goals

Phase 20 does not:

- add native showcase
- add more registry components
- rewrite every showcase demo
- implement CLI update
- implement CLI diff
- implement remote registry

## Next phase

Phase 21 should add a native showcase for:

```ts
import '@zeus-web/ui/styles.css'
import '@zeus-web/ui/button'
import '@zeus-web/ui/input'
```
