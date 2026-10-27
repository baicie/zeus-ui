/**
 * Protocol compatibility policy (AI2-112).
 *
 * The rules, also written up in `docs/ai-headless-v2/protocol-compatibility.md`:
 *
 * 1. `schemaVersion` is a breaking-change counter. A client accepts exactly
 *    the versions in {@link SUPPORTED_EVENT_SCHEMA_VERSIONS}; anything else is
 *    quarantined and the stream halts until a snapshot of a known version is
 *    loaded. Hosts must not mix versions inside one stream.
 * 2. Inside one version, a host may only *add*: new optional fields, new
 *    event types. Removing or re-typing a field, or changing what an existing
 *    event means, requires a new `schemaVersion`.
 * 3. A new event type is opt-in for old clients only when the host marks the
 *    envelope `compat: 'ignorable'`. Such an event is acknowledged (its seq
 *    advances the cursor) without touching state, so an old client neither
 *    stalls nor guesses its meaning. An unknown type without that mark halts
 *    the stream: the host said the client must understand it.
 * 4. Snapshots carry their own `schemaVersion` and a checksum over the
 *    canonical state. Any change to the canonical state shape or to the
 *    checksum projection is a breaking change; `__tests__/compat.spec.ts`
 *    pins recorded snapshots so such a change cannot land silently.
 */

import { isRecord } from '../internal/stable'
import { DOMAIN_EVENT_SCHEMA_VERSION, isDomainEventType } from './events'

export const SUPPORTED_EVENT_SCHEMA_VERSIONS: readonly number[] = [
  DOMAIN_EVENT_SCHEMA_VERSION,
]

/** How a host classifies an event for clients that do not know its type. */
export type EventCompatibility = 'required' | 'ignorable'

/** A host-declared ignorable event of a type this client does not know. */
export interface IgnorableExtensionEvent {
  kind: 'ignorable-extension'
  streamId: string
  seq: number
  type: string
}

/**
 * Recognize an envelope that may be skipped safely. Only the envelope is
 * checked: the payload belongs to a type this client cannot interpret, so it
 * is never read or stored.
 */
export function readIgnorableExtension(
  input: unknown,
): IgnorableExtensionEvent | null {
  if (!isRecord(input)) return null
  if (input.compat !== 'ignorable') return null
  if (!SUPPORTED_EVENT_SCHEMA_VERSIONS.includes(input.schemaVersion as number))
    return null
  if (typeof input.type !== 'string' || input.type.length === 0) return null
  // A known type must always be interpreted; `compat` cannot opt out of it.
  if (isDomainEventType(input.type)) return null
  if (typeof input.eventId !== 'string' || input.eventId.length === 0)
    return null
  if (typeof input.streamId !== 'string' || input.streamId.length === 0)
    return null
  if (
    typeof input.seq !== 'number' ||
    !Number.isInteger(input.seq) ||
    input.seq < 1
  ) {
    return null
  }

  return {
    kind: 'ignorable-extension',
    streamId: input.streamId,
    seq: input.seq,
    type: input.type,
  }
}
