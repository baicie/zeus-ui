# Release Readiness

This document defines the final verification workflow before publishing Zeus Web packages.

## Final command

```bash
pnpm release:final
```

This runs:

```
pnpm check
pnpm build
pnpm site:check
pnpm showcase:ci
pnpm release:verify:strict
pnpm release:verify:pack
pnpm release:dry
```

## Release readiness

Run:

```bash
pnpm release:verify:strict
```

This validates publishable packages:

- package name starts with `@zeus-web/`
- version is valid semver and non-zero
- license is MIT
- description exists
- exports exist
- files include `dist`
- package README exists
- root or package LICENSE exists
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
- tarball includes `README.md`
- tarball includes `dist/`
- tarball does not include `src/`
- tarball does not include tests
- tarball does not include examples
- tarball does not include scripts
- tarball does not include `.map`, `.tsbuildinfo`, or logs

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

## Before publishing

1. Ensure working tree is clean.
2. Run `pnpm release:final`.
3. Run `pnpm release:plan`.
4. Review package versions.
5. Publish through the release workflow.

## Non-goals

This check does not publish packages and does not create tags.
