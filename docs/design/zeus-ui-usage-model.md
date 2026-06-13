# Zeus-UI Usage Model

## Status

Phase 15 design contract.

This document defines the intended usage model for Zeus-UI.

## Summary

Zeus-UI supports three official usage paths:

```txt
1. React / Vue application usage
   -> use CLI
   -> source components installed into the project

2. Native Web Component usage
   -> use @zeus-web/ui
   -> styled Web Components

3. Advanced primitive usage
   -> use @zeus-web/<component>
   -> headless behavior and wrappers
```

The default user experience should not be headless.

## React usage

Recommended future usage:

```bash
pnpm dlx zeus-web init
pnpm dlx zeus-web add button input dialog
```

Application code:

```tsx
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function LoginForm() {
  return (
    <form>
      <Input placeholder="Email" />
      <Button variant="primary">Sign in</Button>
    </form>
  )
}
```

The installed source component may internally use primitive wrappers:

```tsx
import { Button as ButtonPrimitive } from '@zeus-web/button/react'
```

But the application should import from its local `components/ui` path.

## Vue usage

Recommended future usage:

```bash
pnpm dlx zeus-web init
pnpm dlx zeus-web add button input dialog
```

Application code:

```vue
<script setup lang="ts">
import Button from '@/components/ui/button.vue'
import Input from '@/components/ui/input.vue'
</script>

<template>
  <form>
    <Input placeholder="Email" />
    <Button variant="primary">Sign in</Button>
  </form>
</template>
```

## Native Web Component usage

Recommended future usage:

```bash
pnpm add @zeus-web/ui
```

Application code:

```ts
import '@zeus-web/ui/styles.css'
import '@zeus-web/ui/button'
import '@zeus-web/ui/input'
```

HTML:

```html
<zw-input placeholder="Email"></zw-input>
<zw-button variant="primary">Sign in</zw-button>
```

Native usage must be styled by default.

## Advanced primitive usage

Advanced users may import primitives directly.

```ts
import '@zeus-web/button/wc'
```

```html
<zw-button>Custom styled button</zw-button>
```

or:

```tsx
import { Button } from '@zeus-web/button/react'
```

This path is for:

- design system authors
- users who want full style ownership
- users who do not want Zeus-UI product styles
- integration tests
- low-level wrapper validation

Primitive usage is not the recommended application-level styled path.

## Styling model

### React / Vue

React / Vue styled components are installed as source files.

The source files contain Tailwind classes, so Tailwind content scanning can see them in the user project.

Do not require users to scan `node_modules` for Tailwind classes.

### Native Web Components

Native styled Web-C uses plain CSS and CSS variables.

It must not depend on Tailwind runtime scanning.

### Themes

Both React / Vue registry templates and native styled Web-C should consume the same CSS variables.

Example token:

```css
--zeus-primary: 222 47% 11%;
```

React / Vue templates may use Tailwind classes that map to the token.

Native Web-C CSS may use:

```css
background: hsl(var(--zeus-primary));
```

## Install model

### `init`

Future CLI `init` should:

- detect framework
- detect TypeScript
- detect package manager
- create `zeus-ui.json`
- create `cn` utility
- create global CSS token file
- optionally update Tailwind config

### `add`

Future CLI `add` should:

- read `zeus-ui.json`
- resolve registry items
- copy component source files
- install primitive package dependencies
- preserve user modifications by default
- support `--overwrite`
- support `--dry-run`

## Documentation model

Documentation should start with recommended usage:

1. React / Vue CLI usage
2. Native styled Web-C usage
3. Advanced primitive usage

Primitive imports should not be the first path shown to normal React / Vue users.

## Showcase model

Current React / Vue showcase can keep primitive usage until registry exists.

After registry exists, React / Vue showcase should switch to local `components/ui` imports that match CLI output.

A future native showcase should verify:

```ts
import '@zeus-web/ui/styles.css'
import '@zeus-web/ui/button'
```

## Non-goals

This phase does not implement CLI behavior.

This phase only locks the intended usage model.
