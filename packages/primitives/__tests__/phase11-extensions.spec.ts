import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../../..')

const names = ['form-field', 'popover', 'dropdown-menu', 'toast']

function read(name: string): string {
  return readFileSync(
    resolve(root, `packages/primitives/${name}/src/${name}.tsx`),
    'utf-8',
  )
}

describe('phase 11 extension primitive contract', () => {
  it('ships package, source and generated-output configuration for all extensions', () => {
    for (const name of names) {
      expect(
        existsSync(resolve(root, `packages/primitives/${name}/package.json`)),
      ).toBe(true)
      expect(
        existsSync(resolve(root, `packages/primitives/${name}/src/index.ts`)),
      ).toBe(true)
      expect(read(name)).toContain('defineElement')
      expect(read(name)).toContain('shadow: false')
    }
  })

  it('connects form fields to accessible control relationships', () => {
    const source = read('form-field')
    expect(source).toContain('aria-invalid')
    expect(source).toContain('aria-describedby')
    expect(source).toContain('aria-required')
    expect(source).toContain('role="alert"')
  })

  it('provides overlay dismissal and keyboard semantics', () => {
    const popover = read('popover')
    const menu = read('dropdown-menu')
    expect(popover).toContain("nativeEvent.key === 'Escape'")
    expect(popover).toContain("document.addEventListener('pointerdown'")
    expect(menu).toContain('role="menu"')
    expect(menu).toContain('role="menuitem"')
    expect(menu).toContain("nativeEvent.key === 'Escape'")
  })

  it('provides live-region and auto-dismiss semantics for toasts', () => {
    const source = read('toast')
    expect(source).toContain('aria-live')
    expect(source).toContain('aria-atomic')
    expect(source).toContain('setTimeout')
    expect(source).toContain('role="status"')
  })
})
