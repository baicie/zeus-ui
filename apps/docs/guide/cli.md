# CLI

The Zeus Web CLI is published as `@zeus-web/cli`.

## init

```bash
zweb init
```

Options:

```txt
--cwd <dir>                 Use a specific project directory
--style <name>              default | slate | zinc | neutral | stone
--css <file>                CSS file to write theme import into
--overwrite                 Replace existing components.json
--no-install                Do not install dependencies
--package-manager <name>    pnpm | npm | yarn | bun
```

Example:

```bash
zweb init --style slate --css src/styles/globals.css
```

## add

```bash
zweb add button input
```

Options:

```txt
--cwd <dir>                 Use a specific project directory
--dry-run                   Print the plan without writing files
--overwrite                 Replace existing files
--no-install                Do not install dependencies
--package-manager <name>    pnpm | npm | yarn | bun
```

Example:

```bash
zweb add dialog --dry-run
zweb add button --overwrite
```

## ai

```bash
zweb ai
```

Options:

```txt
--json                      Generate zeus-web.ai.json
--cursor                    Generate .cursor/rules/zeus-web.mdc
--output <file>             Write to a custom file
--overwrite                 Replace existing file
--dry-run                   Print the plan without writing
```

Example:

```bash
zweb ai --output docs/ai.md --overwrite
zweb ai --cursor
```
