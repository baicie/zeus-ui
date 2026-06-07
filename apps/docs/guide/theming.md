# Theming

Zeus Web uses shadcn-like CSS variables and Tailwind semantic tokens.

## Available themes

```txt
default
slate
zinc
neutral
stone
```

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

Registry components use semantic Tailwind classes:

```txt
bg-background
text-foreground
border-input
ring-ring
bg-primary
text-primary-foreground
bg-muted
text-muted-foreground
```

Avoid hard-coded colors in app components when a theme token exists.

## Dark mode

Themes include `.dark` selectors. Add `dark` to your root element:

```html
<html class="dark">
  ...
</html>
```
