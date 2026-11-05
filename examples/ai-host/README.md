# Zeus AI Reference Host

Trusted Node reference host for Zeus AI Headless V2. It implements the
versioned command, SSE and snapshot protocol consumed by
`@zeus-web/ai-adapters`; it does not contain a UI.

## Run

```sh
pnpm --filter @zeus-web/example-ai-host dev
```

Environment:

| Variable            | Default                            | Purpose                              |
| ------------------- | ---------------------------------- | ------------------------------------ |
| `PORT`              | `8788`                             | HTTP port                            |
| `ZEUS_AI_DB`        | `examples/ai-host/.data/ai.sqlite` | Event log and idempotency ledger     |
| `ZEUS_AI_WORKSPACE` | `examples/ai-host/.data/workspace` | Authorized write root                |
| `ZEUS_AI_ORIGINS`   | local Vite origins                 | Comma-separated allowed CORS origins |

The Host never trusts a browser decision. `approval.resolve` checks the
approval revision and current state, and the file write happens only after
that command succeeds. Every write is confined to `ZEUS_AI_WORKSPACE`:
absolute paths and `..` segments are rejected before staging.

## Endpoints

| Method | Path                                | Contract                          |
| ------ | ----------------------------------- | --------------------------------- |
| GET    | `/health`                           | Liveness + workspace id           |
| POST   | `/commands`                         | `Command` → `CommandAck`          |
| GET    | `/streams/:streamId/events?after=N` | SSE `ai-event` frames             |
| GET    | `/snapshots?streamId=reference`     | Folded snapshot + replay events   |
| GET    | `/workspace`                        | Authorized file digests/approvals |

Persistence uses `node:sqlite`. Events and command acknowledgements survive a
restart; the SSE cursor replays only events newer than `Last-Event-ID`/`after`.
`message.send` creates a conversation before its first message so a snapshot
cannot be folded from an orphaned message.

## Verify

```sh
pnpm exec vitest --run --project unit examples/ai-host/__tests__/protocol.spec.ts
pnpm check:ai-workbench
```

The protocol suite covers idempotent retries, conflicting key reuse, restart
replay, path fencing and exact-once approval revisions. The Workbench gate
drives Chromium, Firefox and WebKit through chat, SSE, approval and a real
workspace write.
