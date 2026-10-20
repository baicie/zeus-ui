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

async function createDialog(): Promise<RuntimeDialog> {
  await Promise.all([
    customElements.whenDefined('zw-dialog'),
    customElements.whenDefined('zw-dialog-content'),
    customElements.whenDefined('zw-dialog-overlay'),
    customElements.whenDefined('zw-dialog-title'),
  ])

  const dialog = document.createElement('zw-dialog') as RuntimeDialog
  dialog.innerHTML = [
    '<zw-dialog-overlay></zw-dialog-overlay>',
    '<zw-dialog-content><zw-dialog-title>Settings</zw-dialog-title><button>Inside</button></zw-dialog-content>',
  ].join('')
  dialog.open = true
  document.body.append(dialog)
  const content = dialog.querySelector('zw-dialog-content') as
    | (HTMLElement & { componentOnReady?: () => Promise<unknown> })
    | null
  const overlay = dialog.querySelector('zw-dialog-overlay') as
    | (HTMLElement & { componentOnReady?: () => Promise<unknown> })
    | null
  const title = dialog.querySelector('zw-dialog-title') as
    | (HTMLElement & { componentOnReady?: () => Promise<unknown> })
    | null
  await Promise.all([
    dialog.componentOnReady(),
    content?.componentOnReady?.(),
    overlay?.componentOnReady?.(),
    title?.componentOnReady?.(),
  ])
  await nextRender()
  return dialog
}

beforeAll(() => import(distPath))

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

    expect(dialog.open).toBe(false)
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

    expect(dialog.open).toBe(true)
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

    expect(dialog.open).toBe(true)
    expect(changes).not.toHaveBeenCalled()
  })

  it('exposes an overlay element for backdrop styling', async () => {
    const dialog = await createDialog()
    const overlay = dialog.querySelector('zw-dialog-overlay')

    expect(overlay).not.toBeNull()
  })
})
