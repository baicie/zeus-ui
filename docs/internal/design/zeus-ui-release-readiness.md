# Zeus-UI Release Readiness

## Status

Phase 24 design.

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
pnpm release:final
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
- contain `README.md`
- resolve all export targets
- use public provenance publish config in strict mode

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
README.md
dist/
```

Tarballs must not include:

```
src/
tests/
__tests__/
examples/
scripts/
*.map
*.tsbuildinfo
*.log
```

## Non-goals

Phase 24 does not publish packages, create tags, update versions or change release workflow permissions.

## Next phase

After Phase 24, the project is ready for release verification and can move to release candidate / beta publication.
