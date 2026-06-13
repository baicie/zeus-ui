# Zeus-UI Product Layers

## Status

Phase 15 design contract.

This document defines the product layers of Zeus-UI after the MVP showcase work.

The goal is to prevent the project from collapsing primitive components, styled native Web Components, React / Vue source components and CLI installation into one ambiguous package.

## Final layering

```txt
Zeus
  -> compiler
  -> runtime
  -> Web-C output
  -> React / Vue wrapper output
  -> lazy registration

Zeus-UI primitives
  -> headless behavior
  -> accessibility states
  -> events
  -> stable data attributes
  -> stable part names
  -> Web-C / React / Vue primitive wrappers

Zeus-UI themes
  -> CSS variables
  -> semantic tokens
  -> theme presets
  -> native CSS consumption
  -> Tailwind token consumption

Zeus-UI native styled Web-C
  -> @zeus-web/ui
  -> styled Web Component distribution
  -> ready-to-use native HTML / micro frontend usage

Zeus-UI registry
  -> React source templates
  -> Vue source templates
  -> CSS globals
  -> cn utility
  -> component metadata

Zeus-UI CLI
  -> init
  -> add
  -> update
  -> diff
  -> install registry files into user projects

Showcase
  -> verifies real usage
  -> React / Vue showcase should eventually consume registry-installed styled components
  -> Native showcase should consume @zeus-web/ui
```

## Layer 1: Zeus

Zeus is the infrastructure layer.

It owns:

- compiler
- runtime
- Web-C output
- React wrapper output
- Vue wrapper output
- lazy registration
- component analyzer
- dts generation

Zeus must not own Zeus-UI product styles.

## Layer 2: primitives

Primitive packages are headless behavior packages.

Examples:

```txt
@zeus-web/button
@zeus-web/input
@zeus-web/dialog
@zeus-web/select
```

Primitive packages may expose:

```txt
@zeus-web/button/wc
@zeus-web/button/react
@zeus-web/button/vue
```

Primitive packages should provide:

- behavior
- accessibility attributes
- keyboard interaction
- stable events
- stable attributes
- stable `data-slot`
- stable `data-state`
- stable `data-variant`
- stable `data-size`
- stable `part`

Primitive packages should not provide:

- full product visual design
- Tailwind-based final styles
- theme preset ownership
- shadcn-like source ownership

A primitive package may include only minimal reset styles when needed, for example:

```css
:host {
  display: inline-block;
}

button,
input {
  font: inherit;
}
```

It should not include final visual styles such as primary backgrounds, radius systems, hover colors, dark mode or product spacing.

## Layer 3: themes

The theme package owns design tokens.

Example package:

```txt
@zeus-web/themes
```

It should provide:

- token CSS files
- theme preset CSS files
- semantic CSS variables
- optional helper metadata

It should not own framework-specific component wrappers.

Tokens should be framework-agnostic:

```css
:root {
  --zeus-primary: 222 47% 11%;
  --zeus-primary-foreground: 210 40% 98%;
  --zeus-radius-md: 0.375rem;
}
```

Tailwind should consume tokens.

Native CSS should also consume tokens.

## Layer 4: native styled Web-C

Native styled Web-C is the default styled entry for native HTML, micro frontend and no-framework usage.

Example package:

```txt
@zeus-web/ui
```

Native styled Web-C should provide:

```txt
@zeus-web/ui/styles.css
@zeus-web/ui/button
@zeus-web/ui/button.css
@zeus-web/ui/input
@zeus-web/ui/input.css
```

Usage:

```ts
import '@zeus-web/ui/styles.css'
import '@zeus-web/ui/button'
import '@zeus-web/ui/input'
```

```html
<zw-button variant="primary">Save</zw-button>
<zw-input placeholder="Email"></zw-input>
```

This usage must be styled by default.

Native styled Web-C must not reimplement behavior. It should compose primitive Web-C packages and CSS.

## Layer 5: registry

The registry is the shadcn-like source template layer.

It should provide:

- React component templates
- Vue component templates
- CSS globals
- utility templates
- metadata
- dependency declarations

The registry is not the runtime package consumed directly by applications.

The registry is consumed by the CLI.

Example future structure:

```txt
packages/registry/
  registry.json
  react/button.tsx
  vue/button.vue
  css/globals.css
  lib/cn.ts
```

## Layer 6: CLI

The CLI is the recommended React / Vue user entry.

Commands:

```bash
zeus-web init
zeus-web add button input dialog
zeus-web diff button
zeus-web update button
```

The CLI should install source files into the user project.

React / Vue users should not be required to import primitive wrappers directly for normal product usage.

Recommended React usage:

```tsx
import { Button } from '@/components/ui/button'
```

Recommended Vue usage:

```vue
<script setup lang="ts">
import Button from '@/components/ui/button.vue'
</script>
```

## Layer 7: showcase

The showcase verifies usage models.

Current showcase verifies primitives and foundation pages.

Future showcase should verify:

- React registry-installed styled usage
- Vue registry-installed styled usage
- native styled Web-C usage
- primitive advanced usage only as a secondary path

## Public entry policy

Recommended public entries:

| User type                 | Entry                             | Styled by default | Source owned by user |
| ------------------------- | --------------------------------- | ----------------- | -------------------- |
| React application         | `zeus-web add button`             | Yes               | Yes                  |
| Vue application           | `zeus-web add button`             | Yes               | Yes                  |
| Native Web Component user | `@zeus-web/ui/button`             | Yes               | No                   |
| Design system author      | `@zeus-web/button/react` or `/wc` | No                | No                   |

## Non-goals

Phase 15 does not implement:

- `@zeus-web/ui`
- `@zeus-web/registry`
- `@zeus-web/cli`
- native showcase
- registry showcase sync

Those belong to later phases.

## Decisions

1. Keep primitives headless.
2. Add styled native Web-C as a separate `@zeus-web/ui` layer later.
3. Add React / Vue source registry as a separate layer later.
4. Use CLI as the recommended React / Vue product entry later.
5. Do not make primitive packages the default styled user experience.
