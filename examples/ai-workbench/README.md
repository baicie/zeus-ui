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

## Two run modes

The toolbar switches between them. They share the shell and nothing else.

**Host** is the agent described above: the Host's snapshot is the only authority
for what happened, approvals gate every write, and an agent conversation is
never edited by the browser.

**BYOK** is your own model. It sends messages straight from this browser to a
gateway you configure, and stores the conversation locally. Nothing about it
touches the Host, the replay stream or the agent's permission model.

### BYOK setup

1. Open **Settings** and create a vault passphrase (8 characters or more).
2. **Add** a profile: name, base URL (for example `https://api.example.com/v1`),
   API key, and a model id. **Load models** fills the id from the gateway when it
   exposes `/models`; type it by hand when it does not.
3. **Test connection** proves the URL, key and model. It reports the gateway's
   own status — including 401, 403, 404 and 429 — rather than a generic failure.
4. **Use for chat**, then switch to **BYOK** and send a message.

### What the vault does and does not protect

Keys are encrypted with AES-GCM under a PBKDF2-SHA-256 key (310,000 iterations,
per-vault salt, per-record IV) and stored as ciphertext in IndexedDB. The derived
key lives in memory and is dropped when you lock the vault; the passphrase is
never persisted.

That protects data at rest — a copied profile, a synced disk, a backup. It does
**not** protect a key from script running in this page while the vault is
unlocked, and it does not make a cross-origin gateway reachable. If the gateway
rejects this page as an origin, the error says so and points at running your own
trusted proxy; the browser cannot route around CORS and the UI does not pretend
otherwise. A proxy you run can see the key in transit.

### Three states, one shell

The topbar model picker is the only switch, and it names what each choice
_is_, because the two share a shell but not a transport:

| State                        | What it does                                                      | What it cannot do                                                |
| ---------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Agent**                    | Replays a recorded Host session (or talks to a local Host in dev) | Send commands, propose or approve — this surface is read-only    |
| **My model**, not configured | Opens the composer and points at Settings                         | Send — it explains what to configure instead of failing silently |
| **My model**, configured     | Streams from your OpenAI-compatible gateway                       | Touch the Host, the replay stream or its permissions             |

Exactly one composer is mounted at a time (`src/composer-dock.ts`): switching
modes detaches the previous one from the document, so it cannot take focus or
a submit. The rule is enforced by `pnpm check:ai-workbench-p0`, not by hiding
the duplicate with CSS.

### Verify the composer rules

```sh
pnpm check:ai-workbench-p0
```

Runs a real Host in Chromium, Firefox and WebKit: one visible composer per
state, click-to-focus, continuous typing, an IME composition round, Enter
sending exactly once, 20 Agent ↔ My model round trips without a duplicate,
drafts surviving a switch, New chat routing to the active mode, and the same
state checks against the built Pages (replay) demo. Screenshots and JSON go to
`temp/ai-workbench-p0/`.

### Verify BYOK

```sh
pnpm check:ai-workbench-byok
```

Runs a deterministic mock gateway (SSE, `[DONE]`, usage, and selectable 401 /
429 / 500 / slow modes by model name) and asserts vault setup, unlock, wrong
passphrase rejection, provider save, that no plaintext key reaches IndexedDB or
web storage, a streamed reply, cancellation, each error status, and reload
recovery. Defaults to Chromium; set `ZEUS_AI_WORKBENCH_BROWSERS` for more.

## Verify

```sh
pnpm check:ai-workbench
```

The gate starts its own Host and Vite server, then runs chat, SSE, approval and
write assertions in Chromium, Firefox and WebKit. Evidence is written to
`temp/ai-workbench/report.json`.

## Boundaries

- The browser never executes filesystem writes or protected commands.
- The Host agent path is replay and local-Host driven; it must not be
  presented as a paid-provider demo. The BYOK path calls a gateway the user
  supplies, with a key the user supplies, and holds no platform credential.
- BYOK requests never reach the Host, and local BYOK conversations are never
  written into the replay stream.
- The Host requires a tenant-scoped bearer token for every endpoint except
  `/health`. Origin allowlisting is only CORS and never substitutes for auth.
- Deployment and TLS termination are host responsibilities; no production URL
  is claimed by this example.
