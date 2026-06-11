# Phase 14 - Showcase CI Gates

Phase 14 wires the showcase quality checks into GitHub Actions.

## Goals

- Run showcase metadata checks in CI.
- Run React and Vue showcase unit tests in CI.
- Run React and Vue showcase builds in CI.
- Run Vitest-powered Playwright E2E in CI.
- Upload browser E2E artifacts on failure.
- Keep browser E2E outside `site:check` to avoid slowing local checks.

## Workflow

The dedicated workflow lives at:

```txt
.github/workflows/showcase.yml
```

It exposes:

```yaml
on:
  workflow_call:
  workflow_dispatch:
```

`ci.yml` calls it as a reusable workflow, and developers can run it manually from GitHub Actions.

## Jobs

### metadata

Runs:

```bash
pnpm showcase:ci:metadata
```

This validates:

- component coverage
- showcase metadata
- showcase implementation

### unit

Runs:

```bash
pnpm showcase:ci:unit
```

This validates React and Vue showcase unit tests.

### build

Runs:

```bash
pnpm showcase:ci:build
```

This validates that React and Vue showcase apps can build.

### e2e

Runs after metadata, unit and build.

```bash
export PLAYWRIGHT_BROWSERS_PATH="$HOME/.cache/playwright-bin"
pnpm exec playwright install --with-deps chromium
pnpm showcase:ci:e2e
```

The GitHub Actions job caches `PLAYWRIGHT_BROWSERS_PATH` with a key based on
`runner.os` and the installed `@playwright/test` version. This follows Vite's
CI pattern: dependency install skips implicit browser downloads, then the E2E
job restores the browser cache and runs an explicit Chromium install step.

On failure it uploads:

```txt
examples/showcase-e2e/.artifacts
```

## Local commands

```bash
pnpm showcase:ci:metadata
pnpm showcase:ci:unit
pnpm showcase:ci:build
pnpm showcase:ci:e2e
pnpm showcase:ci
```

## Why `site:check` does not run browser E2E

`site:check` remains a local-friendly metadata/docs/unit/build check.

Browser E2E is slower because it installs and launches Chromium. It is gated in CI through the dedicated `showcase.yml` workflow instead.

## Reusable workflow concurrency

The showcase workflow is called from `ci.yml`, so it must not use the same
`${{ github.workflow }}-${{ github.ref }}` concurrency group as the caller.

Use an explicit prefix instead:

```yaml
concurrency:
  group: showcase-${{ github.repository }}-${{ github.ref }}
  cancel-in-progress: true
```

This avoids the called workflow cancelling the caller workflow.
