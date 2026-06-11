# Theming

Zeus Web uses shadcn-like CSS variables and Tailwind semantic tokens.

## Available themes

<div class="zw-badge-row">
  <span class="zw-badge">default</span>
  <span class="zw-badge">slate</span>
  <span class="zw-badge">zinc</span>
  <span class="zw-badge">neutral</span>
  <span class="zw-badge">stone</span>
</div>

Initialize a theme:

```bash
zweb init --style slate
```

This writes:

```css
@import '@zeus-web/themes/slate.css';
@import '@zeus-web/themes/components.css';
```

to the configured CSS file.

Theme files provide design tokens. `components.css` provides the default
presentation layer for Zeus Web primitives. Registry components can still be
copied and customized with `zweb add`.

## Semantic tokens

Registry components use semantic Tailwind classes and CSS variables.

| Token                     | Usage                       |
| ------------------------- | --------------------------- |
| `bg-background`           | Page or panel background.   |
| `text-foreground`         | Main text.                  |
| `border-input`            | Input and control borders.  |
| `ring-ring`               | Focus ring.                 |
| `bg-primary`              | Primary actions.            |
| `text-primary-foreground` | Text on primary background. |
| `bg-muted`                | Subtle surfaces.            |
| `text-muted-foreground`   | Secondary text.             |

## Dark mode

Themes include `.dark` selectors.

```html
<html class="dark">
  ...
</html>
```

## Rule

Prefer semantic tokens over hard-coded colors.
