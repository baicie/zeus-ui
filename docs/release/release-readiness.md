# Release Readiness

This document defines the final verification workflow before publishing Zeus Web packages.

## Final command

The command requires the target release version. For the current corrective
beta, run:

```bash
pnpm release:final 0.1.0-beta.2
```

The general form is `pnpm release:final <version> [--allow-zero]`.
`--allow-zero` is only for the general case where the current workspace package
versions are still `0.0.0`; it is not needed for the current beta.

The final dry-run can temporarily update package versions, changelog files and
the lockfile. For a real release, run it on the release branch, keep the target
version files and merge them through a pull request. For verification only, use
a temporary worktree or restore the temporary changes afterwards.

This runs:

```
pnpm check
pnpm build
pnpm site:check
pnpm showcase:ci
pnpm release:verify:strict
pnpm release:verify:pack
pnpm release:dry 0.1.0-beta.2
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
- every bare import in packed `dist/**/*.js` and `dist/**/*.d.ts` is declared
  in `dependencies`, `peerDependencies` or `optionalDependencies`
- component manifests do not reuse a component prop name as a React named slot

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

## Published package verification

After npm publication, run the verifier against the immutable version and its
release channel:

```bash
pnpm release:verify:published \
  --version 0.1.0-beta.2 \
  --tag beta \
  --expected-latest 0.1.0-beta.0 \
  --release-sha <merged-main-sha>
```

For every package, this verifies:

- the exact version exists
- the requested `beta` dist-tag points to `0.1.0-beta.2`
- `latest` still points to the expected canonical version,
  `0.1.0-beta.0`
- the decoded SLSA provenance v1 subject uses the package npm purl and a
  `sha512` digest equal to the package's `dist.integrity`
- the provenance workflow repository is `https://github.com/baicie/zeus-ui`,
  its path is `.github/workflows/publish.yml`, and its ref is
  `refs/tags/v0.1.0-beta.2`
- the resolved source URI is
  `git+https://github.com/baicie/zeus-ui@refs/tags/v0.1.0-beta.2` and its
  `gitCommit` equals `<merged-main-sha>`

The verifier then runs the existing consumption smoke in an isolated consumer
outside the workspace, installs its own TypeScript and Vite toolchain, and
checks:

- every browser-safe package root entry
- all 25 component `./react` entries
- all 25 component `./vue` entries
- TypeScript declaration resolution
- a production Vite bundle
- the `@zeus-web/zeus-compat` runtime surface
- the `zweb --help` CLI smoke path

## Development verification

For the current corrective beta, run:

```bash
pnpm release:final 0.1.0-beta.2
```

For a general release whose current workspace package versions are still
`0.0.0`, opt in explicitly:

```bash
pnpm release:final <version> --allow-zero
```

`--allow-zero` applies to the current workspace versions only. The target
release version must still be a valid, non-zero semver version.

## Before publishing

1. Create a clean `release/<version>` branch from the latest `main`.
2. Prepare the root and all 36 package versions with
   `pnpm release <version> --tag <tag> --skipGit`.
3. Run `pnpm release:final <version>`; append `--allow-zero` only when the
   current workspace package versions are still `0.0.0`.
4. Run `pnpm release:plan --tag <tag>` and review every version change.
5. Commit the prepared version files, open a pull request, wait for all required
   checks and merge it into `main`.
6. Ensure the repository Actions secret `NPM_PUBLISH_TOKEN` is configured, the
   `Release` environment has a required reviewer, and an active tag ruleset
   blocks updates and deletions for `refs/tags/v*`.
7. Dispatch the release workflow from `main`, after confirming that it contains
   the merged version pull request.

The release workflow serializes releases per repository. A tokenless
`validate-context` job fails explicitly when dispatch does not target `main`.
Prerelease versions must use the `beta` dist-tag, while stable versions must
use `latest`. The publish workflow repeats the same check before npm access.
Dry runs execute in a separate `contents: read` job. Both release checkouts
have credential persistence disabled. Only the real release job receives
`contents: write`, and only the `Tag release` step receives its GitHub token
through a step-local `GH_TOKEN`; dependency installation and repository release
scripts cannot reuse that credential. The job runs the release tool
with `--skipGit` to verify the versions already merged through the pull request,
and requires a clean worktree both before and after that verification. Just
before tagging, it queries `main` through the GitHub refs API and fails unless
the remote commit still equals the dispatch `GITHUB_SHA`. It creates the
lightweight version ref through that API only when the remote tag is absent and
safely reuses an existing tag only when it points directly to the same commit.
The real release job never commits or pushes `main`, never force-pushes and
never replaces or deletes a tag. Neither release job receives npm credentials.

The release job exports the tag commit as `release_sha`, then a narrowly scoped
`dispatch-publish` job starts a separate `publish.yml` `workflow_dispatch` run
with `v<version>` as its workflow ref. This separate tag-scoped event is
required so npm provenance receives the actual release `GITHUB_REF` and `GITHUB_SHA`,
rather than the earlier release-dispatch commit.
After any `Release` environment approval, publish explicitly fails unless its
event ref/SHA matches version and `release_sha`. It checks out that immutable
SHA with credential persistence disabled, verifies that `v<version>` resolves
to it, refreshes the fixed remote `main` refspec, and runs
`git merge-base --is-ancestor --` before installation to prove the release SHA
belongs to protected `main`. A fresh checkout has no ignored `dist/` outputs,
so publish runs
`pnpm build`, `pnpm check:build-output` and `pnpm release:verify:pack` before
`ci-publish`. It revalidates the remote version tag immediately before npm
access. It receives only `NPM_PUBLISH_TOKEN` and serializes publication
per npm dist-tag. The reusable `workflow_call` entry is subject to the same
tag/SHA checks. All third-party Actions in these privileged workflows are
pinned to a full commit SHA. The required environment review is the human gate;
the active tag ruleset is the repository-level guarantee that release tags
cannot be updated or deleted during the workflow.

Immediately before publishing, the publish workflow snapshots the canonical
`latest` dist-tag for a beta release and passes that value to the published
verifier after publication. This prevents a beta from silently moving
`latest`. For a stable release using the `latest` channel, the expected
`latest` value is the current release version.

## Non-goals

This check does not publish packages and does not create tags.
