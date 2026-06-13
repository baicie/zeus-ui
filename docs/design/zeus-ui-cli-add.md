# Zeus-UI CLI Add

## Status

Phase 19 design.

This document defines the `zweb add` command.

## Goal

`zweb add` installs registry components into a user project.

Example:

```bash
zweb add button
zweb add button input
zweb add button --dry-run
zweb add button --overwrite
```

## Inputs

`zweb add` reads:

```txt
zeus-ui.json
@zeus-web/registry
```

The project must run `zweb init` first.

## Registry dependency expansion

If the user runs:

```bash
zweb add button
```

The CLI must also install registry dependencies:

```txt
cn
globals
button
```

This ensures generated component templates do not reference missing files.

## Framework filtering

The registry may contain both React and Vue templates.

The CLI must only install files matching the current project framework from `zeus-ui.json`.

For React:

```txt
components/ui/button.tsx
```

For Vue:

```txt
components/ui/button.vue
```

It must not install both frameworks into one project.

## File writing

Default behavior:

- create missing files
- skip existing files
- print skipped files
- suggest `--overwrite`

Overwrite behavior:

```bash
zweb add button --overwrite
```

replaces existing files.

## Dry run

Dry-run prints:

```txt
CREATE src/lib/cn.ts
CREATE src/styles/zeus.css
CREATE src/components/ui/button.tsx
Dependencies:
  @zeus-web/button
```

without writing files.

## Lockfile

The CLI writes:

```txt
zeus-ui.lock.json
```

It records:

- installed component
- written files
- npm dependencies
- registry dependencies
- update timestamp

## Dependency installation

Phase 19 prints install commands by default.

With `--install`, it may run the package manager.

## Non-goals

Phase 19 does not implement:

- update
- diff
- three-way merge
- remote registry
- interactive component picker
- showcase registry sync

## Next phase

Phase 20 should switch React and Vue showcase to registry-installed styled usage.
