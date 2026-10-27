/**
 * M2 controllers: base, session, composer, conversation, streaming text and
 * timeline (AI2-201 – AI2-205). Plain Node, no DOM.
 */

import type { CommandAck } from '../src/protocol/commands'

import { describe, expect, it, vi } from 'vitest'
import { createComposerController } from '../src/controllers/composer'
import { createConversationController } from '../src/controllers/conversation'
import { createAiSession } from '../src/controllers/session'
import { createStreamingText } from '../src/controllers/streaming-text'
import { createTimelineController } from '../src/controllers/timeline'
import { createViewStore } from '../src/controllers/view-store'
import { createMockHost } from '../src/host/mock-host'
import {
  createFixture,
  createSessionStub,
  deferred,
  message,
  sequentialIds,
} from './helpers'

describe('ai2-201 · controller base', () => {
  it('notifies only on selected changes and releases everything on dispose', () => {
    const cleanup = vi.fn()
    const view = createViewStore({ a: 1, b: 1 })
    const onA = vi.fn()
    view.subscribe(state => state.a, onA)
    view.onDispose(cleanup)

    view.update({ b: 2 })
    expect(onA).not.toHaveBeenCalled()
    view.update({ a: 2 })
    expect(onA).toHaveBeenCalledWith(2)

    const before = view.getSnapshot()
    view.update({ a: 2 })
    expect(view.getSnapshot()).toBe(before)
    expect(Object.isFrozen(before)).toBe(true)

    view.dispose()
    expect(cleanup).toHaveBeenCalledOnce()
    expect(view.listenerCount()).toBe(0)
    view.update({ a: 3 })
    expect(view.getSnapshot().a).toBe(2)
  })

  it('stops following the store after dispose without sending commands', () => {
    const fixture = createFixture()
    fixture.emit('conversation.upserted', 'conv-1', {
      conversation: { id: 'conv-1', title: 'c', revision: 1 },
    })
    const session = createSessionStub(fixture.store)
    const conversation = createConversationController({
      session,
      conversationId: 'conv-1',
    })

    conversation.dispose()
    fixture.emit('message.created', 'msg-1', {
      message: message({ author: 'user' }),
    })

    expect(conversation.getSnapshot().visibleMessageIds).toEqual([])
    expect(session.execute).not.toHaveBeenCalled()
  })
})

describe('ai2-201 · session', () => {
  it('follows the host stream and executes commands idempotently', async () => {
    const host = createMockHost({ streamId: 's' })
    const session = createAiSession({
      host,
      streamId: 's',
      snapshotScope: { kind: 'conversation', id: 'conv-1' },
    })
    const stop = session.connect()

    host.emit('conversation.upserted', 'conv-1', {
      conversation: { id: 'conv-1', title: 'c', revision: 1 },
    })
    await vi.waitFor(() => expect(session.getSnapshot().cursor).toBe(1))
    expect(session.getSnapshot().connection).toBe('live')

    const command = {
      schemaVersion: 2 as const,
      commandId: 'c1',
      idempotencyKey: 'k1',
      type: 'message.send',
      target: { kind: 'conversation', id: 'conv-1' },
      payload: {},
    }
    const [first, second] = await Promise.all([
      session.execute(command),
      session.execute({ ...command, commandId: 'c2' }),
    ])

    expect(host.commands()).toHaveLength(1)
    expect(second).toMatchObject({
      commandId: 'c2',
      operationId: (first as { operationId: string }).operationId,
    })

    stop()
    session.dispose()
  })

  it('recovers from a desynced stream with a host snapshot', async () => {
    const host = createMockHost({ streamId: 's' })
    host.emit('conversation.upserted', 'conv-1', {
      conversation: { id: 'conv-1', title: 'one', revision: 1 },
    })
    const broken = host.emit('conversation.upserted', 'conv-1', {
      conversation: { id: 'conv-1', title: 'two', revision: 2 },
    })
    // The wire delivers a corrupted copy of seq 2.
    ;(host.events() as unknown as unknown[])[1] = {
      ...broken,
      payload: { conversation: null },
    }
    const snapshotSource = createMockHost({ streamId: 's' })
    snapshotSource.emit('conversation.upserted', 'conv-1', {
      conversation: { id: 'conv-1', title: 'one', revision: 1 },
    })
    snapshotSource.emit('conversation.upserted', 'conv-1', {
      conversation: { id: 'conv-1', title: 'two', revision: 2 },
    })
    host.getSnapshot = snapshotSource.getSnapshot

    const session = createAiSession({
      host,
      streamId: 's',
      snapshotScope: { kind: 'conversation', id: 'conv-1' },
      retryDelayMs: 1,
    })
    session.connect()

    await vi.waitFor(() =>
      expect(session.store.getState().conversations.get('conv-1')?.title).toBe(
        'two',
      ),
    )
    expect(session.store.getSyncState().status).toBe('live')
    session.dispose()
  })
})

describe('ai2-202 · composer', () => {
  function setup(respond?: Parameters<typeof createSessionStub>[1]) {
    const fixture = createFixture()
    const session = createSessionStub(fixture.store, respond)
    const composer = createComposerController({
      session,
      conversationId: 'conv-1',
      createId: sequentialIds(),
    })
    return { session, composer }
  }

  it('lets the input method own Enter and blocks submit while composing', async () => {
    const { session, composer } = setup()
    composer.setText('ni hao')
    composer.setComposing(true)

    expect(composer.resolveKey({ key: 'Enter' })).toBe('none')
    expect(composer.resolveKey({ key: 'Enter', isComposing: true })).toBe(
      'none',
    )
    expect(await composer.submit()).toMatchObject({
      accepted: false,
      code: 'AI_COMPOSER_COMPOSING',
    })

    composer.setComposing(false)
    expect(composer.resolveKey({ key: 'Enter' })).toBe('submit')
    expect(composer.resolveKey({ key: 'Enter', shiftKey: true })).toBe(
      'newline',
    )
    expect(composer.resolveKey({ key: 'Enter', menuOpen: true })).toBe('none')
    expect(session.execute).not.toHaveBeenCalled()
  })

  it('sends one command for repeated submits of the same draft', async () => {
    const gate = deferred<CommandAck>()
    const { session, composer } = setup(() => gate.promise)
    composer.setText('hello')

    const first = composer.submit()
    const second = composer.submit()

    expect(second).toBe(first)
    expect(session.execute).toHaveBeenCalledOnce()
    gate.resolve({ accepted: true, commandId: 'cmd-2', operationId: 'op' })
    await first
  })

  it('keeps text typed after submitting when the ack arrives late', async () => {
    const gate = deferred<CommandAck>()
    const { composer } = setup(() => gate.promise)
    composer.setText('first question')
    const pending = composer.submit()

    composer.setText('follow-up being typed')
    gate.resolve({ accepted: true, commandId: 'x', operationId: 'op' })
    await pending

    expect(composer.getSnapshot()).toMatchObject({
      text: 'follow-up being typed',
      phase: 'dirty',
    })
  })

  it('clears only the submitted draft once the host accepts', async () => {
    const { composer, session } = setup()
    composer.setText('  keep   markdown spacing\n')
    await composer.submit()

    expect(session.commands()[0].payload).toMatchObject({
      text: '  keep   markdown spacing\n',
    })
    expect(composer.getSnapshot()).toMatchObject({
      text: '',
      phase: 'accepted',
    })
  })

  it('keeps the draft on rejection and reuses the key only for the same draft', async () => {
    let fail = true
    const { composer, session } = setup(async command => {
      if (fail) throw Object.assign(new Error('offline'), { code: 'network' })
      return { accepted: true, commandId: command.commandId, operationId: 'op' }
    })
    composer.setText('draft')

    await expect(composer.submit()).rejects.toThrow('offline')
    expect(composer.getSnapshot()).toMatchObject({
      text: 'draft',
      phase: 'rejected',
      lastErrorCode: 'network',
    })

    await expect(composer.submit()).rejects.toThrow()
    const [firstKey, retryKey] = session.commands().map(c => c.idempotencyKey)
    expect(retryKey).toBe(firstKey)

    composer.setText('draft, edited')
    fail = false
    await composer.submit()
    expect(session.commands()[2].idempotencyKey).not.toBe(firstKey)
  })

  it('does not send while uploads run or after an upload failed', async () => {
    const { composer, session } = setup()
    const id = composer.addAttachment({ name: 'log.txt' })

    expect(composer.getSnapshot().blockedReason).toBe('uploading')
    composer.updateAttachment(id, { status: 'failed', error: 'too large' })
    expect(composer.getSnapshot().blockedReason).toBe('upload-failed')
    expect(await composer.submit()).toMatchObject({ accepted: false })

    composer.updateAttachment(id, {
      status: 'ready',
      asset: { id: 'asset-1', mimeType: 'text/plain' },
    })
    expect(composer.getSnapshot().blockedReason).toBeUndefined()
    await composer.submit()
    expect(session.commands()[0].payload).toMatchObject({
      attachments: [{ id: 'asset-1' }],
    })
  })

  it('routes text to the owner in controlled mode and warns on misuse', () => {
    const onTextChange = vi.fn()
    const onWarning = vi.fn()
    const fixture = createFixture()
    const controlled = createComposerController({
      session: createSessionStub(fixture.store),
      conversationId: 'conv-1',
      controlled: { onTextChange },
    })
    controlled.setText('a')
    expect(onTextChange).toHaveBeenCalledWith('a')
    expect(controlled.getSnapshot().text).toBe('')
    controlled.syncText('a')
    expect(controlled.getSnapshot().text).toBe('a')

    const uncontrolled = createComposerController({
      session: createSessionStub(fixture.store),
      conversationId: 'conv-1',
      onWarning,
    })
    uncontrolled.syncText('b')
    expect(onWarning).toHaveBeenCalled()
  })
})

describe('ai2-203 · conversation branches', () => {
  function seed() {
    const fixture = createFixture()
    fixture.emit('conversation.upserted', 'conv-1', {
      conversation: { id: 'conv-1', title: 'c', revision: 1 },
    })
    fixture.emit('message.created', 'u1', {
      message: message({ id: 'u1', author: 'user', status: 'complete' }),
    })
    fixture.emit('message.created', 'a1', {
      message: message({ id: 'a1', parentMessageId: 'u1', executionId: 'e1' }),
    })
    // An edit of u1 creates a sibling branch with its own answer.
    fixture.emit('message.created', 'u1b', {
      message: message({ id: 'u1b', author: 'user', status: 'complete' }),
    })
    fixture.emit('message.created', 'a1b', {
      message: message({ id: 'a1b', parentMessageId: 'u1b' }),
    })
    return fixture
  }

  it('shows the newest branch and lets the user switch siblings locally', () => {
    const fixture = seed()
    const session = createSessionStub(fixture.store)
    const conversation = createConversationController({
      session,
      conversationId: 'conv-1',
    })

    expect(conversation.getSnapshot().visibleMessageIds).toEqual(['u1b', 'a1b'])
    expect(conversation.getSnapshot().branches.u1b).toEqual({
      siblingIds: ['u1', 'u1b'],
      index: 1,
    })

    conversation.selectSibling('u1b', 'previous')
    expect(conversation.getSnapshot().visibleMessageIds).toEqual(['u1', 'a1'])
    expect(session.execute).not.toHaveBeenCalled()
  })

  it('follows the host-selected leaf by default', () => {
    const fixture = seed()
    fixture.emit('conversation.upserted', 'conv-1', {
      conversation: {
        id: 'conv-1',
        title: 'c',
        revision: 2,
        selectedLeafMessageId: 'a1',
      },
    })
    const conversation = createConversationController({
      session: createSessionStub(fixture.store),
      conversationId: 'conv-1',
    })

    expect(conversation.getSnapshot().visibleMessageIds).toEqual(['u1', 'a1'])
  })

  it('asks the host for a sibling on edit and a new execution on retry', async () => {
    const fixture = seed()
    const session = createSessionStub(fixture.store)
    const conversation = createConversationController({
      session,
      conversationId: 'conv-1',
    })

    await conversation.edit('u1', 'better question')
    await conversation.retry('a1')

    expect(session.commands().map(c => [c.type, c.payload])).toEqual([
      [
        'message.edit',
        {
          conversationId: 'conv-1',
          parentMessageId: undefined,
          text: 'better question',
        },
      ],
      [
        'execution.retry',
        { conversationId: 'conv-1', retryOf: 'e1', parentMessageId: 'u1' },
      ],
    ])
    // Nothing changed locally: the original branch is intact.
    expect(fixture.store.getState().messages.get('u1')!.parts).toEqual(
      message().parts,
    )
  })

  it('does not recompute the branch on token deltas', () => {
    const fixture = seed()
    const conversation = createConversationController({
      session: createSessionStub(fixture.store),
      conversationId: 'conv-1',
    })
    const listener = vi.fn()
    conversation.subscribe(view => view, listener)

    fixture.emit('message.part.delta', 'a1b', {
      messageId: 'a1b',
      partId: 'p1',
      baseRevision: 0,
      nextRevision: 1,
      append: 'hi',
    })

    expect(listener).not.toHaveBeenCalled()
  })
})

describe('ai2-204 · streaming text', () => {
  function setup() {
    const fixture = createFixture()
    fixture.emit('conversation.upserted', 'conv-1', {
      conversation: { id: 'conv-1', title: 'c', revision: 1 },
    })
    fixture.emit('message.created', 'msg-1', { message: message() })
    const frames: (() => void)[] = []
    const view = createStreamingText({
      store: fixture.store,
      messageId: 'msg-1',
      schedule: callback => {
        frames.push(callback)
        return () => frames.splice(frames.indexOf(callback), 1)
      },
    })
    let revision = 0
    const delta = (text: string) => {
      fixture.emit('message.part.delta', 'msg-1', {
        messageId: 'msg-1',
        partId: 'p1',
        baseRevision: revision,
        nextRevision: (revision += 1),
        append: text,
      })
    }
    return { fixture, view, frames, delta }
  }

  it('coalesces tokens into one frame without dropping any', () => {
    const { view, frames, delta } = setup()
    const renders = vi.fn()
    view.subscribe(state => state.text, renders)

    for (const token of ['He', 'll', 'o', ',', ' world']) delta(token)

    expect(frames).toHaveLength(1)
    expect(renders).not.toHaveBeenCalled()
    frames.shift()?.()
    expect(renders).toHaveBeenCalledOnce()
    expect(view.getSnapshot().text).toBe('Hello, world')
  })

  it('flushes the final text synchronously on completion', () => {
    const { fixture, view, frames, delta } = setup()
    delta('partial')
    fixture.emit('message.completed', 'msg-1', {
      messageId: 'msg-1',
      revision: 3,
      status: 'complete',
    })

    expect(frames).toHaveLength(0)
    expect(view.getSnapshot()).toMatchObject({
      text: 'partial',
      status: 'complete',
      announcement: 'Response complete',
    })
  })

  it('announces status changes, not tokens', () => {
    const { view, frames, delta } = setup()
    const announcements = vi.fn()
    view.subscribe(state => state.announcement, announcements)
    delta('a')
    frames.shift()?.()
    delta('b')
    frames.shift()?.()
    expect(announcements).not.toHaveBeenCalled()
  })
})

describe('ai2-205 · timeline follow and anchors', () => {
  const metrics = (scrollTop: number, contentHeight = 2000) => ({
    scrollTop,
    viewportHeight: 500,
    contentHeight,
  })

  function layout(ids: string[], heights: Record<string, number> = {}) {
    const map = new Map<string, { top: number; height: number }>()
    let top = 0
    for (const id of ids) {
      const height = heights[id] ?? 100
      map.set(id, { top, height })
      top += height
    }
    return { map, height: top }
  }

  it('leaves follow when the user scrolls up and never pulls them back', () => {
    const ids = Array.from({ length: 20 }, (_, i) => `m${i}`)
    const timeline = createTimelineController({ initialItemIds: ids })
    timeline.setLayout(layout(ids).map)

    timeline.onScroll(metrics(300), true)
    expect(timeline.getSnapshot()).toMatchObject({
      following: false,
      anchor: { itemId: 'm3', offset: 0 },
      showJumpToLatest: true,
    })

    // 500 tokens later the last message is much taller; the anchor holds.
    const grown = layout(ids, { m19: 5000 })
    timeline.setLayout(grown.map)
    expect(
      timeline.scrollCorrection(metrics(300, grown.height)),
    ).toBeUndefined()
  })

  it('keeps the reading position when older history is prepended', () => {
    const tall = (list: string[]) =>
      layout(list, Object.fromEntries(list.map(id => [id, 400])))
    const ids = ['m10', 'm11', 'm12']
    const timeline = createTimelineController({ initialItemIds: ids })
    timeline.setLayout(tall(ids).map)
    timeline.onScroll(metrics(450, 1200), true)
    expect(timeline.getSnapshot().anchor).toEqual({ itemId: 'm11', offset: 50 })

    const withHistory = ['m7', 'm8', 'm9', ...ids]
    timeline.setItems(withHistory)
    timeline.setLayout(tall(withHistory).map)

    // m11 moved down by 1200px; the correction keeps it where it was read.
    expect(timeline.scrollCorrection(metrics(450, 2400))).toBe(1650)
    expect(timeline.getSnapshot().unreadCount).toBe(0)
  })

  it('counts new messages while away and jumps back on request', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f']
    const timeline = createTimelineController({ initialItemIds: ids })
    timeline.setLayout(layout(ids).map)
    timeline.onScroll(metrics(0, 600), true)

    timeline.setItems([...ids, 'g', 'h'])
    expect(timeline.getSnapshot().unreadCount).toBe(2)

    timeline.jumpToLatest()
    expect(timeline.getSnapshot()).toMatchObject({
      following: true,
      unreadCount: 0,
    })
    expect(timeline.scrollCorrection(metrics(0, 800))).toBe(300)
  })

  it('treats a scroll near the bottom as following, scaled to the viewport', () => {
    const timeline = createTimelineController()
    timeline.onScroll(metrics(1470), true)
    expect(timeline.getSnapshot().following).toBe(true)
    timeline.onScroll(metrics(1400), true)
    expect(timeline.getSnapshot().following).toBe(false)
  })

  it('does not follow in never mode, even when at the bottom', () => {
    const timeline = createTimelineController({ follow: 'never' })
    timeline.onScroll(metrics(1500), true)
    expect(timeline.getSnapshot().following).toBe(false)
  })
})

describe('ai2-205 / ai2-508 · windowed timeline', () => {
  const ids = Array.from({ length: 100 }, (_, i) => `m${i}`)
  const metrics = (scrollTop: number) => ({
    scrollTop,
    viewportHeight: 500,
    contentHeight: 10_000,
  })

  it('renders only the visible range plus overscan, anchored at the bottom while following', async () => {
    const timeline = createTimelineController({
      initialItemIds: [],
      virtualize: { threshold: 10, estimatedItemHeight: 100, overscan: 2 },
    })
    timeline.setItems(ids)
    timeline.onScroll(metrics(9500), false)
    await Promise.resolve()

    const range = timeline.getSnapshot().range!
    expect(range.end).toBe(100)
    expect(range.start).toBe(93)
    expect(range.segments[0]).toEqual({ kind: 'pad', height: 9300 })
  })

  it('moves the window with the scroll position and keeps a pinned item', async () => {
    const timeline = createTimelineController({
      initialItemIds: [],
      virtualize: { threshold: 10, estimatedItemHeight: 100, overscan: 2 },
    })
    timeline.setItems(ids)
    timeline.pin('m95')
    timeline.onScroll(metrics(1000), true)
    await Promise.resolve()

    const range = timeline.getSnapshot().range!
    expect(range.start).toBe(8)
    expect(range.end).toBe(17)
    expect(range.segments).toContainEqual({ kind: 'items', start: 95, end: 96 })
  })

  it('stays off below the threshold', () => {
    const timeline = createTimelineController({
      initialItemIds: ['a', 'b'],
      virtualize: {},
    })
    timeline.setItems(['a', 'b', 'c'])
    expect(timeline.getSnapshot().range).toBeUndefined()
  })
})
