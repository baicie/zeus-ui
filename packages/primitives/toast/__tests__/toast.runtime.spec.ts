import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

const root = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../../..')

interface RuntimeToast extends HTMLElement {
  open?: boolean
  componentOnReady?: () => Promise<unknown>
}

function tick(): Promise<void> {
  return Promise.resolve().then(
    () => new Promise(resolve => setTimeout(resolve, 0)),
  )
}

async function createToast(duration?: number): Promise<RuntimeToast> {
  const toast = document.createElement('zw-toast') as RuntimeToast
  toast.setAttribute('default-open', '')
  if (duration !== undefined) toast.setAttribute('duration', String(duration))
  toast.innerHTML =
    '<zw-toast-title>Saved</zw-toast-title><zw-toast-description>Done</zw-toast-description><zw-toast-close>Close</zw-toast-close>'
  document.body.append(toast)
  await toast.componentOnReady?.()
  await Promise.all(
    [...toast.querySelectorAll<RuntimeToast>('*')].map(element =>
      element.componentOnReady?.(),
    ),
  )
  await tick()
  return toast
}

beforeAll(
  () => import(resolve(root, 'packages/primitives/toast/dist/wc/auto.js')),
)

afterEach(() => document.body.replaceChildren())

describe('toast runtime', () => {
  it('exposes live-region semantics and closes from its close control', async () => {
    const toast = await createToast()
    expect(toast).toHaveAttribute('role', 'status')
    expect(toast).toHaveAttribute('aria-atomic', 'true')

    toast.querySelector('button')?.click()
    await tick()
    expect(toast).toHaveAttribute('hidden')
  })

  it('opens from default-open and wires title and description ids', async () => {
    const toast = await createToast(0)
    expect(toast).not.toHaveAttribute('hidden')
    expect(toast.querySelector('zw-toast-title')).toHaveAttribute(
      'id',
      expect.stringContaining('zw-toast-'),
    )
    expect(toast.querySelector('zw-toast-description')).toHaveAttribute(
      'id',
      expect.stringContaining('zw-toast-'),
    )
  })

  it('closes a controlled toast when its close control is activated', async () => {
    const toast = document.createElement('zw-toast') as RuntimeToast
    toast.open = true
    toast.setAttribute('duration', '0')
    toast.innerHTML = '<zw-toast-close>Close</zw-toast-close>'
    document.body.append(toast)
    await toast.componentOnReady?.()
    await Promise.all(
      [...toast.querySelectorAll<RuntimeToast>('*')].map(element =>
        element.componentOnReady?.(),
      ),
    )
    await tick()

    toast.querySelector('button')?.click()
    await tick()
    expect(toast).toHaveAttribute('hidden')
    expect(toast).not.toHaveAttribute('open')
  })

  it('keeps an explicitly closed toast closed when default-open is also set', async () => {
    const toast = document.createElement('zw-toast') as RuntimeToast
    toast.open = false
    toast.setAttribute('default-open', '')
    document.body.append(toast)
    await toast.componentOnReady?.()
    await tick()

    expect(toast).toHaveAttribute('hidden')
  })

  it('auto-dismisses after the configured duration', async () => {
    vi.useFakeTimers()
    try {
      const toastPromise = createToast(10)
      await vi.advanceTimersByTimeAsync(0)
      const toast = await toastPromise
      await vi.advanceTimersByTimeAsync(10)
      expect(toast).toHaveAttribute('hidden')
    } finally {
      vi.useRealTimers()
    }
  })

  it('starts auto-dismiss when a controlled toast opens externally', async () => {
    vi.useFakeTimers()
    try {
      const toast = document.createElement('zw-toast') as RuntimeToast
      toast.setAttribute('duration', '10')
      document.body.append(toast)
      await toast.componentOnReady?.()
      await vi.advanceTimersByTimeAsync(0)

      expect(toast).toHaveAttribute('hidden')
      toast.setAttribute('open', '')
      await vi.advanceTimersByTimeAsync(0)
      expect(toast).not.toHaveAttribute('hidden')

      await vi.advanceTimersByTimeAsync(9)
      expect(toast).not.toHaveAttribute('hidden')
      await vi.advanceTimersByTimeAsync(1)
      expect(toast).toHaveAttribute('hidden')
    } finally {
      vi.useRealTimers()
    }
  })
})
