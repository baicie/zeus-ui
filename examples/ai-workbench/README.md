# Zeus Native AI Workbench

A Zeus Native shell over the AI Headless V2 reference Host. It uses the
public `@zeus-web/ai-core` controllers and `@zeus-web/ai-wc` elements; it does
not implement a second conversation domain or put model/workspace permissions
in browser state.

## Run

Start the Host, then the shell:

```sh
pnpm --filter @zeus-web/example-ai-host dev
ZEUS_AI_HOST_ORIGIN=http://127.0.0.1:8788 \
  pnpm --filter @zeus-web/example-ai-workbench dev
```

Open `http://127.0.0.1:5191/`.

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
- Deployment and TLS termination are host responsibilities; no production URL
  is claimed by this example.
