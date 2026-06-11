# Next.js App Router Example

The Next.js example validates the registry-style React usage path in an App Router project.

Run:

```bash
pnpm --filter @zeus-web/example-next-app dev
```

Build:

```bash
pnpm --filter @zeus-web/example-next-app build
```

Type check:

```bash
pnpm --filter @zeus-web/example-next-app check
```

## What this example validates

```txt
1. Local src/components/ui/* components.
2. Per-component React wrapper imports such as @zeus-web/button/react.
3. Client Component boundary with "use client".
4. Theme import through @zeus-web/themes/default.css.
5. components.json aliases.
```

## Client boundary

Zeus Web React wrappers are used in Client Components.

```tsx
'use client'

import { Button } from '@/components/ui/button'

export function Demo() {
  return <Button>Save</Button>
}
```

## Theme import

The example imports the default theme in `src/app/layout.tsx`.

```tsx
import '@zeus-web/themes/default.css'
import './globals.css'
```

## Alias config

The example includes `components.json`.

```json
{
  "aliases": {
    "components": "@/components",
    "ui": "@/components/ui",
    "lib": "@/lib"
  }
}
```
