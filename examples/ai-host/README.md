# Zeus AI Reference Host

Trusted Node reference host for Zeus AI Headless V2. It implements the
versioned command, SSE and snapshot protocol consumed by
`@zeus-web/ai-adapters`; it does not contain a UI.

## Run

```sh
pnpm --filter @zeus-web/example-ai-host dev
```

Environment:

| Variable            | Default                            | Purpose                                                                                         |
| ------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------- |
| `PORT`              | `8788`                             | HTTP port                                                                                       |
| `ZEUS_AI_DB`        | `examples/ai-host/.data/ai.sqlite` | Event log and idempotency ledger                                                                |
| `ZEUS_AI_WORKSPACE` | `examples/ai-host/.data/workspace` | Authorized write root                                                                           |
| `ZEUS_AI_ORIGINS`   | local Vite origins                 | Comma-separated allowed CORS origins                                                            |
| `ZEUS_AI_TOKENS`    | empty (fail closed)                | JSON array of `{token,tenantId,userId,role}`; role is `viewer`, `editor`, `approver` or `admin` |
| `ZEUS_AI_MODE`      | `replay`                           | `replay` demo or fail-closed `live`                                                             |
| `ZEUS_AI_TENANTS`   | single `reference` tenant          | JSON array of `{id,databaseFile,workspaceRoot}`                                                 |

Origin allowlisting is only browser CORS; it is not authentication. Every
endpoint except `/health` requires `Authorization: Bearer <token>`, including
requests without an `Origin` header. Tokens are bound to a tenant/user/role;
unknown tenants and cross-tenant stream, workspace, asset or approval access
returns 401/403/404. The reference Workbench deployment injects the upstream
Bearer token at the trusted nginx ingress, so it never reaches the browser.

The Host never trusts a browser decision. `approval.resolve` requires an
approver/admin principal, binds the approval to the proposing user and
workspace, rejects self-approval outside replay code, resolves once, and
persists the pending/resolved journal under the tenant workspace. Approval IDs
are random and are not authorization credentials. Every write is confined to
the tenant workspace: absolute paths and `..` segments are rejected before
staging.

Requests, SSE clients, assets and tool executions have bounded limits. Assets
expire, SSE connections are capped per tenant, and disconnected clients are
removed. Live mode fails closed with `AI_HOST_LIVE_NOT_CONFIGURED` because this
reference host has no provider secret or live execution path.

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
cannot be folded from an orphaned message. Replay mode is a controlled demo
with an isolated workspace; every command requires a scoped bearer token.

A public Workbench proxy injects the same viewer token into every anonymous
request, so a bearer token alone is **not** per-visitor isolation. Public
deployments must set `ZEUS_AI_PUBLIC_REPLAY=true`: the Host then rejects every
mutating request with `403 AI_HOST_PUBLIC_REPLAY_READ_ONLY`, serves only the
seeded `reference` stream, and clears events written by earlier writable
deployments. `/health` reports `{ mode, publicReplay, readOnly, interactive }`
so the Workbench can render a read-only state. Interactive chat, proposals and
approvals are supported only for local/demo deployments with an explicit
non-public token.

## Verify

```sh
pnpm exec vitest --run --project unit examples/ai-host/__tests__/protocol.spec.ts
pnpm check:ai-workbench
```

The protocol suite covers idempotent retries, conflicting key reuse, restart
replay, path fencing and exact-once approval revisions. The Workbench gate
drives Chromium, Firefox and WebKit through chat, SSE, approval and a real
workspace write.
