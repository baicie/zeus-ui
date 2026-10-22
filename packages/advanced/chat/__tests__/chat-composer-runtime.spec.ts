import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

interface RuntimeChatComposer extends HTMLElement {
  value?: string
  maxLength?: number
  componentOnReady: () => Promise<HTMLElement>
}

const workspaceRoot = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../../..')

beforeAll(
  () =>
    import(resolve(workspaceRoot, 'packages/advanced/chat/dist/wc/auto.js')),
)

afterEach(() => {
  globalThis.document.body.replaceChildren()
})

async function createComposer(): Promise<RuntimeChatComposer> {
  const element = globalThis.document.createElement(
    'zw-chat-composer',
  ) as RuntimeChatComposer
  globalThis.document.body.append(element)
  await element.componentOnReady()
  return element
}

function getControl(element: HTMLElement): HTMLTextAreaElement {
  const control = element.querySelector('textarea')
  if (!control) throw new Error('Expected chat composer textarea control.')
  return control
}

describe('chat composer length constraint', () => {
  it('accepts a message without an implicit zero length limit', async () => {
    const element = await createComposer()
    const control = getControl(element)
    const onChange = vi.fn()
    element.addEventListener('value-change', onChange)

    expect(control.maxLength).toBe(-1)
    expect(control).not.toHaveAttribute('maxlength')

    control.value = 'Hello'
    control.dispatchEvent(new InputEvent('input', { bubbles: true }))
    expect(element.value).toBe('Hello')
    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange.mock.calls[0][0].detail.value).toBe('Hello')
  })

  it('updates and removes the optional native length constraint', async () => {
    const element = await createComposer()
    const control = getControl(element)

    element.maxLength = 8
    await Promise.resolve()
    expect(control.maxLength).toBe(8)

    element.maxLength = undefined
    await Promise.resolve()
    expect(control).not.toHaveAttribute('maxlength')
    expect(control.maxLength).toBe(-1)
  })
})
