import { describe, expect, it, vi } from 'vitest'

import { createDataGridRangeUpdateScheduler } from '../src/core'

describe('createDataGridRangeUpdateScheduler', () => {
  it('coalesces updates and keeps measurement work', () => {
    let frame: (() => void) | undefined
    const commit = vi.fn()
    const scheduler = createDataGridRangeUpdateScheduler({
      requestFrame: callback => {
        frame = () => callback(0)
        return 1
      },
      cancelFrame: vi.fn(),
      commit,
    })
    const latestScrollEvent = { type: 'scroll', sequence: 2 }

    scheduler.schedule({
      source: 'scroll',
      event: { type: 'scroll', sequence: 1 },
      inputTime: 10,
      measure: false,
      preserve: false,
    })
    scheduler.schedule({
      source: 'resize',
      inputTime: 20,
      measure: true,
      preserve: true,
    })
    scheduler.schedule({
      source: 'scroll',
      event: latestScrollEvent,
      inputTime: 30,
      measure: false,
      preserve: false,
    })
    expect(commit).not.toHaveBeenCalled()

    frame?.()
    expect(commit).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'resize',
        event: latestScrollEvent,
        inputTime: 20,
        measure: true,
        preserve: true,
      }),
    )
  })

  it('flushes a scroll update synchronously and clears queued timing', () => {
    const commit = vi.fn()
    const scheduler = createDataGridRangeUpdateScheduler({
      requestFrame: () => 1,
      cancelFrame: vi.fn(),
      commit,
    })

    scheduler.schedule({
      source: 'data',
      inputTime: 10,
      handlerStartTime: 11,
      handlerEndTime: 12,
      measure: true,
      preserve: false,
    })
    scheduler.clearDiagnosticTiming()
    expect(scheduler.hasPending()).toBe(true)
    scheduler.flush()

    expect(commit).toHaveBeenCalledWith(
      expect.objectContaining({
        inputTime: null,
        handlerStartTime: undefined,
        handlerEndTime: undefined,
      }),
    )
  })

  it('cancels queued commits when the host disconnects', () => {
    const commit = vi.fn()
    const cancelFrame = vi.fn()
    const scheduler = createDataGridRangeUpdateScheduler({
      requestFrame: () => 4,
      cancelFrame,
      commit,
    })

    scheduler.schedule({
      source: 'mount',
      measure: true,
      preserve: false,
    })
    scheduler.cancel()
    scheduler.flush()

    expect(cancelFrame).toHaveBeenCalledWith(4)
    expect(scheduler.hasPending()).toBe(false)
    expect(commit).not.toHaveBeenCalled()
  })
})
