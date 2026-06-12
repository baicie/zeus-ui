# Native Web Components Example

Zeus Web supports two native Web Component paths:

1. Styled native Web Components through `@zeus-web/ui`.
2. Headless primitive Web Components through per-component `/wc` entries.

## Styled native showcase

Run:

```bash
pnpm showcase:native
```

Build:

```bash
pnpm showcase:native:build
```

Test:

```bash
pnpm showcase:native:test
```

The native showcase imports the package-owned styled UI entry:

```ts
import '@zeus-web/ui'
```

Then uses native custom elements:

```html
<zw-button variant="primary">Save</zw-button>
<zw-input placeholder="Email"></zw-input>
```

This path does not require React or Vue.

## Per-component styled imports

You can import individual styled entries:

```ts
import '@zeus-web/ui/button'
import '@zeus-web/ui/input'
```

## Styles-only path

You can load only the styled CSS and register primitives separately:

```ts
import '@zeus-web/ui/styles.css'
import '@zeus-web/button/wc'
import '@zeus-web/input/wc'
```

## Headless primitive path

Use primitive WC entries directly when you want to own the style layer:

```ts
import '@zeus-web/button/wc'
import '@zeus-web/input/wc'
```

```html
<zw-button>Save</zw-button> <zw-input placeholder="Email"></zw-input>
```

## Which one should I use?

| Requirement                            | Use                        |
| -------------------------------------- | -------------------------- |
| Styled custom elements                 | `@zeus-web/ui`             |
| No React or Vue runtime                | `@zeus-web/ui`             |
| Package-owned styling                  | `@zeus-web/ui`             |
| Custom styling and behavior primitives | `@zeus-web/<component>/wc` |
