# Zeus UI

Zeus UI is a shadcn-like, AI-ready UI system built on headless Web Components and Tailwind CSS.

## Packages

### Primitive packages

Each primitive can be installed independently.

```bash
pnpm add @zeus-web/input
```

```ts
import '@zeus-web/input/wc'
```

```html
<zw-input placeholder="Email"></zw-input>
```

### Aggregated packages

```bash
pnpm add @zeus-web/react
```

```tsx
import { Input } from '@zeus-web/react'
```

### CLI

```bash
pnpm dlx @zeus-web/cli init
pnpm dlx @zeus-web/cli add input
```

## Architecture

- `@zeus-web/utils`: Shared utilities
- `@zeus-web/input`: Single headless primitive package
- `@zeus-web/headless`: Aggregated Web Component package
- `@zeus-web/react`: Aggregated React wrapper package
- `@zeus-web/vue`: Aggregated Vue wrapper package
- `@zeus-web/themes`: Theme tokens and CSS variables
- `@zeus-web/registry`: shadcn-like registry
- `@zeus-web/cli`: CLI for init/add/update

## Commands

```bash
pnpm install
pnpm build
pnpm check
pnpm lint
pnpm test
pnpm format-check
pnpm check:exports
pnpm release:dry
```
