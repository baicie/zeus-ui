import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { afterEach, beforeAll, describe, expect, it } from 'vitest'

/**
 * The dialog's state model, exercised through its public surface.
 *
 * These are the rules the R6 review found broken, written down so they stay
 * fixed:
 *
 * - an uncontrolled dialog owns its state and reports every change;
 * - a controlled dialog (one whose `open` was set before setup) reports and
 *   never writes — the owner decides;
 * - Escape, the close control and the backdrop all go through `setOpen`, so a
 *   dialog can be closed and reopened by any of them, any number of times;
 * - opening by any route publishes `open = true` so callers can read it.
 *
 * Focus behaviour needs a layout engine and lives in the browser gate; this
 * file covers the state machine, which is where the defects were.
 */

const workspaceRoot = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../../..')
const distPath = resolve(
  workspaceRoot,
  'packages/primitives/dialog/dist/wc/auto.js',
)

interface RuntimeDialog extends HTMLElement {
  open?: boolean
  show: () => void
  close: () => void
  componentOnReady: () => Promise<RuntimeDialog>
}

function tick(): Promise<void> {
  return Promise.resolve().then(
    () => new Promise(resolve => setTimeout(resolve, 0)),
  )
}

async function waitForParts(): Promise<void> {
  await Promise.all([
    customElements.whenDefined('zw-dialog'),
    customElements.whenDefined('zw-dialog-content'),
    customElements.whenDefined('zw-dialog-close'),
  ])
}

interface Mounted {
  dialog: RuntimeDialog
  content: HTMLElement & { componentOnReady?: () => Promise<unknown> }
  changes: boolean[]
}

/**
 * A dialog with a close control and one focusable, attached in that order.
 *
 * `open` decides the mode, and the distinction is made the way an owner makes
 * it: writing the property before the element is connected means "controlled".
 */
async function mount(
  options: { open?: boolean; defaultOpen?: boolean } = {},
): Promise<Mounted> {
  await waitForParts()
  const dialog = document.createElement('zw-dialog') as RuntimeDialog
  if (options.open !== undefined) dialog.open = options.open
  if (options.defaultOpen) dialog.setAttribute('default-open', '')
  document.body.append(dialog)
  await dialog.componentOnReady()

  const content = document.createElement('zw-dialog-content') as HTMLElement & {
    componentOnReady?: () => Promise<unknown>
  }
  const close = document.createElement('zw-dialog-close')
  content.append(
    Object.assign(document.createElement('button'), { textContent: 'Inside' }),
    close,
  )
  dialog.append(content)
  await content.componentOnReady?.()
  await tick()

  const changes: boolean[] = []
  dialog.addEventListener('open-change', (event: Event) => {
    changes.push((event as CustomEvent<{ open: boolean }>).detail.open)
  })
  return { dialog, content, changes }
}

function state(dialog: RuntimeDialog): string | null {
  return dialog.getAttribute('data-state')
}

function pointerDownOutside(): void {
  document.body.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true }),
  )
}

function pressEscape(target: EventTarget = document.body): void {
  target.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    }),
  )
}

beforeAll(() => import(distPath))

afterEach(async () => {
  document.body.replaceChildren()
  await tick()
})

describe('uncontrolled dialog', () => {
  it('opens from its state and reports once', async () => {
    const { dialog, changes } = await mount()

    expect(state(dialog)).toBe('closed')
    /*
     * An uncontrolled dialog leaves `open` alone until something changes it.
     * The state lives in `data-state`; `open` is the *controlled* input, and
     * `undefined` is what tells an owner it is not controlling this element.
     * See `packages/primitives/__tests__/boolean-default-state-runtime.spec.ts`,
     * which asserts the same contract for every boolean primitive.
     */
    expect(dialog.open).toBeUndefined()

    dialog.show()
    await tick()

    expect(state(dialog)).toBe('open')
    expect(changes).toEqual([true])
  })

  it('closes on Escape when it opened itself, and reopens afterwards', async () => {
    const { dialog, changes } = await mount()
    dialog.show()
    await tick()

    pressEscape()
    await tick()
    expect(state(dialog)).toBe('closed')
    expect(changes).toEqual([true, false])

    // The defect the review recorded as "cannot be reopened": a second open
    // after a close left `data-state` at `closed`.
    dialog.show()
    await tick()
    expect(state(dialog)).toBe('open')
    expect(changes).toEqual([true, false, true])
  })

  it('closes on the backdrop and reopens afterwards', async () => {
    const { dialog, changes } = await mount()
    dialog.show()
    await tick()

    pointerDownOutside()
    await tick()
    expect(state(dialog)).toBe('closed')

    dialog.show()
    await tick()
    expect(state(dialog)).toBe('open')
    expect(changes).toEqual([true, false, true])
  })

  it('closes through the close control and reopens afterwards', async () => {
    const { dialog, changes } = await mount()
    dialog.show()
    await tick()

    dialog
      .querySelector('zw-dialog-close button')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await tick()
    expect(state(dialog)).toBe('closed')

    dialog.show()
    await tick()
    expect(state(dialog)).toBe('open')
    expect(changes).toEqual([true, false, true])
  })

  it('honours an owner write to `open` after setup', async () => {
    const { dialog } = await mount()

    // Uncontrolled does not mean read-only: an owner that never declared the
    // prop can still drive the element, and that write is a command.
    dialog.open = true
    await tick()
    expect(state(dialog)).toBe('open')

    dialog.open = false
    await tick()
    expect(state(dialog)).toBe('closed')
  })

  it('stays uncontrolled after a disconnect and reconnect', async () => {
    /*
     * A projection rebuild re-runs setup. The element has by then written its
     * own `open`, so a mode derived from `props.open !== undefined` would flip
     * to controlled and the dialog would report closes without applying them.
     * The mode is recorded on the element precisely so this cannot happen.
     */
    const { dialog } = await mount()
    dialog.show()
    await tick()
    expect(state(dialog)).toBe('open')

    const parent = dialog.parentElement!
    const park = document.createElement('div')
    document.body.append(park)
    park.append(dialog)
    await tick()
    parent.append(dialog)
    await tick()

    pressEscape()
    await tick()
    expect(state(dialog)).toBe('closed')

    dialog.show()
    await tick()
    expect(state(dialog)).toBe('open')
  })

  it('starts open with defaultOpen and reports nothing until asked', async () => {
    const { dialog, changes } = await mount({ defaultOpen: true })

    expect(state(dialog)).toBe('open')
    expect(dialog.open).toBeUndefined()
    expect(changes).toEqual([])
  })
})

describe('controlled dialog', () => {
  it('reports Escape but does not close itself', async () => {
    const { dialog, changes } = await mount({ open: false })
    dialog.open = true
    await tick()

    pressEscape()
    await tick()

    // The owner has not written `false`, so the dialog is still open. This is
    // the whole point of controlled: the component asked, and waited.
    expect(state(dialog)).toBe('open')
    expect(changes).toEqual([false])
  })

  it('closes when the owner writes false, and opens again when it writes true', async () => {
    const { dialog } = await mount({ open: true })
    expect(state(dialog)).toBe('open')

    dialog.open = false
    await tick()
    expect(state(dialog)).toBe('closed')

    dialog.open = true
    await tick()
    expect(state(dialog)).toBe('open')
  })

  it('never writes the prop it was given', async () => {
    const { dialog } = await mount({ open: true })

    pressEscape()
    await tick()
    pointerDownOutside()
    await tick()

    // A component that wrote `open` here would have made itself uncontrolled
    // mid-flight, and the owner's next render would fight it.
    expect(dialog.open).toBe(true)
  })
})
