# Zeus-UI Release Readiness

## Status

Phase 24 implemented design.

## Goal

Phase 24 adds the final release gate for Zeus Web.

It verifies that all publishable packages have correct metadata, build outputs, exports and tarball contents before release.

## Scope

Phase 24 includes:

- stronger `release:verify`
- strict package metadata checks
- package-specific output checks
- `pnpm pack --dry-run` tarball checks
- final release command
- release readiness documentation

## Commands

```bash
pnpm release:verify
pnpm release:verify:strict
pnpm release:verify:pack
pnpm release:final 0.1.0-beta.2
pnpm release:verify:published \
  --version 0.1.0-beta.2 \
  --tag beta \
  --expected-latest 0.1.0-beta.0 \
  --release-sha <merged-main-sha>
```

`--allow-zero` is available only for the general case where the current
workspace package versions are still `0.0.0`; the current beta does not use it.

## Workflow security rules

- Release checkouts disable credential persistence.
- Only the tag step receives the contents-write GitHub token.
- Publish proves the release SHA is an ancestor of remote `main` before install.
- Publish revalidates the remote version tag immediately before npm access.
- Before a beta publish, Publish snapshots the canonical `latest` dist-tag so
  post-publish verification proves it did not move. A stable `latest` publish
  expects `latest` to equal the current version.
- The `Release` environment requires review, and an active `refs/tags/v*`
  ruleset blocks tag updates and deletions.

## Publishable package rules

Every publishable package must:

- be named `@zeus-web/*`
- use MIT license
- define description
- define exports
- include `files: ["dist"]`
- define `scripts.build`
- define `scripts.check`
- contain `dist`
- resolve all export targets
- use public provenance publish config in strict mode

The repository must contain a root `README.md` and `LICENSE`.
Package-local `README.md` files are optional.

## Private package rules

Examples and docs must be private.

```
@zeus-web/docs
@zeus-web/example-*
```

## Tarball rules

Tarballs must include:

```
package.json
dist/
```

A package-local `README.md` may be included when the package owns one.

Tarballs must not include:

```
src/
tests/
__tests__/
examples/
scripts/
*.tsbuildinfo
*.log
```

Source maps are allowed only under `dist/`.

## Published package rules

The published verifier checks all 36 packages individually. The requested
`beta` dist-tag must equal the release version and `latest` must equal the
explicit pre-publish expectation. Each decoded SLSA provenance v1 statement
must bind:

- the npm purl subject and its `sha512` digest to `dist.integrity`
- repository `https://github.com/baicie/zeus-ui`
- workflow `.github/workflows/publish.yml`
- ref `refs/tags/v<version>`
- source URI `git+https://github.com/baicie/zeus-ui@refs/tags/v<version>`
- source `gitCommit` to the merged `main` release SHA

After registry metadata and provenance pass, the existing isolated consumer
smoke validates browser-safe roots, all 25 React and Vue component subpaths,
TypeScript declarations, the Vite production bundle, runtime compatibility and
the CLI help path.

## Non-goals

The Phase 24 verification commands do not publish packages or create tags.
Release workflow orchestration and permissions are enforced separately.
Dry-run orchestration is read-only, checkout credentials are not persisted,
and third-party Actions in the release path are pinned to full commit SHAs.
An unprivileged validation job fails non-`main` dispatches explicitly.
Prerelease versions must use `beta`; stable versions must use `latest`.
Publish repeats this channel check before npm access.
Publish checks out the captured merged `main` commit SHA, verifies the version tag,
then performs a fresh build and tarball validation before contacting npm.
Release dispatches publish as a separate tag-scoped run so npm provenance uses
the release tag and commit rather than the earlier manual-dispatch context.

## Next phase

After Phase 24, release candidate and beta publication run through the guarded
release workflow and the separately dispatched, reusable publish workflow.
