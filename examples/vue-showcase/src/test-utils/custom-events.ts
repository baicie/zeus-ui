import type { VueWrapper } from '@vue/test-utils'

export function dispatchZeusEvent(
  element: Element,
  name: string,
  detail: Record<string, unknown> = {},
): void {
  element.dispatchEvent(
    new CustomEvent(name, {
      bubbles: true,
      composed: true,
      detail,
    }),
  )
}

export async function emitZeusEvent(
  wrapper: VueWrapper,
  selector: string,
  name: string,
  detail: Record<string, unknown> = {},
): Promise<void> {
  const element = wrapper.get(selector).element

  dispatchZeusEvent(element, name, detail)

  await wrapper.vm.$nextTick()
}

export function findButtonByText(wrapper: VueWrapper, text: string) {
  const button = wrapper
    .findAll('button')
    .find(item => item.text().includes(text))

  if (!button) {
    throw new Error(`Unable to find button containing "${text}".`)
  }

  return button
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
