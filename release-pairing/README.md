# Zeus Core / UI release pairing

The UI repository **does not keep its own pairing record**. This directory
remains only as an explanation of the historical protocol. Do not add JSON
records here.

## Two independent version identities

Zeus Core publishes `@zeus-js/*` and Zeus UI publishes `@zeus-web/*`.
Their SemVer version strings **do not need to be equal**. For example, the UI
release candidate `0.1.0-beta.35` targets published Core
`0.2.0-rc.5`. The binding is the precise Core version recorded in the UI
package dependency pins, not equality of the two package version strings.

A release must name both identities:

- `version` / `uiVersion`: the UI package version and its npm dist-tag.
- `core_version` / `coreVersion`: the exact **published Core version**
  used to build, test and typecheck the UI workspace.
- `uiCommit`: the UI release revision, which must be on the UI main branch.
- `coreCommit`: the revision obtained **from Core's immutable tag**, never
  a free-form SHA supplied in place of verifying the tag.

Every coordinated `@zeus-js/*` dependency and peer constraint must match the
chosen Core version; independently versioned packages (currently
`@zeus-js/vite-plugin@0.0.5`) retain their own version.

## Three release channels

| UI channel        | Core tag                        | Cross-repository pairing record | Rule                                                                                        |
| ----------------- | ------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------- |
| Beta              | Required at online release time | Not required                    | Exact published Core pins and real immutable Core tag                                       |
| RC                | Required                        | Required                        | Tag and Core pairing record or a valid bootstrap attestation must identify the UI candidate |
| Stable (`latest`) | Required                        | Required                        | Verified pair, no unpaired bootstrap acceptance                                             |

The **Beta exemption is only from a separate cross-repository pairing
record**. It is not an exemption from proving the published Core tag exists.
The online check resolves `v<coreVersion>` and captures its commit, while
the offline checks verify the package pins.

The Core release tag's own immutable pairing record is stored in
`meta/release/pairing/v<coreVersion>.json` in current Core releases. Some
historical tags have it at `release-pairing/v<coreVersion>.json`; these
must remain readable because protected tags cannot be rewritten. An
unpaired Core bootstrap record (`uiCommit: null`) requires a later
`pair/v<coreVersion>` attestation before an RC UI release can claim a pair.

## Safe release sequence (operator checklist)

1. Complete Core publication and confirm all referenced versions exist on
   npm. Inspect the immutable `v<coreVersion>` tag and its commit.
2. Commit the UI candidate and verify exact `@zeus-js/*` pins, lockfile,
   package exports, peer ranges, tests and the actual consumer build.
3. For RC/stable, establish and verify the required Core record or protected
   pairing attestation that names this UI commit. Beta needs the Core tag
   but no separate pairing record.
4. On **UI main**, run a read-only release dry-run with explicit UI version,
   Core version and dist-tag; inspect the generated reports and failures.
5. Only with explicit approval, run the publishing release workflow. It must
   validate pairing **before** creating UI's immutable release tag.
6. The publish workflow independently re-resolves the Core tag and compares
   its commit with the dispatch value **before** touching npm. A wrong or
   missing version, SHA, dist-tag, record, or permission is a hard refusal.

Do not manually cut a UI release tag before prerequisites have passed.
Protected tags cannot safely be moved or reused, and npm versions cannot be
overwritten to repair a half-published release. Advance to a new candidate
version when recovery requires new immutable identities.

## Publish order

`@baicie/release` publishes in the order `scripts/release/publish-order.ts`
returns: each package's `packageKind` is its longest dependency chain within
the workspace, so a dependency always sorts below its dependents. Without it
the release sorts alphabetically, which inverted 59 real `@zeus-web` edges.

`pnpm check:publish-order` runs in the precheck and checks two things the unit
tests cannot:

- no `@zeus-web/*` dependency sorts after its dependent, and
- every `workspace:*` dependency resolves inside the publishable set. A
  dangling one is an error, not a silently dropped edge — that edge dropping
  is what would put a dependent at depth 0, publish it first, and leave a
  published version naming a dependency that is not on the registry yet.

It also pins the comparator to `@baicie/release`'s own source: if a dependency
bump changes how the vendor sorts, the check fails rather than trusting a copy
that has quietly gone stale.

**What it does not prove:** that npm accepts 46 sequential publishes. That is
registry behaviour and only a real release answers it.

## What an acceptance report proves

A passing static pairing check proves only that the declared version and
package pins are internally consistent. An online Beta check additionally
resolves the immutable published Core tag. An online RC/stable check also
verifies the necessary cross-repository pairing record and UI revision.

None of these checks prove that the UI works at runtime. The independent
Core + UI published-package consumer and browser acceptance live in
[`baicie/zeus-ecosystem`](https://github.com/baicie/zeus-ecosystem).
Release readiness must not be confused with full consumer compatibility.

For the implementation, see
`scripts/release/release-protocol.ts`,
`scripts/checks/release/check-release-pairing.ts`,
`.github/workflows/release.yml` and `.github/workflows/publish.yml`.
