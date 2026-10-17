import type { InputElement } from '../src'
import { existsSync } from 'node:fs'

import { resolve } from 'node:path'

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

const workspaceRoot = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../../..')
const distPath = resolve(
  workspaceRoot,
  'packages',
  'primitives',
  'input',
  'dist',
  'wc',
  'auto.js',
)

interface RuntimeInput extends InputElement {
  componentOnReady: () => Promise<RuntimeInput>
  defaultValue?: string
}

function nextRender(): Promise<void> {
  return Promise.resolve()
    .then(() => Promise.resolve())
    .then(
      () =>
        new Promise<void>(resolve => {
          setTimeout(resolve, 0)
        }),
    )
}

async function createInput(defaultValue?: string): Promise<RuntimeInput> {
  await customElements.whenDefined('zw-input')
  const input = document.createElement('zw-input') as RuntimeInput
  if (defaultValue !== undefined) input.defaultValue = defaultValue
  document.body.append(input)
  await input.componentOnReady()
  await nextRender()
  return input
}

function getNativeInput(input: RuntimeInput): HTMLInputElement {
  const native = input.querySelector('input')
  if (!native) throw new Error('Expected native input control.')
  return native
}

beforeAll(() => import(distPath))

afterEach(() => {
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

describe('input controlled state', () => {
  it('keeps the controlled value when the parent does not write back', async () => {
    const input = await createInput()
    input.value = 'Ada'
    await nextRender()

    const native = getNativeInput(input)
    native.value = 'Grace'
    native.dispatchEvent(new InputEvent('input', { bubbles: true }))

    expect(input.value).toBe('Ada')
    expect(native.value).toBe('Ada')
  })

  it('accepts the value only after the parent writes it back', async () => {
    const input = await createInput()
    input.value = 'Ada'
    input.addEventListener('value-change', event => {
      input.value = (event as CustomEvent<{ value: string }>).detail.value
    })
    await nextRender()

    const native = getNativeInput(input)
    native.value = 'Grace'
    native.dispatchEvent(new InputEvent('input', { bubbles: true }))
    await nextRender()

    expect(input.value).toBe('Grace')
    expect(native.value).toBe('Grace')
  })

  it('does not let later defaultValue updates replace an uncontrolled value', async () => {
    const input = await createInput('Ada')

    const native = getNativeInput(input)
    expect(native.value).toBe('Ada')
    native.value = 'Grace'
    native.dispatchEvent(new InputEvent('input', { bubbles: true }))
    await nextRender()

    input.defaultValue = 'Lin'
    await nextRender()

    expect(native.value).toBe('Grace')
    expect(input.value).toBeUndefined()
  })

  it('preserves the latest value when controlled mode is removed', async () => {
    const input = await createInput('Ada')

    const native = getNativeInput(input)
    expect(native.value).toBe('Ada')
    native.value = 'Grace'
    native.dispatchEvent(new InputEvent('input', { bubbles: true }))
    await nextRender()

    input.value = 'Lin'
    await nextRender()
    expect(native.value).toBe('Lin')
    input.value = undefined
    await nextRender()

    expect(native.value).toBe('Lin')
  })

  it('uses the external value when uncontrolled mode becomes controlled', async () => {
    const input = await createInput('Ada')

    const native = getNativeInput(input)
    expect(native.value).toBe('Ada')
    native.value = 'Grace'
    native.dispatchEvent(new InputEvent('input', { bubbles: true }))
    await nextRender()

    input.value = 'Lin'
    await nextRender()

    expect(native.value).toBe('Lin')
  })
})
