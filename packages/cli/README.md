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
```

### `zweb diff`

Check for drift between installed components and registry.

```bash
zweb diff
zweb diff --all
```

### `zweb update`

Update installed components to latest registry versions.

```bash
zweb update
zweb update button --overwrite
```

### `zweb ai ask`

Query AI metadata for a component.

```bash
zweb ai ask button
```
