# Zeus-UI Native Styled Web-C

## Status

Phase 16 design.

This document defines the native styled Web Component package.

## Package

```txt
@zeus-web/ui
```

## Goal

`@zeus-web/ui` provides styled native Web Component entrypoints.

It exists because primitive packages are intentionally headless.

## Non-goals

Phase 16 does not implement:

- React registry templates
- Vue registry templates
- CLI init
- CLI add
- native showcase
- registry synchronization

## Public usage

### Single component entry

```ts
import '@zeus-web/ui/button'
```

```html
<zw-button variant="primary">Save</zw-button>
```

### Aggregate entry

```ts
import '@zeus-web/ui'
```

```html
<zw-button variant="primary">Save</zw-button>
<zw-input placeholder="Email"></zw-input>
```

### CSS-only entry

```ts
import '@zeus-web/ui/styles.css'
import '@zeus-web/button/wc'
import '@zeus-web/input/wc'
```

## Internal composition

```txt
@zeus-web/ui/button
  -> @zeus-web/themes/default.css
  -> ./button.css
  -> @zeus-web/button/wc

@zeus-web/ui/input
  -> @zeus-web/themes/default.css
  -> ./input.css
  -> @zeus-web/input/wc
```

## CSS selector strategy

The CSS must support the current light DOM output and future Shadow DOM output.

Current strategy:

```css
zw-button [data-slot='button'] {
}
zw-input [data-slot='input'] {
}
```

Future-compatible strategy:

```css
zw-button::part(button) {
}
zw-input::part(input) {
}
```

Every styled component should include both selector forms where practical.

## Token strategy

Native styled CSS consumes `@zeus-web/themes` CSS variables.

Examples:

```css
background: hsl(var(--zw-primary));
color: hsl(var(--zw-primary-foreground));
border-color: hsl(var(--zw-border));
border-radius: var(--zw-radius-md);
```

## Package boundary

`@zeus-web/ui` may depend on:

- primitive packages
- `@zeus-web/themes`
- `@zeus-web/icons`

`@zeus-web/ui` must not depend on:

- registry
- CLI
- showcase packages

Primitive packages must not depend on `@zeus-web/ui`.

## Phase 16 scope

Phase 16 includes only:

- button
- input
- aggregate styles
- package contract checks

Additional components should be added in later phases after the pattern is reviewed.
