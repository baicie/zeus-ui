# PR-37 Joint Readiness Evidence

Date: 2026-11-04

## Added

`pnpm release:joint-readiness` evaluates the two-repository release matrix and
writes `temp/release/joint-readiness.json`. It reads:

- the Core and UI package versions and commits;
- both worktrees' clean/dirty state;
- `check:zeus-beta-alignment`;
- `temp/ai-pack-report.json`;
- `temp/ai-workbench/report.json` (three browsers);
- `temp/data-grid-framework-e2e/report.json` (three browsers);
- Core product reports for WebC Studio / Native Lab (`products` entries in
  `temp/playground-editor/report.json`) and Admin (`temp/admin/report.json`);
- explicit online URLs supplied through `ZEUS_WEBC_STUDIO_URL`,
  `ZEUS_NATIVE_LAB_URL`, `ZEUS_ADMIN_URL`, `ZEUS_AI_WORKBENCH_URL`;
- explicit manual A11y, cross-platform and approval records through
  `ZEUS_MANUAL_A11Y=passed`, `ZEUS_CROSS_PLATFORM=passed`,
  `ZEUS_JOINT_RELEASE_APPROVED=true`.

Every browser report must carry a `sourceCommit` matching the UI HEAD (AI
Workbench, DataGrid) or the Core HEAD (Admin, Playground). Missing reports are
`not_run`; invalid JSON, missing or stale commits, and failed results are `fail`.
Online URLs must be unique HTTPS URLs without credentials.

The evaluator never publishes, tags or deploys. It emits
`READY_FOR_JOINT_RELEASE_REVIEW` only when every check passes.

When `ZEUS_CORE_ROOT` is unset, the evaluator now auto-detects the sibling
`../zeus` checkout if it contains `package.json`; this prevents valid local
product reports from being reported as missing. The Core/UI alignment check
also treats the independently versioned `@zeus-js/vite-plugin` as `0.0.5`
instead of requiring the Core beta version.

## DataGrid report

`pnpm data-grid:framework-e2e` now writes
`temp/data-grid-framework-e2e/report.json` with one result per browser and a
top-level `passed` flag. The three-browser run passed on 2026-11-04.

## Current decision

`NOT_READY`. Remaining blockers:

- uncommitted worktrees;
- Core/UI version alignment not yet at the 0.2.0 RC;
- no Windows/Linux evidence;
- no VoiceOver/NVDA manual acceptance;
- no joint release approval;
- no online URLs for WebC Studio, Native Lab, Admin or AI Workbench.

Local product evidence is present for all four products (AI Workbench, WebC
Studio, Native Lab and Admin); only online URLs and the human/platform gates
remain.
