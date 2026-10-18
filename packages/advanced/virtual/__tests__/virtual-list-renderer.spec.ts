// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import { createDomVirtualListRenderer, createVirtualizer } from '../src/core'

function createItems(
  count: number,
  estimateSize: number,
  scrollOffset: number,
  viewportSize: number,
  overscan: number,
) {
  const virtualizer = createVirtualizer({
    count,
    estimateSize,
    overscan,
  })

  const range = virtualizer.getRange(scrollOffset, viewportSize)
  return { range, items: virtualizer.getItems(range) }
}

describe('virtual list renderer', () => {
  it('mounts only the supplied 100k range and keeps DOM bounded by viewport and overscan', () => {
    globalThis.document.body.innerHTML = '<div id="items"></div>'
    const container = globalThis.document.querySelector('#items')!
    const disposedKeys: string[] = []
    const renderer = createDomVirtualListRenderer({
      container,
      createNode: () => globalThis.document.createElement('div'),
      updateNode(node, item) {
        const element = node as HTMLElement
        element.dataset.index = String(item.index)
        element.textContent = `Item ${item.index}`
      },
      disposeNode(_node, item) {
        disposedKeys.push(item.key)
      },
    })

    const first = createItems(100_000, 20, 0, 200, 4)
    const firstResult = renderer.render(first.items)

    expect(firstResult.items).toHaveLength(14)
    expect(renderer.getMountedCount()).toBe(14)
    expect(container.children).toHaveLength(14)
    expect(renderer.getMountedItems()[0].index).toBe(first.range.overscanStart)
    const mountedItems = renderer.getMountedItems()
    expect(mountedItems[mountedItems.length - 1]?.index).toBe(
      first.range.overscanEnd,
    )

    const retained = renderer.getNode(first.items[5].key)
    const adjacent = createItems(100_000, 20, 100, 200, 4)
    renderer.render(adjacent.items)

    expect(renderer.getMountedCount()).toBe(adjacent.items.length)
    expect(container.children).toHaveLength(adjacent.items.length)
    expect(renderer.getMountedCount()).toBeLessThan(100_000)
    expect(renderer.getNode(first.items[5].key)).toBe(retained)
    expect(disposedKeys).toContain(first.items[0].key)

    const middle = createItems(100_000, 20, 50_000, 200, 4)
    renderer.render(middle.items)
    expect(renderer.getMountedCount()).toBe(middle.items.length)
    expect(container.children).toHaveLength(middle.items.length)

    const narrow = createItems(100_000, 20, 1_000_000, 100, 0)
    renderer.render(narrow.items)

    expect(renderer.getMountedCount()).toBe(5)
    expect(container.children).toHaveLength(5)
    expect(renderer.getMountedItems().map(item => item.index)).toEqual(
      narrow.items.map(item => item.index),
    )

    renderer.dispose()
    expect(container.children).toHaveLength(0)
    expect(renderer.getMountedCount()).toBe(0)
    expect(disposedKeys.length).toBeGreaterThan(first.items.length)
    expect(() => renderer.render(narrow.items)).toThrow('disposed')
  })

  it('rejects duplicate keys before changing the mounted DOM', () => {
    globalThis.document.body.innerHTML = '<div id="items"></div>'
    const container = globalThis.document.querySelector('#items')!
    const renderer = createDomVirtualListRenderer({
      container,
      createNode: () => globalThis.document.createElement('div'),
      updateNode() {},
    })

    const initial = createItems(10, 20, 0, 40, 0).items
    renderer.render(initial)
    const before = [...container.children]

    expect(() =>
      renderer.render([
        initial[0],
        {
          ...initial[1],
          key: initial[0].key,
        },
      ]),
    ).toThrow('duplicate key')
    expect([...container.children]).toEqual(before)
  })

  it('treats Slot as projection only; renderer mounts only items supplied by the range', () => {
    globalThis.document.body.innerHTML =
      '<div id="items"><span data-slotted="true">projected</span></div>'
    const container = globalThis.document.querySelector('#items')!
    const renderer = createDomVirtualListRenderer({
      container,
      createNode: () => globalThis.document.createElement('div'),
      updateNode(node, item) {
        const element = node as HTMLElement
        element.dataset.index = String(item.index)
      },
    })

    const items = createItems(100_000, 20, 0, 40, 1).items
    renderer.render(items)

    expect(container.querySelector('[data-slotted]')).toBeTruthy()
    expect(renderer.getMountedCount()).toBe(3)
    expect(container.querySelectorAll('[data-index]')).toHaveLength(3)
    expect(container.children).toHaveLength(4)
  })

  it('reorders stable keyed nodes without replacing their identities', () => {
    globalThis.document.body.innerHTML = '<div id="items"></div>'
    const container = globalThis.document.querySelector('#items')!
    const renderer = createDomVirtualListRenderer({
      container,
      createNode: () => globalThis.document.createElement('div'),
      updateNode(node, item) {
        const element = node as HTMLElement
        element.dataset.key = item.key
      },
    })
    const items = createItems(10, 20, 0, 60, 0).items
    const original = renderer.render(items)
    const reordered = [items[2], items[0], items[1]]

    renderer.render(reordered)

    expect(
      [...container.children].map(node => node.getAttribute('data-key')),
    ).toEqual(reordered.map(item => item.key))
    expect(renderer.getMountedNodes()).toEqual([
      original.nodes[2],
      original.nodes[0],
      original.nodes[1],
    ])
  })
})
