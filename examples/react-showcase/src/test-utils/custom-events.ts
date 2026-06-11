import { act, fireEvent, screen } from '@testing-library/react'

export function dispatchZeusEvent(
  element: Element,
  name: string,
  detail: Record<string, unknown> = {},
): void {
  act(() => {
    fireEvent(
      element,
      new CustomEvent(name, {
        bubbles: true,
        composed: true,
        detail,
      }),
    )
  })
}

export function getCustomElementByText(
  text: string | RegExp,
  tagName: string,
): Element {
  const node = screen.getByText(text)
  const element = node.closest(tagName)

  if (!element) {
    throw new Error(`Unable to find ${tagName} closest to ${String(text)}.`)
  }

  return element
}

export function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined)

  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText,
    },
  })

  return writeText
}
