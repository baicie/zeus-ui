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
