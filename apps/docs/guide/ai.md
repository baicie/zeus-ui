# AI

Zeus Web provides AI metadata through `@zeus-web/ai`.

Generate a markdown guide:

```bash
zweb ai
```

Generate JSON metadata:

```bash
zweb ai --json
```

Generate Cursor rules:

```bash
zweb ai --cursor
```

## What the guide contains

The generated guide contains:

```txt
recommended workflow
theme names
global usage rules
component props
component events
component slots
examples
AI do / do-not rules
```

## Alias aware

When `components.json` exists, `zweb ai` uses your configured aliases so AI-generated imports match your project.

Example:

```json
{
  "aliases": {
    "ui": "~/components/ui",
    "lib": "~/shared/lib"
  }
}
```

The AI guide will use:

```tsx
import { Button } from '~/components/ui/button'
```
