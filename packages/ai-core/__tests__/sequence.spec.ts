import type { AiStoreDiagnostic } from '../src/store/store'

import { describe, expect, it } from 'vitest'
import { createEventFactory } from '../src/host/event-factory'

import { createAiStore } from '../src/store/store'

function buildStream(streamId = 'stream-seq') {
  const factory = createEventFactory(streamId)
  const events = [
    factory.create('conversation.upserted', 'conv-1', {
      conversation: { id: 'conv-1', title: 'seq', revision: 1 },
    }),
    factory.create('conversation.upserted', 'conv-1', {
      conversation: { id: 'conv-1', title: 'seq 2', revision: 2 },
    }),
    factory.create('conversation.upserted', 'conv-1', {
      conversation: { id: 'conv-1', title: 'seq 3', revision: 3 },
    }),
    factory.create('conversation.upserted', 'conv-1', {
      conversation: { id: 'conv-1', title: 'seq 4', revision: 4 },
    }),
  ]

  return { factory, events }
}

describe('seq ordering and recovery (AI2-108)', () => {
  it('applies in-order events and deduplicates repeats', () => {
    const { events } = buildStream()
    const store = createAiStore({ streamId: 'stream-seq' })

    expect(store.ingest(events[0])).toMatchObject({ status: 'applied', seq: 1 })
    expect(store.ingest(events[1])).toMatchObject({ status: 'applied', seq: 2 })
    expect(store.ingest(events[1])).toMatchObject({
      status: 'duplicate',
      seq: 2,
    })
    expect(store.getCursor()).toBe(2)
    expect(store.getState().conversations.get('conv-1')!.title).toBe('seq 2')
  })

  it('buffers out-of-order events, reports the gap and heals in order', () => {
    const diagnostics: AiStoreDiagnostic[] = []
    const { events } = buildStream()
    const store = createAiStore({
      streamId: 'stream-seq',
      onDiagnostic: diagnostic => diagnostics.push(diagnostic),
    })

    store.ingest(events[0])
    const gap = store.ingest(events[2])

    expect(gap).toMatchObject({
      status: 'gap',
      expectedSeq: 2,
      receivedSeq: 3,
      buffered: 1,
    })
    expect(store.getCursor()).toBe(1)
    expect(store.pendingSeqs()).toEqual([3])
    expect(diagnostics.some(entry => entry.code === 'gap-detected')).toBe(true)

    const healed = store.ingest(events[1])
    expect(healed).toMatchObject({
      status: 'applied',
      seq: 2,
      appliedSeqs: [2, 3],
    })
    expect(store.getCursor()).toBe(3)
    expect(store.pendingSeqs()).toEqual([])
    expect(store.getState().conversations.get('conv-1')!.title).toBe('seq 3')
  })

  it('rejects events from another stream', () => {
    const { events } = buildStream('other-stream')
    const store = createAiStore({ streamId: 'stream-seq' })

    expect(store.ingest(events[0])).toMatchObject({
      status: 'rejected',
      code: 'stream-mismatch',
    })
    expect(store.getCursor()).toBe(0)
  })

  it('quarantines unknown versions without moving the cursor', () => {
    const { events } = buildStream()
    const store = createAiStore({ streamId: 'stream-seq' })
    const unknownVersion = { ...events[0], schemaVersion: 99 }

    expect(store.ingest(unknownVersion)).toMatchObject({
      status: 'quarantined',
      code: 'unsupported-schema-version',
    })
    expect(store.getCursor()).toBe(0)
  })

  it('stops buffering once the guard limit is reached', () => {
    const { events } = buildStream()
    const store = createAiStore({
      streamId: 'stream-seq',
      maxBufferedEvents: 1,
    })

    store.ingest(events[0])
    expect(store.ingest(events[2])).toMatchObject({ status: 'gap' })

    const overflow = store.ingest(events[3])
    expect(overflow).toMatchObject({
      status: 'rejected',
      code: 'buffer-overflow',
    })
    expect(store.pendingSeqs()).toEqual([3])
  })

  it('restores a checksummed snapshot and resumes from its cursor', () => {
    const { events } = buildStream()
    const store = createAiStore({ streamId: 'stream-seq' })

    store.ingest(events[0])
    store.ingest(events[1])

    const snapshot = store.exportSnapshot('2026-01-01T00:00:00.000Z')
    const restored = createAiStore({ streamId: 'stream-seq' })

    expect(restored.loadSnapshot(snapshot)).toMatchObject({ ok: true })
    expect(restored.getCursor()).toBe(2)
    expect(restored.ingest(events[1])).toMatchObject({ status: 'duplicate' })
    expect(restored.ingest(events[2])).toMatchObject({
      status: 'applied',
      seq: 3,
    })
  })

  it('refuses tampered or foreign snapshots', () => {
    const store = createAiStore({ streamId: 'stream-seq' })
    const snapshot = store.exportSnapshot('2026-01-01T00:00:00.000Z')

    const tampered = {
      ...snapshot,
      state: {
        ...snapshot.state,
        conversations: {
          'conv-x': { id: 'conv-x', title: 'injected', revision: 1 },
        },
      },
    }

    expect(store.loadSnapshot(tampered)).toMatchObject({
      ok: false,
      code: 'checksum-mismatch',
    })
    expect(store.loadSnapshot({ ...snapshot, schemaVersion: 1 })).toMatchObject(
      {
        ok: false,
        code: 'unsupported-schema-version',
      },
    )

    const otherStream = createAiStore({ streamId: 'another-stream' })
    expect(otherStream.loadSnapshot(snapshot)).toMatchObject({
      ok: false,
      code: 'stream-mismatch',
    })
  })
})
