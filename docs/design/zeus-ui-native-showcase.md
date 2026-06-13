# Zeus-UI Native Showcase

## Status

Phase 21 design.

This document defines the framework-free native Web Component showcase for `@zeus-web/ui`.

## Goal

The native showcase verifies that styled Web Components can be consumed without React or Vue.

It validates the second product usage path:

```ts
import '@zeus-web/ui'
```

```html
<zw-button variant="primary">Save</zw-button> <zw-input placeholder="Email" />
```

## Package

```txt
@zeus-web/example-native-showcase
```

## Runtime model

The native showcase uses:

- Vite
- TypeScript
- native DOM APIs
- `@zeus-web/ui`

It must not use:

- React
- React DOM
- Vue
- Vue Router

## Why a separate showcase?

React and Vue showcase validate the registry-installed source usage path.

The native showcase validates package-owned styled Web-C usage:

```txt
@zeus-web/ui
```

That package is useful for:

- static pages
- micro-frontends
- no-framework demos
- framework-neutral embed surfaces

## Scope

Phase 21 includes:

- button examples
- input examples
- aggregate import example
- per-component import snippets
- unit test
- build/check scripts

Phase 21 does not include:

- all primitive components
- native E2E
- CLI update
- CLI diff
- public docs rewrite

## Validation

```bash
pnpm check:native-showcase
pnpm showcase:native:test
pnpm showcase:native:build
```

## Next phase

Phase 22 should rewrite public docs around:

- CLI source registry usage
- native styled Web-C usage
- advanced headless primitive usage
