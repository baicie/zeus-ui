import { describe, expect, it, vi } from 'vitest'

import { createDataGridHostAdapter } from '../src/components/host-adapter'

function createHarness() {
  const viewport = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    getClientSize: vi.fn(() => ({ height: 0, width: 0 })),
  }
  const scheduler = {
    cancel: vi.fn(),
  }
  const renderer = {
    clear: vi.fn(),
  }

  return { viewport, scheduler, renderer }
}

describe('createDataGridHostAdapter', () => {
  it('connects one viewport once and reconnects after a host disconnect', () => {
    const harness = createHarness()
    const adapter = createDataGridHostAdapter({
      viewportController: harness.viewport,
      scheduler: harness.scheduler,
      renderer: harness.renderer,
    })
    const first = {} as HTMLElement
    const second = {} as HTMLElement

    adapter.connect(first)
    adapter.connect(first)

    expect(harness.viewport.connect).toHaveBeenCalledTimes(1)
    expect(adapter.isConnected()).toBe(true)

    adapter.connect(second)

    expect(harness.viewport.disconnect).toHaveBeenCalledTimes(1)
    expect(harness.scheduler.cancel).toHaveBeenCalledTimes(1)
    expect(harness.renderer.clear).toHaveBeenCalledTimes(1)
    expect(harness.viewport.connect).toHaveBeenLastCalledWith(second)
    expect(adapter.isConnected()).toBe(true)

    adapter.disconnect()

    expect(harness.viewport.disconnect).toHaveBeenCalledTimes(2)
    expect(harness.scheduler.cancel).toHaveBeenCalledTimes(2)
    expect(harness.renderer.clear).toHaveBeenCalledTimes(2)
    expect(adapter.isConnected()).toBe(false)
  })

  it('runs every disconnect cleanup and rethrows the first failure', () => {
    const harness = createHarness()
    const viewportError = new Error('viewport failed')
    const schedulerError = new Error('scheduler failed')
    const rendererError = new Error('renderer failed')
    harness.viewport.disconnect.mockImplementation(() => {
      throw viewportError
    })
    harness.scheduler.cancel.mockImplementation(() => {
      throw schedulerError
    })
    harness.renderer.clear.mockImplementation(() => {
      throw rendererError
    })
    const adapter = createDataGridHostAdapter({
      viewportController: harness.viewport,
      scheduler: harness.scheduler,
      renderer: harness.renderer,
    })

    adapter.connect({} as HTMLElement)

    expect(() => adapter.disconnect()).toThrow(viewportError)
    expect(harness.scheduler.cancel).toHaveBeenCalledTimes(1)
    expect(harness.renderer.clear).toHaveBeenCalledTimes(1)
    expect(adapter.isConnected()).toBe(false)
  })

  it('does not require a renderer for a native-only host', () => {
    const harness = createHarness()
    const adapter = createDataGridHostAdapter({
      viewportController: harness.viewport,
      scheduler: harness.scheduler,
    })

    adapter.connect({} as HTMLElement)
    adapter.disconnect()

    expect(harness.viewport.disconnect).toHaveBeenCalledTimes(1)
    expect(harness.renderer.clear).not.toHaveBeenCalled()
  })
})
