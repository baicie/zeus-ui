# Zeus-UI CLI Init

## Status

Phase 18 design.

This document defines the `zweb init` command.

## Goal

`zweb init` prepares a React or Vue project for future `zweb add` commands.

It creates:

```
zeus-ui.json
src/lib/cn.ts
src/styles/zeus.css
```

## Command

```bash
zweb init
zweb init --framework react
zweb init --framework vue
zweb init --dry-run
zweb init --overwrite
```

## Project detection

The CLI detects:

- React dependency
- Vue dependency
- TypeScript
- package manager
- `src` directory

If both React and Vue are detected, the user must pass:

```bash
zweb init --framework react
```

or:

```bash
zweb init --framework vue
```

## Config file

Phase 18 uses:

```
zeus-ui.json
```

The old `components.json` file remains readable for compatibility but new writes use `zeus-ui.json`.

## Config shape

```json
{
  "$schema": "https://zeus-web.dev/schema/zeus-ui.json",
  "framework": "react",
  "style": "default",
  "typescript": true,
  "srcDir": "src",
  "theme": {
    "radius": "md",
    "motion": "normal",
    "darkMode": "class"
  },
  "tailwind": {
    "css": "src/styles/zeus.css",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "styles": "@/styles"
  }
}
```

## Generated CSS

`zweb init` writes registry globals into the configured CSS file.

The CSS uses `--zeus-*` variables because registry-installed React/Vue components consume those variables.

Native `@zeus-web/ui` uses `--zw-*` variables. That is a separate package-level styled Web-C token facade.

## Generated cn utility

`zweb init` writes:

```
src/lib/cn.ts
```

The content comes from `@zeus-web/registry`.

## Non-goals

Phase 18 does not:

- install components
- implement `zweb add`
- switch showcase to registry
- implement remote registry
- merge user-modified components

## Next phase

Phase 19 should implement:

```bash
zweb add button
```

using the registry metadata and files initialized by this phase.
