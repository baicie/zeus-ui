# PR-33 Native AI Workbench Evidence

Date: 2026-11-04

## Delivered

- Multi-session shell: local session list, controller/timeline/composer
  recreation per conversation, and store-backed history isolation.
- File attachments: `POST /assets` stores bounded text/image bytes and returns
  an `AssetRef`; `message.send` echoes a real `file`/`image` content part.
- Real changeset review: the reference Host emits `changeset.updated` with a
  `diffAsset`; the Workbench loads `/assets/:id` and renders
  `zw-ai-file-change-tree` + `zw-ai-diff-viewer`.
- Real test report: `POST /test-report` checks the workspace file and returns a
  `zeus.test-report/v1` payload whose output is an `/assets/:id` asset; the
  Workbench renders it through `createTestReportController` +
  `zw-ai-test-report`.
- The Host generates a relative-path unified diff and bounded `stats`.
- SSE events emitted in the same tick are batched into one response write.
  WebKit otherwise delayed the second small packet (`message.created`) until
  after the 5s assertion timeout even though it was already queued by the
  Host; batching removes that browser-specific flush stall.
- The existing chat, SSE, approval, revision check and protected write flow is
  unchanged.

## Validation

`pnpm check:ai-workbench` passed in Chromium, Firefox and WebKit on
2026-11-04. Per-engine checks:

- live SSE connection;
- message send and timeline rendering;
- changeset file tree (`+1 −0`) and unified diff content;
- approval prompt, approval revision and workspace write;
- second session creation, isolated message, switch back and history
  isolation.
- axe WCAG 2.1 A/AA scan on the initial workbench and after the full
  chat/attachment/changeset/test-report flow, with no violations.
- 640px-wide (200%-zoom-equivalent) layout check: no horizontal document
  overflow, composer and protected-write control remain visible.
- Actual CSS `zoom: 2` check at 1280×900: no document overflow, composer and
  protected-write control remain visible in all three engines.

Report: `temp/ai-workbench/report.json`.

## Boundaries / not run

- Test reports: the reference Host performs a fixed, read-only workspace
  check (`notes/workbench.txt`) and returns a real `zeus.test-report/v1`
  payload with its output stored as an asset. It is not a user-configurable
  command runner.
- Real Live Provider: no paid provider credentials or spend authorization.
- Online deployment/TLS: not authorized and not run.
- Screen reader manual acceptance: not run. Automated 640px and actual 200%
  zoom geometry are covered above.
