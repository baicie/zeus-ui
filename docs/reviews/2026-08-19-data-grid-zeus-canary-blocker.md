# Data Grid Zeus canary blocker

> Audit date: 2026-08-19
>
> Scope: the Zeus runtime/compiler dependency required by the Data Grid
> performance remediation branch.

## Status

The Zeus publication blocker is cleared. Zeus `0.1.1-beta.1` contains every
runtime and compiler capability required by this Data Grid branch:

| Capability                                           | Integrated commit |
| ---------------------------------------------------- | ----------------- |
| Opt-in shallow custom-element props                  | `974a0c4`         |
| Explicit once DOM bindings                           | `9807fe5`         |
| Keyed `For` item accessors and identity preservation | `9807fe5`         |

The release tag [`v0.1.1-beta.1`](https://github.com/baicie/zeus/releases/tag/v0.1.1-beta.1)
and Zeus `main` both resolve to
`6deffa28d6f58bd4039765c73504f00a825249e9`. GitHub Actions run
[`32260211154`](https://github.com/baicie/zeus/actions/runs/32260211154)
published the packages with provenance, built all seven native compiler
platform packages, and passed registry smoke tests on Node 22 and Node 24.
The npm `beta` dist-tag resolves to `0.1.1-beta.1`.

Publication occurred only in GitHub Actions. No package was packed or
published from a local checkout. The npm `latest` dist-tag is outside this
remediation's acceptance criteria and remains unchanged.

## Clean-install evidence

The zeus-ui manifests and lockfile pin their Zeus dependency closure to
registry version `0.1.1-beta.1`. The final evidence for this branch must be
captured from a fresh checkout of its remote commit, using
`pnpm install --frozen-lockfile` without an adjacent Zeus workspace or an
`@zeus-js/*` `link:`/`file:` override. Normal links between packages inside
the zeus-ui workspace, including `link:../../zeus-compat`, are expected.

That final fresh-checkout run is intentionally not claimed by this revision
of the document. Its commit, install audit, test totals, build result and CI
URL will be recorded here after the branch is pushed and the clean checkout
has completed.

## Consequence

The upstream release is no longer a blocker. Merge readiness now depends on
the zeus-ui implementation, its full validation matrix, and the remote
fresh-checkout registry-only verification.

## Release gate

The release gate is complete only after zeus-ui has:

1. pinned all related `@zeus-js/*` packages and peer ranges to that version;
2. regenerated `pnpm-lock.yaml` without an adjacent Zeus workspace or
   `@zeus-js/*` `link:`/`file:` overrides;
3. passed install, typecheck, Data Grid unit/runtime/benchmark tests, build,
   and workspace dependency checks using only registry packages.

Publishing another Zeus beta or changing npm `latest` is not required.
