import { describe, expect, it, vi } from 'vitest'

import { createRafScheduler } from '../src/core'

describe('createRafScheduler', () => {
  it('coalesces multiple scheduled callbacks into one frame', () => {
    const queued: FrameRequestCallback[] = []
    const cancelFrame = vi.fn()

    const scheduler = createRafScheduler({
      requestFrame(callback) {
        queued.push(callback)
        return queued.length
      },
      cancelFrame,
    })

    const first = vi.fn()
    const second = vi.fn()

    scheduler.schedule(first)
    scheduler.schedule(second)

    expect(scheduler.isScheduled()).toBe(true)
    expect(queued).toHaveLength(1)

    queued[0](0)

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
    expect(scheduler.isScheduled()).toBe(false)
  })

  it('flushes the queued callback synchronously', () => {
    const callback = vi.fn()
    const cancelFrame = vi.fn()

    const scheduler = createRafScheduler({
      requestFrame() {
        return 1
      },
      cancelFrame,
    })

    scheduler.schedule(callback)
    scheduler.flush()

    expect(cancelFrame).toHaveBeenCalledWith(1)
    expect(callback).toHaveBeenCalledTimes(1)
    expect(scheduler.isScheduled()).toBe(false)
  })

  it('cancels the queued callback', () => {
    const callback = vi.fn()
    const cancelFrame = vi.fn()

    const scheduler = createRafScheduler({
      requestFrame() {
        return 1
      },
      cancelFrame,
    })

    scheduler.schedule(callback)
    scheduler.cancel()
    scheduler.flush()

    expect(cancelFrame).toHaveBeenCalledWith(1)
    expect(callback).not.toHaveBeenCalled()
    expect(scheduler.isScheduled()).toBe(false)
  })
})
