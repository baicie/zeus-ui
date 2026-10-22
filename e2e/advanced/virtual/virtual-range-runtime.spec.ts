import type { ChatThreadElement } from '../../../packages/advanced/chat/src/components/chat-thread'
import type { VirtualListElement } from '../../../packages/advanced/virtual/src/components/virtual-list'

import { afterEach, describe, expect, it } from 'vitest'

import { ChatThread } from '../../../packages/advanced/chat/src/components/chat-thread'
import { VirtualList } from '../../../packages/advanced/virtual/src/components/virtual-list'

interface RangeElement extends HTMLElement {
  count: number
  estimateSize: number
  virtual?: boolean
  scrollToOffset: VirtualListElement['scrollToOffset']
  getRange: VirtualListElement['getRange'] | ChatThreadElement['getRange']
}

afterEach(() => {
  document.body.replaceChildren()
})

describe.each([
  ['zw-virtual-list', VirtualList],
  ['zw-chat-thread', ChatThread],
] as const)('%s range DOM metadata', (tag, Definition) => {
  it('updates range attributes on the existing item container when scrolled', () => {
    if (!customElements.get(tag)) customElements.define(tag, Definition)
    const element = document.createElement(tag) as RangeElement
    element.count = 100
    element.estimateSize = 20
    element.virtual = true
    document.body.append(element)

    const viewport = element.querySelector<HTMLElement>('[part="viewport"]')!
    const items = element.querySelector<HTMLElement>('[part="items"]')!
    Object.defineProperty(viewport, 'clientHeight', {
      configurable: true,
      value: 100,
    })

    for (const offset of [200, 400, 0]) {
      element.scrollToOffset(offset)
      const range = element.getRange()
      expect(element.querySelector('[part="items"]')).toBe(items)
      expect(items.getAttribute('data-range-start')).toBe(String(range.start))
      expect(items.getAttribute('data-range-end')).toBe(String(range.end))
      expect(items.getAttribute('data-overscan-start')).toBe(
        String(range.overscanStart),
      )
      expect(items.getAttribute('data-overscan-end')).toBe(
        String(range.overscanEnd),
      )
    }
  })
})
