/**
 * Protocol compatibility (AI2-112).
 *
 * - Recorded v2 snapshots must keep loading and keep their checksum. A change
 *   to the canonical state shape or the checksum projection fails here and
 *   has to be shipped as a new snapshot `schemaVersion`.
 * - Unknown event types halt the stream unless the host marks them
 *   `compat: 'ignorable'`, in which case only the cursor moves.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'
import { createEventFactory } from '../src/host/event-factory'
import { SCENARIO_FIXTURES } from '../src/host/fixtures'
import {
  readIgnorableExtension,
  SUPPORTED_EVENT_SCHEMA_VERSIONS,
} from '../src/protocol/compat'
import { createAiStore } from '../src/store/store'

const SNAPSHOT_DIR = join(__dirname, 'fixtures', 'snapshots')

function readRecorded(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(SNAPSHOT_DIR, name), 'utf8'))
}

describe('snapshot compatibility', () => {
  const recorded = ['s1.v2.json', 's2.v2.json', 's3.v2.json']

  it.each(recorded.map((name, index) => [name, index] as const))(
    'still loads recorded snapshot %s with an unchanged checksum',
    (name, index) => {
      const snapshot = readRecorded(name)
      const scenario = SCENARIO_FIXTURES[index]
      const store = createAiStore({ streamId: scenario.streamId })

      expect(store.loadSnapshot(snapshot)).toMatchObject({ ok: true })

      // Replaying the same stream today must reproduce the recorded bytes.
      const replayed = createAiStore({ streamId: scenario.streamId })
      for (const event of scenario.events) replayed.ingest(event)

      expect(replayed.exportSnapshot(String(snapshot.takenAt)).checksum).toBe(
        snapshot.checksum,
      )
    },
  )

  it('refuses a snapshot of an unknown schema version', () => {
    const snapshot = { ...readRecorded('s1.v2.json'), schemaVersion: 3 }
    const store = createAiStore({ streamId: 's1-chat' })

    expect(store.loadSnapshot(snapshot)).toMatchObject({
      ok: false,
      code: 'unsupported-schema-version',
    })
  })
})

describe('event compatibility', () => {
  it('supports exactly schema version 2', () => {
    expect(SUPPORTED_EVENT_SCHEMA_VERSIONS).toEqual([2])
  })

  function extension(seq: number, compat?: string) {
    return {
      schemaVersion: 2,
      eventId: `evt-${seq}`,
      streamId: 'compat',
      seq,
      entity: { kind: 'telemetry', id: 'x' },
      type: 'telemetry.sampled',
      occurredAt: '2026-01-01T00:00:00.000Z',
      payload: { anything: true },
      ...(compat ? { compat } : {}),
    }
  }

  it('acknowledges an ignorable extension without touching state', () => {
    const factory = createEventFactory('compat')
    const store = createAiStore({ streamId: 'compat' })

    store.ingest(
      factory.create('conversation.upserted', 'conv-1', {
        conversation: { id: 'conv-1', title: 'c', revision: 1 },
      }),
    )
    const before = store.getState()

    expect(store.ingest(extension(2, 'ignorable'))).toMatchObject({
      status: 'applied',
      seq: 2,
    })
    expect(store.getCursor()).toBe(2)
    expect(store.getState().conversations).toBe(before.conversations)
  })

  it('buffers an ignorable extension that arrives early', () => {
    const factory = createEventFactory('compat')
    const store = createAiStore({ streamId: 'compat' })
    const first = factory.create('conversation.upserted', 'conv-1', {
      conversation: { id: 'conv-1', title: 'c', revision: 1 },
    })

    expect(store.ingest(extension(2, 'ignorable'))).toMatchObject({
      status: 'gap',
    })
    expect(store.ingest(first)).toMatchObject({ appliedSeqs: [1, 2] })
  })

  it('halts on an unknown type the host did not mark ignorable', () => {
    const store = createAiStore({ streamId: 'compat' })

    expect(store.ingest(extension(1))).toMatchObject({
      status: 'quarantined',
      recovery: 'snapshot-required',
    })
    expect(store.getSyncState().status).toBe('desynced')
  })

  it('never lets compat skip a known event type', () => {
    const factory = createEventFactory('compat')
    const known = {
      ...factory.create('conversation.upserted', 'conv-1', {
        conversation: null,
      }),
      compat: 'ignorable',
    }

    expect(readIgnorableExtension(known)).toBeNull()
    expect(createAiStore({ streamId: 'compat' }).ingest(known)).toMatchObject({
      status: 'rejected',
    })
  })
})
