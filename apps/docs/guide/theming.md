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
```

to the configured CSS file.

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
