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
pnpm release:final 0.1.0-beta.0 --allow-zero
```

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

## Non-goals

The Phase 24 verification commands do not publish packages or create tags.
Release workflow orchestration and permissions are enforced separately.
Dry-run orchestration is read-only, checkout credentials are not persisted,
and third-party Actions in the release path are pinned to full commit SHAs.
An unprivileged validation job fails non-`main` dispatches explicitly.
Publish checks out the captured release commit SHA, verifies the version tag,
then performs a fresh build and tarball validation before contacting npm.
Release dispatches publish as a separate tag-scoped run so npm provenance uses
the release tag and commit rather than the earlier manual-dispatch context.

## Next phase

After Phase 24, release candidate and beta publication run through the guarded
release workflow and the separately dispatched, reusable publish workflow.
