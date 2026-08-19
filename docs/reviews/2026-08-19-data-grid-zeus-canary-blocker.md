# Data Grid Zeus canary blocker

> Audit date: 2026-08-19
>
> Scope: the Zeus runtime/compiler dependency required by the Data Grid
> performance remediation branch.

## Status

The Data Grid branch cannot be verified from a clean install against a
published Zeus version yet.

The newest published package version visible during this audit is
`0.1.1-canary.20260812.108.1.b919e736`. It predates the following required
Zeus changes:

| Capability                                           | Required Zeus commit    |
| ---------------------------------------------------- | ----------------------- |
| Opt-in shallow custom-element props                  | `9cc9da2`               |
| Explicit once DOM bindings                           | `c19af4c` and `2f1ed9d` |
| Keyed `For` item accessors and identity preservation | `0222d4b`               |

Tarball inspection confirms that canary 108:

- exports `transformModule` from `@zeus-js/compiler`;
- does not expose prop `reactivity` metadata from `@zeus-js/runtime-dom`;
- still updates a reused keyed record by assigning `oldRecord.item` and
  `oldRecord.index`, leaving the render closure bound to the old values;
- does not contain the explicit once binding API.

The currently pinned `0.1.0-beta.8` dependency is older still and does not
export `transformModule`, the current signal API, or shallow prop metadata.

The registry `canary` dist-tag currently points to
`0.1.1-canary.20260812.105.1.aaffcfa2`; canary 108 is visible in the complete
version list but is not tagged as `canary`.

## Clean-install evidence

After removing every local Zeus override, the workspace and lockfile contain
no `link:` entry targeting the adjacent Zeus repository. A frozen offline
install resolves `@zeus-js/zeus`, `@zeus-js/runtime-dom`, `@zeus-js/signal`,
`@zeus-js/compiler`, and `@zeus-js/bundler-plugin` to registry
`0.1.0-beta.8` packages under pnpm's content-addressed store.

The first capability check then fails while loading `vitest.config.ts`:

```text
SyntaxError: @zeus-js/compiler/dist/compiler.esm-bundler.js
does not provide an export named 'transformModule'
```

This is the expected published-package boundary. It occurs before Data Grid
tests can execute and confirms that local workspace validation cannot be
presented as clean-install evidence.

## Consequence

Local workspace links are suitable only for development. They must not be
committed and cannot be used as evidence that the branch is reproducible.
Removing those links currently restores beta.8 and makes the Data Grid test
compiler and shallow prop schema unavailable.

## Release gate

This blocker is cleared only after one coordinated published Zeus version
contains all commits above and zeus-ui has:

1. pinned all related `@zeus-js/*` packages and peer ranges to that version;
2. regenerated `pnpm-lock.yaml` without `link:` overrides;
3. passed install, typecheck, Data Grid unit/runtime/benchmark tests, build,
   and workspace dependency checks using only registry packages.

Publishing or changing npm dist-tags is outside this remediation task.
