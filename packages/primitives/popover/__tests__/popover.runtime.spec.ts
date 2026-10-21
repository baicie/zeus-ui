import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { afterEach, beforeAll, describe, expect, it } from 'vitest'

const root = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../../..')

interface RuntimeElement extends HTMLElement {
  componentOnReady?: () => Promise<unknown>
}

function tick(): Promise<void> {
  return Promise.resolve().then(
    () => new Promise(resolve => setTimeout(resolve, 0)),
  )
}

async function createPopover(): Promise<RuntimeElement> {
  const popover = document.createElement('zw-popover') as RuntimeElement
  popover.innerHTML =
    '<zw-popover-trigger>Open</zw-popover-trigger><zw-popover-content>Content</zw-popover-content>'
  document.body.append(popover)
  await popover.componentOnReady?.()
  await Promise.all(
    [...popover.querySelectorAll<RuntimeElement>('*')].map(element =>
      element.componentOnReady?.(),
    ),
  )
  await tick()
  return popover
}

beforeAll(
  () => import(resolve(root, 'packages/primitives/popover/dist/wc/auto.js')),
)

afterEach(() => document.body.replaceChildren())

describe('popover runtime', () => {
  it('opens from its trigger and closes on Escape', async () => {
    const popover = await createPopover()
    const trigger = popover.querySelector('button')
    const content = popover.querySelector<HTMLElement>('[role="dialog"]')
    if (!trigger || !content) throw new Error('Expected popover controls.')

    trigger.click()
    await tick()
    expect(popover).toHaveAttribute('open')
    expect(content).not.toHaveAttribute('hidden')
    content.focus()
    expect(document.activeElement).toBe(content)

    content.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    )
    await tick()
    expect(popover).not.toHaveAttribute('open')
    expect(content).toHaveAttribute('hidden')
    expect(document.activeElement).toBe(trigger)
  })

  it('closes on an outside pointer event', async () => {
    const popover = await createPopover()
    popover.setAttribute('open', '')
    await tick()
    document.body.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true }),
    )
    await tick()
    expect(popover).not.toHaveAttribute('open')
  })
})
