# Release Readiness

This document defines the final verification workflow before publishing Zeus Web packages.

## Final command

The command requires the target release version. Use `--allow-zero` only when
the current package versions are still `0.0.0`:

```bash
pnpm release:final 0.1.0-beta.0 --allow-zero
```

The general form is `pnpm release:final <version> [--allow-zero]`.

The final dry-run can temporarily update package versions, changelog files and
the lockfile. Run it in a temporary worktree, or restore those local changes
after verification.

This runs:

```
pnpm check
pnpm build
pnpm site:check
pnpm showcase:ci
pnpm release:verify:strict --allow-zero
pnpm release:verify:pack
pnpm release:dry 0.1.0-beta.0
```

## Release readiness

Run:

```bash
pnpm release:verify:strict
```

This validates publishable packages:

- the release set contains 36 packages: 11 base packages, 20 primitive
  packages and 5 advanced packages
- package name starts with `@zeus-web/`
- version is valid semver and non-zero
- license is MIT
- description exists
- exports exist
- files include `dist`
- root README exists
- root LICENSE exists
- build/check scripts exist
- dist exists
- export targets exist
- repository metadata is correct
- publishConfig has public access and provenance enabled

## Tarball dry-run

Run:

```bash
pnpm release:verify:pack
```

This runs `pnpm pack --dry-run --json` for every publishable package and validates:

- tarball includes `package.json`
- tarball includes `dist/`
- tarball may include package README when a package owns one
- tarball does not include `src/`
- tarball does not include tests
- tarball does not include examples
- tarball does not include scripts
- tarball may include `dist/**/*.map`
- tarball does not include `*.tsbuildinfo` or `*.log`
- tarball does not include `src/`, tests, examples, or scripts

## Package-specific checks

### Primitive packages

Primitive packages must export:

```
.
./wc
./react
./vue
./vue/global
./custom-elements.json
./zeus.components.json
```

### @zeus-web/ui

The styled native package must export:

```
.
./styles.css
./button
./input
```

### @zeus-web/registry

The registry package must export:

```
.
./registry.json
./templates/react/button.tsx
./templates/react/input.tsx
./templates/vue/button.vue
./templates/vue/input.vue
./templates/lib/cn.ts
./templates/css/globals.css
```

### @zeus-web/cli

The CLI package must declare:

```json
{
  "bin": {
    "zweb": "./dist/index.js"
  }
}
```

The built `dist/index.js` must start with:

```
#!/usr/bin/env node
```

## Development verification

Before versions are bumped, run:

```bash
pnpm release:final 0.1.0-beta.0 --allow-zero
```

When the current package versions are already non-zero, run:

```bash
pnpm release:final 0.1.0
```

`--allow-zero` applies to the current workspace versions only. The target
release version must still be a valid, non-zero semver version.

## Before publishing

1. Ensure working tree is clean.
2. Run `pnpm release:final 0.1.0-beta.0 --allow-zero`.
3. Run `pnpm release:plan`.
4. Review package versions.
5. Ensure the repository Actions secret `NPM_PUBLISH_TOKEN` and the `Release`
   environment are configured.
6. Dispatch the release workflow from `main`.

The release workflow serializes releases per repository. A tokenless
`validate-context` job fails explicitly when dispatch does not target `main`.
Dry runs execute in a separate `contents: read` job with checkout credential
persistence disabled.
Only the real release job receives `contents: write`, configures the Git
identity, and creates the release commit and tag. Neither job receives npm
credentials. The release job exports the tag commit as `release_sha`, then a
narrowly scoped `dispatch-publish` job starts a separate `publish.yml`
`workflow_dispatch` run with `v<version>` as its workflow ref. This separate
tag-scoped event is required so npm provenance receives the actual release
`GITHUB_REF` and `GITHUB_SHA`, rather than the earlier release-dispatch commit.
After any `Release` environment approval, publish explicitly fails unless its
event ref/SHA matches version and `release_sha`. It checks out that immutable
SHA with credential persistence disabled and verifies that `v<version>` still
resolves to it. A fresh checkout has no ignored `dist/` outputs, so publish runs
`pnpm build`, `pnpm check:build-output` and `pnpm release:verify:pack` before
`ci-publish`. It receives only `NPM_PUBLISH_TOKEN` and serializes publication
per npm dist-tag. The reusable `workflow_call` entry is subject to the same
tag/SHA checks. All third-party Actions in these privileged workflows are
pinned to a full commit SHA.

## Non-goals

This check does not publish packages and does not create tags.
