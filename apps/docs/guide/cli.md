# CLI

The Zeus Web CLI is published as `@zeus-web/cli`.

The CLI owns the React/Vue source registry workflow.

## Commands

| Command                    | Description                                                       |
| -------------------------- | ----------------------------------------------------------------- |
| `zweb init`                | Create `zeus-ui.json`, `src/lib/cn.ts` and `src/styles/zeus.css`. |
| `zweb add <components>`    | Copy registry component source into your project.                 |
| `zweb list`                | List available registry components.                               |
| `zweb diff <components>`   | Inspect local and registry changes.                               |
| `zweb update <components>` | Update tracked component source.                                  |
| `zweb remove <components>` | Remove tracked source while protecting local changes.             |
| `zweb doctor`              | Check project configuration, tracked files and dependencies.      |
| `zweb theme`               | List, inspect or apply theme presets.                             |
| `zweb ai`                  | Generate AI-readable metadata and usage guide.                    |
| `zweb icon`                | Manage icon metadata and snippets.                                |

## init

```bash
pnpm dlx @zeus-web/cli init
```

Options:

| Option                     | Description                                                      |
| -------------------------- | ---------------------------------------------------------------- |
| `--cwd <dir>`              | Use a specific project directory.                                |
| `--framework <name>`       | `react` or `vue`. Use this when both frameworks are detected.    |
| `--style <name>`           | `default`, `slate`, `zinc`, `neutral`, or `stone`.               |
| `--css <file>`             | CSS file to create or update. Defaults to `src/styles/zeus.css`. |
| `--radius <name>`          | Radius preset.                                                   |
| `--motion <name>`          | Motion preset.                                                   |
| `--dark-mode <name>`       | `class`, `data`, or `media`.                                     |
| `--accent <hsl>`           | Override primary and ring color.                                 |
| `--overwrite`              | Replace generated config and managed files.                      |
| `--dry-run`                | Print the plan without writing files.                            |
| `--package-manager <name>` | `pnpm`, `npm`, `yarn`, or `bun`.                                 |

Examples:

```bash
zweb init --framework react
zweb init --framework vue
zweb init --style slate --css src/styles/zeus.css
zweb init --radius lg --motion reduced
zweb init --dry-run
```

`zweb init` creates:

```txt
zeus-ui.json
src/lib/cn.ts
src/styles/zeus.css
```

## add

```bash
pnpm dlx @zeus-web/cli add button input
```

Options:

| Option                     | Description                                                      |
| -------------------------- | ---------------------------------------------------------------- |
| `--all`                    | Add every component in the selected registry.                    |
| `--path <dir>`             | Write component files under this project-relative directory.     |
| `--registry <source>`      | Use a local `registry.json`, registry directory, or HTTP(S) URL. |
| `--yes`, `-y`              | Install package dependencies without another confirmation.       |
| `--skip-deps`              | Copy source without installing npm dependencies.                 |
| `--cwd <dir>`              | Use a specific project directory.                                |
| `--dry-run`                | Print the plan without writing files.                            |
| `--overwrite`, `--force`   | Replace existing generated files.                                |
| `--install`                | Install package dependencies.                                    |
| `--no-install`             | Do not install dependencies.                                     |
| `--package-manager <name>` | `pnpm`, `npm`, `yarn`, or `bun`.                                 |

Examples:

```bash
zweb add button --dry-run
zweb add button input
zweb add button --overwrite
zweb add button --install
zweb add --all --yes
zweb add button --path src/custom/ui
zweb add button --registry https://example.com/registry.json
```

When adding `button`, the CLI expands registry dependencies and writes:

```txt
src/lib/cn.ts
src/styles/zeus.css
src/components/ui/button.tsx
```

For Vue projects:

```txt
src/lib/cn.ts
src/styles/zeus.css
src/components/ui/button.vue
```

The CLI also writes:

```txt
zeus-ui.lock.json
```

The lock version 2 schema stores each component's registry source plus the
manifest name, version and SHA-256 integrity. `diff`, `update` and `doctor`
reload that recorded source, including remote registries, and report manifest
drift. Registry assets must stay below the manifest directory; traversal outside
the registry root, more than 5 MiB per asset, and files from another HTTP origin
are rejected. Version 1 locks are rejected during the beta; regenerate them.

## Maintain installed components

```bash
zweb list --json
zweb diff button
zweb diff --all --json
zweb update button --dry-run
zweb update button
zweb update button --overwrite
zweb update --all
```

`diff` compares local files, their recorded hashes and the current registry.
`update` restores missing tracked files and applies registry changes to files
without local edits. It skips modified files unless `--overwrite` (or `--force`)
is given. It does not install components that have never been added.

Both commands accept `--cwd <dir>`, `--all` and `--registry <source>`; `diff`
also accepts `--json`, and `update` accepts `--dry-run` without changing files
or the lock. Installed components use their recorded source automatically. An
explicit registry option overrides that source for every selected component.

## remove

```bash
zweb remove button --dry-run
zweb remove button
zweb remove button input
zweb remove button --force
zweb remove --all
```

`remove` reads `zeus-ui.lock.json` and removes the selected tracked files and
their lock entries. It works even when a component is no longer in the current
registry. It accepts `--cwd <dir>`.

- Local edits and files without a recorded hash stop the entire removal before
  any file or lock entry is changed, and the command exits with code 1.
  `--force` permits deleting those files.
- Files tracked by another retained component are kept. A registry dependency
  required by a retained component cannot be removed.
- `--all` selects every tracked entry, including shared utility and style entries.
  Review `--dry-run` before using it.
- `--dry-run` prints the plan without changing files or lock bytes.
- Untracked files, directories, npm dependencies and project configuration remain
  in place. The command rejects invalid locks, paths outside the project and
  paths through symbolic links, including with `--force`.

## doctor

```bash
zweb doctor
zweb doctor --cwd ./my-app --json
```

`doctor` checks `zeus-ui.json`, alias paths, managed CSS blocks, the bundled and
recorded registries, and files tracked in `zeus-ui.lock.json`. It reports
missing registry dependencies, unavailable sources, missing files and unsafe or
invalid locks as failures. It warns about changed registry manifests, missing
npm dependencies, local changes and application-owned registry dependency files
that are present but untracked. Failure exits with code 1;
`--json` returns a `checks` array containing `level` and `message` for each result.
The command does not modify the project.

## theme

```bash
zweb theme list --json
zweb theme tokens slate --json
zweb theme set zinc --radius lg --motion reduced --dark-mode class
```

`theme set` updates theme configuration and managed CSS. It accepts `--cwd`,
`--radius`, `--motion`, `--dark-mode` and `--accent`; use `theme list` and
`theme tokens` to inspect presets before applying them.

## ai

```bash
pnpm dlx @zeus-web/cli ai --cursor
```

Options:

| Option            | Description                            |
| ----------------- | -------------------------------------- |
| `--json`          | Generate `zeus-web.ai.json`.           |
| `--cursor`        | Generate `.cursor/rules/zeus-web.mdc`. |
| `--output <file>` | Write to a custom file.                |
| `--overwrite`     | Replace existing file.                 |
| `--dry-run`       | Print the plan without writing.        |
