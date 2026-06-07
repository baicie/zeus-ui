# Getting Started

Zeus Web is a component library workflow built around three layers:

<div class="zw-grid">
  <div class="zw-card">
    <h3>Headless primitives</h3>
    <p>Install per-component packages such as <code>@zeus-web/button</code> or <code>@zeus-web/input</code>.</p>
  </div>
  <div class="zw-card">
    <h3>Registry source</h3>
    <p>Copy shadcn-like React source into your app with <code>zweb add</code>.</p>
  </div>
  <div class="zw-card">
    <h3>AI metadata</h3>
    <p>Generate AI-readable usage rules with <code>zweb ai</code>.</p>
  </div>
</div>

## Initialize

```bash
pnpm dlx @zeus-web/cli init
```

This creates:

```txt
components.json
src/styles/globals.css
```

## Add components

```bash
pnpm dlx @zeus-web/cli add button input
```

This copies:

```txt
src/lib/utils.ts
src/components/ui/button.tsx
src/components/ui/input.tsx
```

## Use components

```tsx
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function Example() {
  return (
    <form className="space-y-4">
      <Input placeholder="Email" type="email" />
      <Button>Submit</Button>
    </form>
  )
}
```

## Generate AI guide

```bash
pnpm dlx @zeus-web/cli ai --cursor
```

This creates:

```txt
.cursor/rules/zeus-web.mdc
```

## Direct primitive usage

You can also use primitive packages directly.

```tsx
import { Button } from '@zeus-web/button/react'

export function Example() {
  return <Button>Save</Button>
}
```

For native Web Components:

```ts
import '@zeus-web/button/wc'
```

```html
<zw-button>Save</zw-button>
```
