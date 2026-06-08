# Release Guide

## 0. Release scope

Zeus Web is released as a multi-package workspace.

Package roots:

```txt
packages/*
packages/primitives/*
```

Private packages are skipped.

## 1. Pick a version

For beta:

```bash
pnpm version:packages 0.1.0-beta.0
```

For stable:

```bash
pnpm version:packages 0.1.0
```

## 2. Run release checks

```bash
pnpm release --dry-run --tag beta
```

Stable:

```bash
pnpm release --dry-run --tag latest
```

## 3. Inspect release plan

```bash
pnpm release:plan --tag beta --check-npm
```

JSON:

```bash
pnpm release:plan --tag beta --check-npm --json
```

## 4. Publish

Dry-run:

```bash
pnpm ci-publish --dry-run --tag beta
```

Publish beta:

```bash
NODE_AUTH_TOKEN=xxx pnpm ci-publish --tag beta
```

Publish stable:

```bash
NODE_AUTH_TOKEN=xxx pnpm ci-publish --tag latest
```

## 5. GitHub Actions

Use the `Release` workflow.

Inputs:

```txt
version: 0.1.0-beta.0
tag: beta
dry_run: true
```

After dry-run passes, run again with:

```txt
dry_run: false
```

## 6. Required gates

Before publish, all of these must pass:

```bash
pnpm format-check
pnpm lint
pnpm test
pnpm check
pnpm build
pnpm check:exports
pnpm check:build-output
pnpm site:check
pnpm release:verify --strict
```

## 7. NPM token

GitHub Actions requires:

```txt
NPM_TOKEN
```

The release workflow also enables provenance through `id-token: write`.
