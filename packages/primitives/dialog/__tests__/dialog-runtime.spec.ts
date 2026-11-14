import type { DialogElement } from '../src'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

const workspaceRoot = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../../..')
const distPath = resolve(
  workspaceRoot,
  'packages/primitives/dialog/dist/wc/auto.js',
)

interface RuntimeDialog extends DialogElement {
  componentOnReady: () => Promise<RuntimeDialog>
}

function nextRender(): Promise<void> {
  return Promise.resolve()
    .then(() => Promise.resolve())
    .then(() => new Promise(resolve => setTimeout(resolve, 0)))
}

/**
 * Builds an *uncontrolled* dialog that starts open.
 *
 * `defaultOpen`, not `open`. Writing `open` before the element upgrades makes
 * it a controlled dialog — the owner has taken responsibility for the value —
 * and a controlled dialog that ignores `open-change` is supposed to stay
 * open. The earlier version of this helper wrote `open = true`, which only
 * looked like "open a dialog" because the component used to overwrite a
 * controlled prop it had written to itself.
 */
async function createDialog(
  parent: HTMLElement = document.body,
  titleText = 'Settings',
): Promise<RuntimeDialog> {
  await Promise.all([
    customElements.whenDefined('zw-dialog'),
    customElements.whenDefined('zw-dialog-content'),
    customElements.whenDefined('zw-dialog-overlay'),
    customElements.whenDefined('zw-dialog-title'),
  ])

  const dialog = document.createElement('zw-dialog') as RuntimeDialog
  dialog.setAttribute('default-open', '')
  parent.append(dialog)
  // Wait for the root projection before adding lazy child elements; otherwise
  // its initial light-DOM render can disconnect them while they are loading.
  await dialog.componentOnReady()

  const overlay = document.createElement('zw-dialog-overlay') as HTMLElement & {
    componentOnReady?: () => Promise<unknown>
  }
  const content = document.createElement('zw-dialog-content') as HTMLElement & {
    componentOnReady?: () => Promise<unknown>
  }
  dialog.append(overlay, content)
  await Promise.all([
    overlay.componentOnReady?.(),
    content.componentOnReady?.(),
  ])

  const title = document.createElement('zw-dialog-title') as HTMLElement & {
    componentOnReady?: () => Promise<unknown>
  }
  title.textContent = titleText
  const button = document.createElement('button')
  button.textContent = 'Inside'
  content.append(title, button)
  await title.componentOnReady?.()
  await nextRender()
  return dialog
}

beforeAll(async () => {
  /*
   * jsdom has no layout, so `getClientRects()` returns an empty list for every
   * element. The component uses it to skip controls that are not rendered —
   * correct in a browser, and fatal for any jsdom test that focuses one. The
   * stub reports every element as having a box, which is what a browser says
   * for anything that is not `display: none` or inside a hidden ancestor.
   *
   * This is a stub for the *test environment*, not for the component: the
   * browser gate (`check:dialog-interaction`) runs the same logic against real
   * layout on three engines.
   */
  Element.prototype.getClientRects = function getClientRects() {
    return [{ width: 1, height: 1 } as DOMRect] as unknown as DOMRectList
  }
  await import(distPath)
})

afterEach(async () => {
  document.body.replaceChildren()
  await nextRender()
})

describe('dialog runtime accessibility', () => {
  it('closes exactly once when a pointer goes down outside the panel', async () => {
    const dialog = await createDialog()
    const changes = vi.fn()
    dialog.addEventListener('open-change', changes)

    document.body.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true }),
    )
    await nextRender()

    expect(dialog.getAttribute('data-state')).toBe('closed')
    expect(changes).toHaveBeenCalledTimes(1)
    expect((changes.mock.calls[0][0] as CustomEvent).detail.open).toBe(false)
  })

  it('keeps the dialog open for pointer events inside the panel', async () => {
    const dialog = await createDialog()
    const changes = vi.fn()
    dialog.addEventListener('open-change', changes)

    dialog
      .querySelector('button')
      ?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await nextRender()

    expect(dialog.getAttribute('data-state')).toBe('open')
    expect(changes).not.toHaveBeenCalled()
  })

  it('honors close-on-outside-click=false', async () => {
    const dialog = await createDialog()
    const changes = vi.fn()
    dialog.closeOnOutsideClick = false
    dialog.addEventListener('open-change', changes)

    document.body.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true }),
    )
    await nextRender()

    expect(dialog.getAttribute('data-state')).toBe('open')
    expect(changes).not.toHaveBeenCalled()
  })

  it('exposes an overlay element for backdrop styling', async () => {
    const dialog = await createDialog()
    const overlay = dialog.querySelector('zw-dialog-overlay')

    expect(overlay).not.toBeNull()
  })

  it('keeps focus and Escape scoped to the nested dialog', async () => {
    const outer = await createDialog(document.body, 'Outer')
    const outerContent = outer.querySelector<HTMLElement>(
      '[data-slot="dialog-content"]',
    )!
    const nested = await createDialog(outerContent, 'Nested')
    const nestedContent = nested.querySelector<HTMLElement>(
      '[data-slot="dialog-content"]',
    )!
    const first = nestedContent.querySelector<HTMLButtonElement>('button')!
    const second = document.createElement('button')
    second.textContent = 'Second'
    nestedContent.append(second)
    await nextRender()

    second.focus()
    second.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
        cancelable: true,
      }),
    )
    expect(document.activeElement).toBe(first)

    first.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      }),
    )
    await nextRender()

    expect(nested.getAttribute('data-state')).toBe('closed')
    expect(outer.getAttribute('data-state')).toBe('open')
  })
})
