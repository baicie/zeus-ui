# Zeus-UI Registry Foundation

## Status

Phase 17 design.

This document defines the local source component registry used by future CLI commands.

## Package

```txt
@zeus-web/registry
```

## Goal

The registry stores framework-specific source templates and metadata.

It enables future commands:

```bash
zeus-web add button
zeus-web add input
```

Phase 17 only creates the registry package. It does not implement CLI commands.

## Registry responsibilities

The registry owns:

- item metadata
- dependency metadata
- React source templates
- Vue source templates
- global CSS template
- utility templates

The registry does not own:

- primitive behavior
- native styled Web-C runtime entrypoints
- CLI project detection
- file writing
- dependency installation

## Registry items

Phase 17 includes:

```txt
cn
globals
button
input
```

## Component dependency model

The `button` registry item depends on:

```txt
@zeus-web/button
registry item cn
registry item globals
```

The `input` registry item depends on:

```txt
@zeus-web/input
registry item cn
registry item globals
```

## Template ownership

Registry templates are source files that will be copied into user projects.

Once copied, the user owns them.

That is different from `@zeus-web/ui`, where styles remain package-owned.

## Token model

Registry templates use `--zeus-*` CSS variables.

Native styled Web-C uses `--zw-*` CSS variables.

This separation is intentional:

- `--zw-*` is the native package token facade.
- `--zeus-*` is the application source template token facade.

Future CLI `init` should generate or install `styles/zeus.css`.

## Target paths

Default future targets:

```txt
components/ui/button.tsx
components/ui/input.tsx
components/ui/button.vue
components/ui/input.vue
lib/cn.ts
styles/zeus.css
```

The CLI will apply project aliases later.

## Build model

`@zeus-web/registry` compiles only its schema helpers.

Templates are copied as assets.

This avoids compiling framework templates with user-project aliases such as:

```txt
@/lib/cn
```

## Phase 17 non-goals

Phase 17 does not implement:

- `zeus-web init`
- `zeus-web add`
- overwrite handling
- dry-run
- registry sync into showcase
- remote registry service

## Next phase

Phase 18 should implement CLI `init`.

Phase 19 should implement CLI `add`.
