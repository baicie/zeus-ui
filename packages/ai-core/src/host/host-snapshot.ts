/**
 * Consistent host snapshots for the mock and replay hosts (AI2-108 / AI2-110).
 *
 * A snapshot's cursor must describe exactly the events folded into its state.
 * Advertising "cursor = latest" with an empty state would make a recovering
 * client skip every event it never saw, which is the silent loss the protocol
 * forbids. These hosts therefore rebuild the state through the canonical
 * store and refuse to publish a snapshot for a stream they cannot apply.
 */

import type { AnyDomainEvent } from '../protocol/events'
import type { HostSnapshotPayload } from './adapter'

import { checksumState } from '../store/snapshot'
import { createAiStore } from '../store/store'

export function buildHostSnapshot(
  streamId: string,
  events: readonly AnyDomainEvent[],
): HostSnapshotPayload {
  const store = createAiStore({ streamId })

  for (const event of events) {
    if (event.streamId !== streamId) continue

    const result = store.ingest(event)

    if (result.status !== 'applied' && result.status !== 'duplicate') {
      throw new Error(
        `[AI_HOST_SNAPSHOT_UNAVAILABLE] stream ${streamId} cannot be folded at seq ${event.seq}: ${result.status}`,
      )
    }
  }

  const sync = store.getSyncState()

  if (sync.status !== 'live') {
    throw new Error(
      `[AI_HOST_SNAPSHOT_UNAVAILABLE] stream ${streamId} is ${sync.status} at cursor ${sync.cursor}`,
    )
  }

  const state = store.getState()

  return {
    cursors: { ...state.cursors, [streamId]: sync.cursor },
    state,
    checksum: checksumState(state),
  }
}
