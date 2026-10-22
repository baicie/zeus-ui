import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

interface RuntimeTextarea extends HTMLElement {
  value?: string
  minlength?: number
  maxlength?: number
  componentOnReady: () => Promise<HTMLElement>
}

const workspaceRoot = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../../..')

const distPath = resolve(
  workspaceRoot,
  'packages/primitives/textarea/dist/wc/auto.js',
)

beforeAll(() => import(distPath))

afterEach(() => {
  document.body.replaceChildren()
})

async function createTextarea(): Promise<RuntimeTextarea> {
  const element = document.createElement('zw-textarea') as RuntimeTextarea
  document.body.append(element)
  await element.componentOnReady()
  return element
}

function getControl(element: HTMLElement): HTMLTextAreaElement {
  const control = element.querySelector('textarea')
  if (!control) throw new Error('Expected textarea control.')
  return control
}

describe('textarea length constraints', () => {
  it('accepts input without an implicit zero length limit', async () => {
    const element = await createTextarea()
    const control = getControl(element)
    const onChange = vi.fn()
    element.addEventListener('value-change', onChange)

    expect(control.minLength).toBe(-1)
    expect(control.maxLength).toBe(-1)
    expect(control).not.toHaveAttribute('minlength')
    expect(control).not.toHaveAttribute('maxlength')

    control.value = 'Hello'
    control.dispatchEvent(new InputEvent('input', { bubbles: true }))
    expect(element.value).toBe('Hello')
    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange.mock.calls[0][0].detail.value).toBe('Hello')
  })

  it('updates and removes optional native length constraints', async () => {
    const element = await createTextarea()
    const control = getControl(element)

    element.minlength = 3
    element.maxlength = 8
    await Promise.resolve()
    expect(control.minLength).toBe(3)
    expect(control.maxLength).toBe(8)

    element.minlength = undefined
    element.maxlength = undefined
    await Promise.resolve()
    expect(control).not.toHaveAttribute('minlength')
    expect(control).not.toHaveAttribute('maxlength')
    expect(control.minLength).toBe(-1)
    expect(control.maxLength).toBe(-1)
  })
})
