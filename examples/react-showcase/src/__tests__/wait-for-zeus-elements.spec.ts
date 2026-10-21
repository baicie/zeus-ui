import { waitForZeusElements } from '../test-utils/wait-for-zeus-elements'

describe('waitForZeusElements', () => {
  it('waits for connected Zeus elements to finish lazy initialization', () => {
    const element = globalThis.document.createElement('zw-test-ready')
    let resolveReady: (value: HTMLElement) => void = () => {}
    const ready = new Promise<HTMLElement>(resolve => {
      resolveReady = resolve
    })
    const componentOnReady = vi.fn(() => ready)

    Object.defineProperty(element, 'componentOnReady', {
      value: componentOnReady,
    })
    globalThis.document.body.append(element)

    let settled = false
    const waiting = waitForZeusElements().then(() => {
      settled = true
    })

    return Promise.resolve()
      .then(() => {
        expect(componentOnReady).toHaveBeenCalledTimes(1)
        expect(settled).toBe(false)
        resolveReady(element)
        return waiting
      })
      .then(() => {
        expect(settled).toBe(true)
        element.remove()
      })
  })

  it('continues when a child reports that it disconnected before ready', async () => {
    const element = globalThis.document.createElement('zw-test-disconnected')
    Object.defineProperty(element, 'componentOnReady', {
      value: vi.fn(() =>
        Promise.reject(
          new Error('[ZEUS_WC_DISCONNECTED_BEFORE_READY] replaced child'),
        ),
      ),
    })
    globalThis.document.body.append(element)

    await expect(waitForZeusElements()).resolves.toBeUndefined()
    element.remove()
  })

  it('fails fast when a connected element never becomes ready', async () => {
    vi.useFakeTimers()
    try {
      const element = globalThis.document.createElement('zw-test-timeout')
      Object.defineProperty(element, 'componentOnReady', {
        value: vi.fn(() => new Promise<HTMLElement>(() => {})),
      })
      globalThis.document.body.append(element)

      const waiting = waitForZeusElements()
      const rejection = expect(waiting).rejects.toThrow(
        '[ZEUS_TEST_READY_TIMEOUT] ZW-TEST-TIMEOUT did not become ready',
      )
      await vi.advanceTimersByTimeAsync(1000)

      await rejection
      element.remove()
    } finally {
      vi.useRealTimers()
    }
  })
})
