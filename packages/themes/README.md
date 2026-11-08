# @zeus-web/themes

Theme tokens for Zeus Web.

## Installation

```bash
pnpm add @zeus-web/themes
```

## Usage

### CSS

```css
@import '@zeus-web/themes/default.css';
```

### JavaScript

```ts
import '@zeus-web/themes/default.css'
```

## Themes

Provides design tokens and component-level CSS variables for Zeus Web.

### Dark mode strategies

Every theme file declares a light block for `:root, [data-theme='<name>']` and
a dark block. Built-in files use the `class` strategy (`.dark`). Generate the
other strategies with `createThemeCss`'s fourth argument:

```ts
import { createThemeCss } from '@zeus-web/themes'

// `.dark` on <html> (default)
createThemeCss('brand', 'slate', {}, { darkMode: 'class' })
// [data-mode="dark"]
createThemeCss('brand', 'slate', {}, { darkMode: 'data' })
// prefers-color-scheme, no class or attribute needed
createThemeCss('brand', 'slate', {}, { darkMode: 'media' })
```

Both blocks set `color-scheme` (`light` / `dark`) so native form controls and
scrollbars follow the theme instead of staying light.

### On-demand component CSS

`@zeus-web/themes/components.css` ships the presentation for every component.
To load only what you render, use the per-component files instead; each one
requires `tokens.css` and one theme file:

```ts
import '@zeus-web/themes/tokens.css'
import '@zeus-web/themes/default.css'
import '@zeus-web/themes/components/button.css'
import '@zeus-web/themes/components/dialog.css'
```

`components/base.css` holds the shared rules (font inheritance) when you need
them separately. The files are derived from `components.css` by
`scripts/split-component-css.ts`; do not edit them by hand.

### Generate a custom theme

`createThemeCss` creates a light/dark CSS theme from a built-in palette. It
accepts overrides for the semantic color tokens exported by this package.

```ts
import { createThemeCss } from '@zeus-web/themes'

const css = createThemeCss('brand', 'slate', {
  light: { primary: '12 80% 45%' },
  dark: { primary: '12 70% 65%' },
})
```

The generated selectors use `data-theme="brand"`; import the resulting CSS in
your application and set that attribute on the theme boundary. The generated
file also maps semantic tokens to both `--zw-*` native component variables and
`--zeus-*` Registry source variables, so the custom theme updates both
surfaces together.

```ts
import '@zeus-web/themes/components.css'
import './styles/themes/brand.css'
```

```html
<div data-theme="brand">
  <zw-button variant="primary">Save</zw-button>
</div>
```
