import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const workspaceRoot = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../../..')

function readPrimitive(name: string): string {
  return readFileSync(
    resolve(workspaceRoot, `packages/primitives/${name}/src/${name}.tsx`),
    'utf-8',
  )
}

describe('primitive accessibility contract', () => {
  it('hardens dialog aria relationships and focus management', () => {
    const source = readPrimitive('dialog')

    expect(source).toContain('aria-haspopup')
    expect(source).toContain('aria-controls')
    expect(source).toContain('aria-labelledby')
    expect(source).toContain('aria-describedby')
    expect(source).toContain('trapFocus')
    expect(source).toContain('returnFocus')
    expect(source).toContain("event.key === 'Escape'")
  })

  it('hardens tabs roving focus and aria relationships', () => {
    const source = readPrimitive('tabs')

    expect(source).toContain('aria-controls')
    expect(source).toContain('aria-labelledby')
    expect(source).toContain('registerTrigger')
    expect(source).toContain('moveFocus')
    expect(source).toContain("key === 'Home'")
    expect(source).toContain("key === 'End'")
    expect(source).toContain("key === 'ArrowRight'")
    expect(source).toContain("key === 'ArrowDown'")
  })

  it('supports accessible icon-only and loading buttons', () => {
    const source = readPrimitive('button')

    expect(source).toContain('ariaLabel')
    expect(source).toContain("attr: 'aria-label'")
    expect(source).toContain('aria-busy')
  })

  it('supports input aria description fields', () => {
    const source = readPrimitive('input')

    expect(source).toContain('ariaLabel')
    expect(source).toContain('ariaDescribedby')
    expect(source).toContain('ariaErrormessage')
    expect(source).toContain("attr: 'aria-describedby'")
    expect(source).toContain("attr: 'aria-errormessage'")
  })

  it('supports checkbox and switch aria composition props', () => {
    const checkbox = readPrimitive('checkbox')
    const switchSource = readPrimitive('switch')

    for (const source of [checkbox, switchSource]) {
      expect(source).toContain('ariaLabel')
      expect(source).toContain('ariaDescribedby')
      expect(source).toContain('aria-required')
      expect(source).toContain("attr: 'aria-label'")
      expect(source).toContain("attr: 'aria-describedby'")
    }
  })
})
