import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { afterEach, beforeAll, describe, expect, it } from 'vitest'

const workspaceRoot = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../../..')

const distPath = resolve(
  workspaceRoot,
  'packages/primitives/checkbox/dist/wc/auto.js',
)

beforeAll(() => import(distPath))

afterEach(() => document.body.replaceChildren())

describe('checkbox runtime property bindings', () => {
  it('writes the native input type as a string property', async () => {
    const checkbox = document.createElement('zw-checkbox')
    document.body.append(checkbox)
    await (
      checkbox as HTMLElement & { componentOnReady: () => Promise<unknown> }
    ).componentOnReady()

    expect(checkbox.querySelector<HTMLInputElement>('input')?.type).toBe(
      'checkbox',
    )
  })

  it('updates checked and indeterminate as boolean properties', async () => {
    const checkbox = document.createElement('zw-checkbox') as HTMLElement & {
      checked: boolean
      indeterminate: boolean
      componentOnReady: () => Promise<unknown>
    }
    checkbox.checked = false
    checkbox.indeterminate = false
    document.body.append(checkbox)
    await checkbox.componentOnReady()

    const control = checkbox.querySelector<HTMLInputElement>('input')!
    expect(control.checked).toBe(false)
    expect(control.indeterminate).toBe(false)

    checkbox.checked = true
    checkbox.indeterminate = true
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(control.checked).toBe(true)
    expect(control.indeterminate).toBe(true)

    checkbox.checked = false
    checkbox.indeterminate = false
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(control.checked).toBe(false)
    expect(control.indeterminate).toBe(false)
  })
})
