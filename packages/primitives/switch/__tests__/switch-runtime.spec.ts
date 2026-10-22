import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { afterEach, beforeAll, describe, expect, it } from 'vitest'

const workspaceRoot = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../../..')

const distPath = resolve(
  workspaceRoot,
  'packages/primitives/switch/dist/wc/auto.js',
)

beforeAll(() => import(distPath))

afterEach(() => document.body.replaceChildren())

describe('switch runtime property bindings', () => {
  it('writes the native input type as a string property', async () => {
    const toggle = document.createElement('zw-switch')
    document.body.append(toggle)
    await (
      toggle as HTMLElement & { componentOnReady: () => Promise<unknown> }
    ).componentOnReady()

    expect(toggle.querySelector<HTMLInputElement>('input')?.type).toBe(
      'checkbox',
    )
  })

  it('updates checked as a boolean property', async () => {
    const toggle = document.createElement('zw-switch') as HTMLElement & {
      checked: boolean
      componentOnReady: () => Promise<unknown>
    }
    toggle.checked = false
    document.body.append(toggle)
    await toggle.componentOnReady()

    const control = toggle.querySelector<HTMLInputElement>('input')!
    expect(control.checked).toBe(false)
    toggle.checked = true
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(control.checked).toBe(true)
    toggle.checked = false
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(control.checked).toBe(false)
  })
})
