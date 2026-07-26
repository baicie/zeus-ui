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
})
