import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const workspaceRoot = resolve(process.cwd(), '../../..')

beforeAll(async () => {
  const distPath = resolve(
    workspaceRoot,
    'packages/primitives/radio-group/dist/wc/auto.js',
  )
  await import(distPath)
})

function triggerConnectedCallbacks(elements: HTMLElement[]) {
  const promises: Promise<void>[] = []
  for (const el of elements) {
    promises.push((el as any).connectedCallback() as Promise<void>)
  }
  return Promise.all(promises)
}

describe('radio-group primitive', () => {
  it('registers zw-radio-group and zw-radio-group-item custom elements', async () => {
    expect(customElements.get('zw-radio-group')).toBeTypeOf('function')
    expect(customElements.get('zw-radio-group-item')).toBeTypeOf('function')
  })

  it('does not throw when a radio group and items are in the DOM together', async () => {
    document.body.innerHTML = `
      <zw-radio-group default-value="large" name="size">
        <zw-radio-group-item value="small">Small</zw-radio-group-item>
        <zw-radio-group-item value="large">Large</zw-radio-group-item>
      </zw-radio-group>
    `

    await customElements.whenDefined('zw-radio-group-item')
    await customElements.whenDefined('zw-radio-group')

    const group = document.querySelector<HTMLElement>('zw-radio-group')!
    const items = Array.from(
      document.querySelectorAll<HTMLElement>('zw-radio-group-item'),
    )

    // Initialize items (with fallback context), then group, then re-init items
    // to pick up DOM context bridge from group.
    await triggerConnectedCallbacks(items)
    await triggerConnectedCallbacks([group])
    await triggerConnectedCallbacks(items)

    // DOM structure should be intact after all init cycles
    expect(group).toBeTruthy()
    expect(items).toHaveLength(2)
    expect(items[0].textContent?.trim()).toBe('Small')
    expect(items[1].textContent?.trim()).toBe('Large')
  })

  it('does not throw when a radio item is rendered without a group', async () => {
    document.body.innerHTML = `<zw-radio-group-item value="orphan">Orphan</zw-radio-group-item>`

    await customElements.whenDefined('zw-radio-group-item')

    const item = document.querySelector<HTMLElement>('zw-radio-group-item')!

    // Should not throw during initialization - uses fallback context
    await triggerConnectedCallbacks([item])

    expect(item).toBeTruthy()
    expect(item.getAttribute('value')).toBe('orphan')
  })

  it('does not throw when item has no value attribute', async () => {
    document.body.innerHTML = `<zw-radio-group-item>No value</zw-radio-group-item>`

    await customElements.whenDefined('zw-radio-group-item')

    const item = document.querySelector<HTMLElement>('zw-radio-group-item')!
    await triggerConnectedCallbacks([item])

    expect(item).toBeTruthy()
  })
})
