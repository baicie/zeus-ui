import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const workspaceRoot = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../../..')

const phase12Primitives = [
  'collapsible',
  'accordion',
  'tooltip',
  'progress',
  'avatar',
]

function readFile(path: string): string {
  return readFileSync(resolve(workspaceRoot, path), 'utf-8')
}

describe('phase 12 primitive contract', () => {
  it('adds all phase 12 primitive packages', () => {
    for (const name of phase12Primitives) {
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

  it('uses zeus defineElement for all phase 12 primitives', () => {
    for (const name of phase12Primitives) {
      const source = readFile(`packages/primitives/${name}/src/${name}.tsx`)
      expect(source).toContain('defineElement')
      expect(source).toContain('shadow: false')
    }
  })

  it('adds aria relationships for disclosure primitives', () => {
    for (const name of ['collapsible', 'accordion']) {
      const source = readFile(`packages/primitives/${name}/src/${name}.tsx`)
      expect(source).toContain('aria-expanded')
      expect(source).toContain('aria-controls')
      expect(source).toContain('hidden')
    }
  })

  it('keeps tooltip lightweight and accessible', () => {
    const source = readFile('packages/primitives/tooltip/src/tooltip.tsx')
    expect(source).toContain('role="tooltip"')
    expect(source).toContain('aria-describedby')
    expect(source).toContain("nativeEvent.key === 'Escape'")
    expect(source).not.toContain('floating-ui')
    expect(source).not.toContain('document.addEventListener')
  })

  it('adds progressbar semantics', () => {
    const source = readFile('packages/primitives/progress/src/progress.tsx')
    expect(source).toContain('role="progressbar"')
    expect(source).toContain('aria-valuenow')
    expect(source).toContain('aria-valuemax')
  })

  it('adds avatar image load/error events', () => {
    const source = readFile('packages/primitives/avatar/src/avatar.tsx')
    expect(source).toContain('imageLoad')
    expect(source).toContain('imageError')
    expect(source).toContain('AvatarFallback')
  })
})
