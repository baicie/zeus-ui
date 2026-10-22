interface ZeusReadyElement extends HTMLElement {
  componentOnReady?: () => Promise<HTMLElement>
}

const COMPONENT_READY_TIMEOUT_MS = 1000
const ELEMENT_READY_SWEEP_TIMEOUT_MS = 1000

function isDisconnectedBeforeReady(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.startsWith('[ZEUS_WC_DISCONNECTED_BEFORE_READY]')
  )
}

function waitForComponent(
  element: ZeusReadyElement,
): Promise<ZeusReadyElement> {
  const componentOnReady = element.componentOnReady
  if (!componentOnReady) return Promise.resolve(element)

  const ready = Promise.resolve(componentOnReady.call(element)).catch(error => {
    // Parent custom elements can replace child nodes while the child is still
    // initializing. The child is no longer part of the rendered tree, so its
    // readiness rejection is safe to ignore here.
    if (isDisconnectedBeforeReady(error)) return element
    throw error
  })
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<ZeusReadyElement>((resolve, reject) => {
    timeoutId = setTimeout(() => {
      if (element.isConnected) {
        reject(
          new Error(
            `[ZEUS_TEST_READY_TIMEOUT] ${element.tagName} did not become ready`,
          ),
        )
      } else {
        resolve(element)
      }
    }, COMPONENT_READY_TIMEOUT_MS)
  })
  const clearReadyTimeout = () => {
    if (timeoutId !== undefined) clearTimeout(timeoutId)
  }
  return Promise.race([ready, timeout]).then(
    value => {
      clearReadyTimeout()
      return value
    },
    error => {
      clearReadyTimeout()
      throw error
    },
  )
}

function waitForNewZeusElements(
  root: ParentNode,
  waitedElements: Set<ZeusReadyElement>,
  deadline = Date.now() + ELEMENT_READY_SWEEP_TIMEOUT_MS,
): Promise<void> {
  if (Date.now() >= deadline) return Promise.resolve()
  const pendingElements = Array.from(
    root.querySelectorAll<ZeusReadyElement>('*'),
  ).filter(element => {
    return (
      element.tagName.indexOf('ZW-') === 0 &&
      typeof element.componentOnReady === 'function' &&
      !waitedElements.has(element)
    )
  })

  if (pendingElements.length === 0) return Promise.resolve()

  pendingElements.forEach(element => waitedElements.add(element))

  return Promise.all(pendingElements.map(waitForComponent)).then(() =>
    waitForNewZeusElements(root, waitedElements, deadline),
  )
}

export function waitForZeusElements(
  root: ParentNode = globalThis.document,
): Promise<void> {
  return waitForNewZeusElements(root, new Set())
}
