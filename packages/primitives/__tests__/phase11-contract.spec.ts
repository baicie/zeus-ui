import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const workspaceRoot = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../../..')

const phase11Primitives = [
  'label',
  'textarea',
  'radio-group',
  'select',
  'card',
  'badge',
  'separator',
  'skeleton',
  'alert',
]

function readFile(path: string): string {
  return readFileSync(resolve(workspaceRoot, path), 'utf-8')
}

describe('phase 11 primitive contract', () => {
  it('adds all phase 11 primitive packages', () => {
    for (const name of phase11Primitives) {
      expect(
        existsSync(
          resolve(workspaceRoot, `packages/primitives/${name}/package.json`),
        ),
      ).toBe(true)

      expect(
        existsSync(
          resolve(workspaceRoot, `packages/primitives/${name}/src/index.ts`),
        ),
      ).toBe(true)
    }
  })

  it('uses zeus defineElement for all phase 11 primitives', () => {
    for (const name of phase11Primitives) {
      const source = readFile(`packages/primitives/${name}/src/${name}.tsx`)

      expect(source).toContain('defineElement')
      expect(source).toContain('shadow: false')
    }
  })

  it('adds a11y props to form primitives', () => {
    for (const name of ['textarea', 'radio-group', 'select']) {
      const source = readFile(`packages/primitives/${name}/src/${name}.tsx`)

      expect(source).toContain('ariaLabel')
      expect(source).toContain('ariaDescribedby')
      expect(source).toContain("attr: 'aria-label'")
      expect(source).toContain("attr: 'aria-describedby'")
    }
  })

  it('keeps display primitives low-interaction', () => {
    for (const name of ['card', 'badge', 'separator', 'skeleton', 'alert']) {
      const source = readFile(`packages/primitives/${name}/src/${name}.tsx`)

      expect(source).not.toContain('createContext')
      expect(source).not.toContain('document.addEventListener')
    }
  })
})
