# Release pairing records

This directory is **retired**. It is kept as a pointer, not as a record store.

## What changed

Zeus UI used to keep its own pairing record here, naming both the Core commit
and **its own** commit. That last field made the protocol impossible to
satisfy:

- writing a commit's SHA into a file changes that commit's SHA, so the record
  could only ever be correct for a commit that is not the one carrying it;
- the previous README told maintainers to amend repeatedly "until the record
  names the commit it is committed in", which never converges — it is a fixed
  point problem with no fixed point;
- across the two repositories the references formed a cycle: Core named UI, UI
  named Core, and neither could be finalised first.

## The protocol now

**Core is the anchor, and the dependency is one-way.** The authoritative record
lives in the Core repository at `release-pairing/v<version>.json`:

```json
{
  "schema": "zeus.release-pairing/v1",
  "coreVersion": "0.2.0-rc.0",
  "uiCommit": "<the UI candidate commit>",
  "uiVersion": "0.2.0-rc.0",
  "verifiedAt": "2026-11-16T00:00:00.000Z",
  "firstPublish": ["@zeus-js/i18n"]
}
```

### Order of operations

1. **Commit and push the UI release candidate.** Its SHA is whatever git
   computed. Nothing needs to know it in advance, and nothing in the UI tree
   records it.
2. **Core commits the record naming that SHA**, and Core is tagged. The record
   is then in the tagged tree, so it cannot change without changing what the tag
   points at.
3. **The UI release reads Core's tag**, resolves it to a commit, reads the
   record from _that_ commit, and requires its own release SHA to equal the
   `uiCommit` the record names.

At no point does either repository need to know a SHA that does not exist yet.

### Where the check lives

`scripts/checks/release/check-release-pairing.ts` in this repository, in two
halves:

| Mode                                         | Runs             | Checks                                                        | Network |
| -------------------------------------------- | ---------------- | ------------------------------------------------------------- | ------- |
| `--version <v>` (static)                     | UI pull requests | version line, `@zeus-js/*` pins, channel                      | no      |
| `--version <v> --online --release-sha <sha>` | UI release       | the above, plus Core's tag, Core's record, the SHA comparison | yes     |

The split exists so a UI pull request is not blocked by a Core tag that does not
exist until after the Core release — which is after the PR merges. Requiring the
tag in the static half would deadlock every UI PR permanently.

### Failure behaviour

A missing Core tag, an unreadable record, a malformed record, a record naming a
different UI commit, and an unreachable GitHub all fail the release. None of
them degrades to a pass. `beta` is the only channel that skips the online half,
because it is the pre-contract channel and has no Core tag by design.

## Why the directory still exists

Nothing reads it. It is kept so the next person who looks for the record finds
this explanation instead of an empty directory — and so a stray file added here
in future is caught by the UI check, which no longer accepts records from this
repository.
