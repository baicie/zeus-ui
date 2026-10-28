/**
 * One session over the demo host, shared by every page. `?fast` turns off
 * streaming delays (used by the browser E2E stories).
 */

import { createAiSession } from '@zeus-web/ai-core'
import { createDemoHost, STREAM_ID } from './demo-host'

export const host = createDemoHost()
if (new URLSearchParams(location.search).has('fast')) host.tokenDelay = 0

export const session = createAiSession({
  host,
  streamId: STREAM_ID,
  snapshotScope: { kind: 'stream', id: STREAM_ID },
  retryDelayMs: 200,
})
session.connect()

// Exposed for the E2E stories and for poking around in devtools.
;(window as unknown as { __aiDemo: unknown }).__aiDemo = { host, session }
