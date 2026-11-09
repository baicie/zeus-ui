# Release pairing records

Every Zeus UI release that is not a `beta` needs one immutable record here,
named after the exact release version:

```
release-pairing/<version>.json
```

The record is the only accepted source of the Zeus Core commit a UI release was
built against. It is read from the git object database at the release SHA by
`scripts/checks/release/check-release-pairing.ts`, so a file written after the
checkout cannot satisfy the gate.

```json
{
  "schema": "zeus-ui.release-pairing/v1",
  "uiVersion": "0.2.0-rc.0",
  "uiCommit": "<40-character UI commit that carries this file>",
  "coreVersion": "0.2.0-rc.0",
  "coreCommit": "<40-character Core commit tagged v0.2.0-rc.0>",
  "channel": "rc"
}
```

Rules enforced by the gate:

- `uiVersion` must equal the release version, and `coreVersion` must equal it
  too: Core and UI release on one version line.
- `channel` must be the channel derived from the version
  (`rc` -> `rc`, `x.y.z` -> `latest`).
- `uiCommit` must be the exact release SHA, never a branch or a short SHA.
- `coreCommit` must be the commit that `v<coreVersion>` resolves to in
  `baicie/zeus`; a retagged or unpublished Core candidate fails closed.
- every `@zeus-js/*` pin in the workspace must equal `coreVersion`.

A `beta` release is the pre-contract development channel and may omit the
record. `rc` and `latest` require it.

## Creating a record

The record cannot be written before the Core commit and the UI commit are both
final, because it contains both. The order is:

1. Core RC is merged to `main` and `v<version>` is tagged at that commit.
2. The UI release commit is prepared; it bumps the `@zeus-js/*` pins and adds
   `release-pairing/<version>.json` naming its own commit.
3. The UI release workflow reads the record at that commit, re-resolves
   `v<version>` on Core, and only then creates the UI tag.

Writing the UI commit into the record makes the commit self-referential. Resolve
it with a two-step amend, and never tag before the record matches:

```bash
# 1. commit the pin bump and a record with a placeholder uiCommit
# 2. amend with the resulting commit SHA
ui_commit="$(git rev-parse HEAD)"
node -e '
  const fs = require("node:fs")
  const file = process.argv[1]
  const record = JSON.parse(fs.readFileSync(file, "utf8"))
  record.uiCommit = process.argv[2]
  fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`)
' "release-pairing/<version>.json" "$ui_commit"
git add "release-pairing/<version>.json"
git commit --amend --no-edit
```

The amended commit has a new SHA, so repeat step 2 until the record names the
commit it is committed in. `check:release-pairing --version <version>
--release-sha <sha>` reports the mismatch until it does.
