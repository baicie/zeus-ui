interface ZeusReadyElement extends HTMLElement {
  componentOnReady?: () => Promise<HTMLElement>
}

function waitForNewZeusElements(
  root: ParentNode,
  waitedElements: Set<ZeusReadyElement>,
): Promise<void> {
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

  return Promise.all(
    pendingElements.map(element => {
      const componentOnReady = element.componentOnReady

      return componentOnReady ? componentOnReady.call(element) : element
    }),
  ).then(() => waitForNewZeusElements(root, waitedElements))
}

export function waitForZeusElements(
  root: ParentNode = globalThis.document,
): Promise<void> {
  return waitForNewZeusElements(root, new Set())
}
