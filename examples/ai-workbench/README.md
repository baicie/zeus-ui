# Zeus Native AI Workbench

A Zeus Native shell over the AI Headless V2 reference Host. It uses the
public `@zeus-web/ai-core` controllers and `@zeus-web/ai-wc` elements; it does
not implement a second conversation domain or put model/workspace permissions
in browser state.

## Run

Start the Host, then the shell:

```sh
ZEUS_AI_TOKENS='[{"token":"local-workbench-token-0123456789","tenantId":"reference","userId":"workbench","role":"admin"}]' \
  pnpm --filter @zeus-web/example-ai-host dev

ZEUS_AI_HOST_ORIGIN=http://127.0.0.1:8788 \
ZEUS_AI_UPSTREAM_TOKEN=local-workbench-token-0123456789 \
  pnpm --filter @zeus-web/example-ai-workbench dev
```

Open `http://127.0.0.1:5191/`. The Vite dev proxy injects the Host Bearer
token server-side; the token is never placed in the browser bundle. Production
uses the same contract in `deploy/nginx.conf` with
`ZEUS_AI_UPSTREAM_TOKEN`; the AI Host itself is not published publicly.

The page shows the real SSE connection state. Sending a message goes through
`ComposerController` → `/commands` → SSE → normalized store → timeline.
"Request protected write" proposes a file; the Host emits an approval and only
the approval command can write it.

## Verify

```sh
pnpm check:ai-workbench
```

The gate starts its own Host and Vite server, then runs chat, SSE, approval and
write assertions in Chromium, Firefox and WebKit. Evidence is written to
`temp/ai-workbench/report.json`.

## Boundaries

- The browser never executes filesystem writes or protected commands.
- Live provider/model calls are not enabled; this reference shell is replay
  and local Host driven, and must not be presented as a paid-provider demo.
- The Host requires a tenant-scoped bearer token for every endpoint except
  `/health`. Origin allowlisting is only CORS and never substitutes for auth.
- Deployment and TLS termination are host responsibilities; no production URL
  is claimed by this example.
