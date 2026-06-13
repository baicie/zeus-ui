# Zeus-UI CLI Update and Diff

## Status

Phase 23 design.

## Goal

`zweb diff` and `zweb update` maintain registry-installed components after the registry source changes.

## Commands

```bash
zweb diff button
zweb diff --all
zweb diff button --json

zweb update button --dry-run
zweb update button
zweb update button --overwrite
zweb update --all
```

## Lock model

Phase 23 uses:

```txt
zeus-ui.lock.json
```

The lock file records:

```json
{
  "version": 1,
  "components": {
    "button": {
      "files": ["src/components/ui/button.tsx"],
      "dependencies": ["@zeus-web/button"],
      "registryDependencies": ["cn", "globals"],
      "updatedAt": "2026-01-01T00:00:00.000Z",
      "fileHashes": {
        "src/components/ui/button.tsx": "..."
      },
      "registryHashes": {
        "src/components/ui/button.tsx": "..."
      }
    }
  }
}
```

## Diff statuses

| Status                       | Meaning                                                   |
| ---------------------------- | --------------------------------------------------------- |
| `missing`                    | Target file does not exist.                               |
| `unchanged`                  | Local file and registry template match the lock.          |
| `registry-changed`           | Registry template changed and local file has not changed. |
| `locally-modified`           | Local file changed but registry did not.                  |
| `registry-and-local-changed` | Both local file and registry template changed.            |
| `untracked-existing`         | File exists but no lock hash is available.                |

## Update policy

Default safe update:

- write `missing`
- write `registry-changed`
- skip `locally-modified`
- skip `registry-and-local-changed`
- skip `untracked-existing`

Overwrite update:

```bash
zweb update button --overwrite
```

writes every changed entry.

## Non-goals

Phase 23 does not implement:

- three-way merge
- interactive conflict picker
- remote registry
- registry version pinning
- release

## Next phase

Phase 24 should audit package metadata, verify release readiness and run final validation.
