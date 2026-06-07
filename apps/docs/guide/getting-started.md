# Getting Started

Zeus Web is a component library workflow built around three layers:

1. **Headless primitives** under `@zeus-web/<component>`.
2. **shadcn-like registry source** copied into your project with `zweb add`.
3. **Themes and AI metadata** for consistent styling and AI-assisted usage.

## Create config

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

and installs the required primitive packages.

## Use the component

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
pnpm dlx @zeus-web/cli ai
```

This creates:

```txt
zeus-web.ai.md
```

For Cursor:

```bash
pnpm dlx @zeus-web/cli ai --cursor
```
