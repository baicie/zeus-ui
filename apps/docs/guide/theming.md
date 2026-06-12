# Theming

Zeus Web has two token surfaces:

1. `--zeus-*` variables for registry-installed React/Vue source components.
2. `--zw-*` variables for package-owned native styled Web Components.

## Registry source tokens

When you run:

```bash
zweb init --style slate
```

the CLI writes or updates:

```txt
src/styles/zeus.css
```

That file contains `--zeus-*` variables used by generated components.

Examples:

```css
:root {
  --zeus-background: 0 0% 100%;
  --zeus-foreground: 240 10% 3.9%;
  --zeus-primary: 240 5.9% 10%;
  --zeus-primary-foreground: 0 0% 98%;
  --zeus-border: 240 5.9% 90%;
  --zeus-ring: 240 5.9% 10%;
}
```

Registry components consume those variables:

```tsx
<Button variant="primary">Save</Button>
<Input placeholder="Email" />
```

## Native styled Web Component tokens

When you import:

```ts
import '@zeus-web/ui'
```

the package loads `@zeus-web/themes/default.css` and component CSS internally.

Native styled Web Components consume `--zw-*` variables:

```html
<zw-button variant="primary">Save</zw-button>
<zw-input placeholder="Email"></zw-input>
```

You can also import styles only:

```ts
import '@zeus-web/ui/styles.css'
import '@zeus-web/button/wc'
import '@zeus-web/input/wc'
```

## Available theme names

<div class="zw-badge-row">
  <span class="zw-badge">default</span>
  <span class="zw-badge">slate</span>
  <span class="zw-badge">zinc</span>
  <span class="zw-badge">neutral</span>
  <span class="zw-badge">stone</span>
</div>

## Dark mode

Registry styles support `.dark`:

```html
<html class="dark">
  ...
</html>
```

Native `@zeus-web/ui` styles also include dark token values through the theme package.

## Radius and motion

```bash
zweb init --radius lg --motion reduced
```

This updates managed variables in `src/styles/zeus.css`.

## Accent color

```bash
zweb init --accent "220 90% 56%"
```

This can override primary and ring color tokens.

## Rule

Use semantic variables instead of hard-coded colors.

Use `--zeus-*` inside registry-owned app source.

Use `--zw-*` when styling or overriding native `@zeus-web/ui` surfaces.
