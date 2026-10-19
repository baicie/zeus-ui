import type { DataGridViewportResizeObserver } from '../src/components/viewport-controller'

import { describe, expect, it, vi } from 'vitest'

import { createDataGridViewportController } from '../src/components/viewport-controller'

type FakeViewport = Pick<HTMLElement, 'clientHeight' | 'clientWidth'>

function createObserverHarness() {
  const observers: Array<{
    callback: () => void
    disconnect: ReturnType<typeof vi.fn>
    observed: HTMLElement | undefined
  }> = []

  const createResizeObserver = (
    callback: () => void,
  ): DataGridViewportResizeObserver => {
    const observer = {
      callback,
      disconnect: vi.fn(),
      observed: undefined as HTMLElement | undefined,
      observe(element: HTMLElement): void {
        observer.observed = element
      },
    }
    observers.push(observer)
    return observer
  }

  return { createResizeObserver, observers }
}

describe('createDataGridViewportController', () => {
  it('reads dimensions from the connected viewport and forwards resize events', () => {
    const onResize = vi.fn()
    const harness = createObserverHarness()
    const controller = createDataGridViewportController({
      onResize,
      createResizeObserver: harness.createResizeObserver,
    })
    const viewport = {
      clientHeight: 240,
      clientWidth: 640,
    } as FakeViewport as HTMLElement

    controller.connect(viewport)

    expect(controller.getClientSize()).toEqual({ height: 240, width: 640 })
    expect(harness.observers[0].observed).toBe(viewport)

    harness.observers[0].callback()
    expect(onResize).toHaveBeenCalledTimes(1)
  })

  it('does not recreate an observer when connecting the same element twice', () => {
    const harness = createObserverHarness()
    const controller = createDataGridViewportController({
      onResize: vi.fn(),
      createResizeObserver: harness.createResizeObserver,
    })
    const viewport = {
      clientHeight: 240,
      clientWidth: 640,
    } as FakeViewport as HTMLElement

    controller.connect(viewport)
    controller.connect(viewport)

    expect(harness.observers).toHaveLength(1)
    expect(harness.observers[0].disconnect).not.toHaveBeenCalled()
  })

  it('disconnects the previous observer and ignores stale callbacks on reconnect', () => {
    const onResize = vi.fn()
    const harness = createObserverHarness()
    const controller = createDataGridViewportController({
      onResize,
      createResizeObserver: harness.createResizeObserver,
    })
    const firstViewport = {
      clientHeight: 100,
      clientWidth: 200,
    } as FakeViewport as HTMLElement
    const secondViewport = {
      clientHeight: 300,
      clientWidth: 400,
    } as FakeViewport as HTMLElement

    controller.connect(firstViewport)
    controller.connect(secondViewport)

    expect(harness.observers[0].disconnect).toHaveBeenCalledTimes(1)
    expect(controller.getClientSize()).toEqual({ height: 300, width: 400 })

    harness.observers[0].callback()
    expect(onResize).not.toHaveBeenCalled()

    harness.observers[1].callback()
    expect(onResize).toHaveBeenCalledTimes(1)
  })

  it('disconnects the observer and clears dimensions', () => {
    const onResize = vi.fn()
    const harness = createObserverHarness()
    const controller = createDataGridViewportController({
      onResize,
      createResizeObserver: harness.createResizeObserver,
    })
    const viewport = {
      clientHeight: 120,
      clientWidth: 320,
    } as FakeViewport as HTMLElement

    controller.connect(viewport)
    controller.disconnect()

    expect(harness.observers[0].disconnect).toHaveBeenCalledTimes(1)
    expect(controller.getClientSize()).toEqual({ height: 0, width: 0 })

    harness.observers[0].callback()
    expect(onResize).not.toHaveBeenCalled()
  })

  it('clears a failed observe connection and retries the same element', () => {
    const harness = createObserverHarness()
    let attempt = 0
    const controller = createDataGridViewportController({
      onResize: vi.fn(),
      createResizeObserver: callback => {
        const observer = harness.createResizeObserver(callback)
        attempt += 1

        if (attempt === 1) {
          return {
            observe: () => {
              throw new Error('observe failed')
            },
            disconnect: observer.disconnect,
          }
        }

        return observer
      },
    })
    const viewport = {
      clientHeight: 120,
      clientWidth: 320,
    } as FakeViewport as HTMLElement

    expect(() => controller.connect(viewport)).toThrow('observe failed')
    expect(controller.getClientSize()).toEqual({ height: 0, width: 0 })
    expect(harness.observers[0].disconnect).toHaveBeenCalledTimes(1)

    controller.connect(viewport)

    expect(controller.getClientSize()).toEqual({ height: 120, width: 320 })
    expect(harness.observers).toHaveLength(2)
    expect(harness.observers[1].observed).toBe(viewport)
  })

  it('keeps the viewport connection usable when ResizeObserver is unavailable', () => {
    const controller = createDataGridViewportController({
      onResize: vi.fn(),
      createResizeObserver: undefined,
    })
    const viewport = {
      clientHeight: 80,
      clientWidth: 160,
    } as FakeViewport as HTMLElement

    controller.connect(viewport)

    expect(controller.getClientSize()).toEqual({ height: 80, width: 160 })
  })
})
