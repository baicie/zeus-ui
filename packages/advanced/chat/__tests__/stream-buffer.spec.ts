import { describe, expect, it, vi } from 'vitest'

import { createStreamBuffer } from '../src/core'

describe('createStreamBuffer', () => {
  it('coalesces chunks into one flush', () => {
    const queued: FrameRequestCallback[] = []
    const onFlush = vi.fn()

    const buffer = createStreamBuffer({
      onFlush,
      requestFrame(callback) {
        queued.push(callback)
        return queued.length
      },
      cancelFrame() {},
    })

    buffer.push('hello')
    buffer.push(' ')
    buffer.push('world')

    expect(buffer.getPendingValue()).toBe('hello world')
    expect(buffer.isScheduled()).toBe(true)
    expect(queued).toHaveLength(1)

    queued[0](0)

    expect(onFlush).toHaveBeenCalledWith('hello world')
    expect(buffer.getPendingValue()).toBe('')
    expect(buffer.isScheduled()).toBe(false)
  })

  it('flushes synchronously', () => {
    const onFlush = vi.fn()
    const cancelFrame = vi.fn()

    const buffer = createStreamBuffer({
      onFlush,
      requestFrame() {
        return 1
      },
      cancelFrame,
    })

    buffer.push('hello')
    buffer.flush()

    expect(cancelFrame).toHaveBeenCalledWith(1)
    expect(onFlush).toHaveBeenCalledWith('hello')
    expect(buffer.isScheduled()).toBe(false)
  })

  it('cancels pending chunks', () => {
    const onFlush = vi.fn()
    const cancelFrame = vi.fn()

    const buffer = createStreamBuffer({
      onFlush,
      requestFrame() {
        return 1
      },
      cancelFrame,
    })

    buffer.push('hello')
    buffer.cancel()
    buffer.flush()

    expect(cancelFrame).toHaveBeenCalledWith(1)
    expect(onFlush).not.toHaveBeenCalled()
    expect(buffer.getPendingValue()).toBe('')
  })

  it('ignores empty chunks', () => {
    const onFlush = vi.fn()

    const buffer = createStreamBuffer({
      onFlush,
      requestFrame() {
        return 1
      },
      cancelFrame() {},
    })

    buffer.push('')

    expect(buffer.isScheduled()).toBe(false)
    expect(buffer.getPendingValue()).toBe('')
  })
})
