import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

const workspaceRoot = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../../..')
const distPath = resolve(
  workspaceRoot,
  'packages/primitives/dropdown-menu/dist/wc/auto.js',
)

interface RuntimeElement extends HTMLElement {
  componentOnReady?: () => Promise<unknown>
}

interface RuntimeDropdownMenu extends RuntimeElement {
  open?: boolean
}

function nextRender(): Promise<void> {
  return Promise.resolve()
    .then(() => Promise.resolve())
    .then(() => new Promise(resolve => setTimeout(resolve, 0)))
}

async function createMenu(): Promise<RuntimeDropdownMenu> {
  await Promise.all([
    customElements.whenDefined('zw-dropdown-menu'),
    customElements.whenDefined('zw-dropdown-menu-trigger'),
    customElements.whenDefined('zw-dropdown-menu-content'),
    customElements.whenDefined('zw-dropdown-menu-item'),
  ])

  const menu = document.createElement('zw-dropdown-menu') as RuntimeDropdownMenu
  menu.innerHTML = [
    '<zw-dropdown-menu-trigger>Open menu</zw-dropdown-menu-trigger>',
    '<zw-dropdown-menu-content>',
    '<zw-dropdown-menu-item value="disabled" disabled>Disabled</zw-dropdown-menu-item>',
    '<zw-dropdown-menu-item value="first">First</zw-dropdown-menu-item>',
    '<zw-dropdown-menu-item value="second">Second</zw-dropdown-menu-item>',
    '</zw-dropdown-menu-content>',
  ].join('')
  document.body.append(menu)

  await menu.componentOnReady?.()
  const elements = [...menu.querySelectorAll<RuntimeElement>('*')]
  await Promise.all(elements.map(element => element.componentOnReady?.()))
  await nextRender()
  return menu
}

function getTrigger(menu: RuntimeDropdownMenu): HTMLButtonElement {
  const trigger = menu.querySelector<HTMLButtonElement>(
    'zw-dropdown-menu-trigger button',
  )
  if (!trigger) throw new Error('Expected the native menu trigger button.')
  return trigger
}

function getItem(menu: RuntimeDropdownMenu, value: string): HTMLElement {
  const item = menu.querySelector<HTMLElement>(
    `zw-dropdown-menu-item[value="${value}"]`,
  )
  if (!item) throw new Error(`Expected menu item "${value}".`)
  return item
}

function dispatchKey(target: HTMLElement, key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
  })
  target.dispatchEvent(event)
  return event
}

beforeAll(() => import(distPath))

afterEach(async () => {
  document.body.replaceChildren()
  await nextRender()
})

describe('dropdown menu keyboard behavior', () => {
  it('keeps menu items out of tab order and wraps arrow navigation', async () => {
    const menu = await createMenu()
    const trigger = getTrigger(menu)
    const disabled = getItem(menu, 'disabled')
    const first = getItem(menu, 'first')
    const second = getItem(menu, 'second')

    /* eslint-disable antfu/consistent-list-newline */
    expect([disabled.tabIndex, first.tabIndex, second.tabIndex]).toEqual([
      -1, -1, -1,
    ])
    /* eslint-enable antfu/consistent-list-newline */

    trigger.click()
    await nextRender()
    expect(document.activeElement).toBe(first)

    dispatchKey(first, 'ArrowDown')
    expect(document.activeElement).toBe(second)
    dispatchKey(second, 'ArrowDown')
    expect(document.activeElement).toBe(first)
    dispatchKey(first, 'ArrowUp')
    expect(document.activeElement).toBe(second)

    dispatchKey(second, 'Home')
    expect(document.activeElement).toBe(first)
    dispatchKey(first, 'End')
    expect(document.activeElement).toBe(second)

    const escape = dispatchKey(second, 'Escape')
    await nextRender()
    expect(escape.defaultPrevented).toBe(true)
    expect(menu.open).toBe(false)
    expect(document.activeElement).toBe(trigger)
  })

  it('focuses the first enabled item when open changes externally', async () => {
    const menu = await createMenu()
    const first = getItem(menu, 'first')

    menu.open = true
    await nextRender()

    expect(document.activeElement).toBe(first)
  })

  it('opens from default-open and closes again from its trigger', async () => {
    const menu = document.createElement(
      'zw-dropdown-menu',
    ) as RuntimeDropdownMenu
    menu.setAttribute('default-open', '')
    menu.innerHTML = [
      '<zw-dropdown-menu-trigger>Open menu</zw-dropdown-menu-trigger>',
      '<zw-dropdown-menu-content><zw-dropdown-menu-item value="first">First</zw-dropdown-menu-item></zw-dropdown-menu-content>',
    ].join('')
    document.body.append(menu)
    await menu.componentOnReady?.()
    await Promise.all(
      [...menu.querySelectorAll<RuntimeElement>('*')].map(element =>
        element.componentOnReady?.(),
      ),
    )
    await nextRender()

    expect(menu.querySelector('[role="menu"]')).not.toHaveAttribute('hidden')
    getTrigger(menu).click()
    await nextRender()
    expect(menu.querySelector('[role="menu"]')).toHaveAttribute('hidden')
  })

  it('keeps an explicitly closed menu closed when default-open is also set', async () => {
    const menu = document.createElement(
      'zw-dropdown-menu',
    ) as RuntimeDropdownMenu
    menu.open = false
    menu.setAttribute('default-open', '')
    menu.innerHTML =
      '<zw-dropdown-menu-content>Content</zw-dropdown-menu-content>'
    document.body.append(menu)
    await menu.componentOnReady?.()
    await Promise.all(
      [...menu.querySelectorAll<RuntimeElement>('*')].map(element =>
        element.componentOnReady?.(),
      ),
    )
    await nextRender()

    expect(menu.querySelector('[role="menu"]')).toHaveAttribute('hidden')
  })

  it('opens from trigger arrow keys and focuses the matching edge item', async () => {
    const menu = await createMenu()
    const trigger = getTrigger(menu)
    const first = getItem(menu, 'first')
    const second = getItem(menu, 'second')

    trigger.focus()
    const down = dispatchKey(trigger, 'ArrowDown')
    await nextRender()
    expect(down.defaultPrevented).toBe(true)
    expect(menu.open).toBe(true)
    expect(document.activeElement).toBe(first)

    dispatchKey(first, 'Escape')
    await nextRender()
    trigger.focus()
    dispatchKey(trigger, 'ArrowUp')
    await nextRender()
    expect(menu.open).toBe(true)
    expect(document.activeElement).toBe(second)
  })

  it('returns focus to the trigger after selecting an item', async () => {
    const menu = await createMenu()
    const trigger = getTrigger(menu)
    const second = getItem(menu, 'second')
    const selected = vi.fn()
    menu.addEventListener('select', selected)

    trigger.click()
    await nextRender()
    second.click()

    await nextRender()

    expect(selected).toHaveBeenCalledTimes(1)
    expect(
      (selected.mock.calls[0][0] as CustomEvent<{ value?: string }>).detail
        .value,
    ).toBe('second')
    expect(menu.open).toBe(false)
    expect(document.activeElement).toBe(trigger)
  })
})
