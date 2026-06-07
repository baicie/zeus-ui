# AI

Zeus Web provides AI metadata through `@zeus-web/ai`.

## Generate markdown

```bash
zweb ai
```

This creates:

```txt
zeus-web.ai.md
```

## Generate JSON

```bash
zweb ai --json
```

This creates:

```txt
zeus-web.ai.json
```

## Generate Cursor rules

```bash
zweb ai --cursor
```

This creates:

```txt
.cursor/rules/zeus-web.mdc
```

## What the guide contains

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

When `components.json` exists, `zweb ai` should use your configured aliases so AI-generated imports match your project.

Example:

```json
{
  "aliases": {
    "ui": "~/components/ui",
    "lib": "~/shared/lib"
  }
}
```

The AI guide should prefer:

```tsx
import { Button } from '~/components/ui/button'
```

## Recommended AI instruction

```txt
Use Zeus Web registry components from the local components/ui directory.
Do not import registry components from package internals.
Prefer zweb add when adding a new component.
Use semantic theme tokens instead of hard-coded colors.
```
