# @zeus-web/cli

CLI for Zeus Web.

## Installation

```bash
pnpm add @zeus-web/cli
```

## Commands

### `zweb init`

Initialize a new Zeus Web project.

```bash
zweb init --framework react
zweb init --framework vue
```

### `zweb add`

Add components to your project.

```bash
zweb add button input
zweb add --all --yes
zweb add button --path src/custom/ui
zweb add button --registry https://example.com/registry.json
```

`--registry` accepts the built-in registry, a local `registry.json`, a local
registry directory, or an HTTP(S) manifest URL. Each component records its
registry source and manifest integrity in `zeus-ui.lock.json`; `diff`, `update`
and `doctor` use that locked source. `--skip-deps` copies source without
installing npm dependencies, `--path` changes only the component target
directory, and `--yes` also installs dependencies without an extra prompt.
Version 2 locks record registry name, version, source and SHA-256 integrity.
Version 1 locks are rejected during the beta.

### `zweb diff`

Check for drift between installed components and registry.

```bash
zweb diff button
zweb diff --all
zweb diff button --registry https://example.com/registry.json
```

### `zweb update`

Update installed components to latest registry versions.

```bash
zweb update button --dry-run
zweb update button --overwrite
zweb update --all
```

Without `--registry`, each installed component uses its locked registry source.
Passing `--registry` overrides the source for the selected components.

### `zweb remove`

Remove tracked source and update `zeus-ui.lock.json`.
Local changes or missing hashes stop the entire removal before any files or
lock entries change unless `--force` is supplied. Shared files still
owned by another component are retained, and required registry dependencies
cannot be removed. `--all` selects all tracked entries, including utilities
and styles. npm dependencies are left installed.

```bash
zweb remove button --dry-run
zweb remove button
zweb remove button --force
```

### `zweb doctor`

Check configuration, managed CSS, current lock files and npm dependencies
without modifying the project. Missing tracked files or invalid/unsafe locks
exit with code 1. Existing application-owned shared dependencies are checked
without adding them to the lock.

```bash
zweb doctor --json
```

### Other commands

```bash
zweb list --json
zweb theme list
zweb theme tokens slate --json
zweb theme add brand --from slate --color 'light.primary=12 80% 45%'
zweb icon list
zweb ai --json
```

`zweb theme add <name>` writes generated light/dark CSS under the configured
styles alias at `themes/<name>.css`. Use `--from <preset>` to choose a base and
repeat `--color light.<token>=<hsl>` or `--color dark.<token>=<hsl>` to override
semantic tokens. Existing files are never overwritten.

The generated file can be imported after the base theme and selected with a
`data-theme` boundary:

```bash
zweb theme add brand --from slate \
  --color 'light.primary=12 80% 45%' \
  --color 'dark.primary=12 70% 65%'
```

```ts
import '@zeus-web/themes/components.css'
import './styles/themes/brand.css'
```

```html
<main data-theme="brand">...</main>
```
