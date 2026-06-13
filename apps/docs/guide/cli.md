# CLI

The Zeus Web CLI is published as `@zeus-web/cli`.

The CLI owns the React/Vue source registry workflow.

## Commands

| Command                 | Description                                                       |
| ----------------------- | ----------------------------------------------------------------- |
| `zweb init`             | Create `zeus-ui.json`, `src/lib/cn.ts` and `src/styles/zeus.css`. |
| `zweb add <components>` | Copy registry component source into your project.                 |
| `zweb ai`               | Generate AI-readable metadata and usage guide.                    |
| `zweb icon`             | Manage icon metadata and snippets.                                |

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

| Option                     | Description                           |
| -------------------------- | ------------------------------------- |
| `--cwd <dir>`              | Use a specific project directory.     |
| `--dry-run`                | Print the plan without writing files. |
| `--overwrite`              | Replace existing generated files.     |
| `--install`                | Install package dependencies.         |
| `--no-install`             | Do not install dependencies.          |
| `--package-manager <name>` | `pnpm`, `npm`, `yarn`, or `bun`.      |

Examples:

```bash
zweb add button --dry-run
zweb add button input
zweb add button --overwrite
zweb add button --install
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
