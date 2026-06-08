import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const workspaceRoot = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../../..')

const group11Primitives = [
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

const group12Primitives = [
  'collapsible',
  'accordion',
  'tooltip',
  'progress',
  'avatar',
]

function readFile(path: string): string {
  return readFileSync(resolve(workspaceRoot, path), 'utf-8')
}

describe('primitives contract', () => {
  it('adds all group 1 primitive packages (label/textarea/radio-group/select/card/badge/separator/skeleton/alert)', () => {
    for (const name of group11Primitives) {
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

  it('adds all group 2 primitive packages (collapsible/accordion/tooltip/progress/avatar)', () => {
    for (const name of group12Primitives) {
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

  it('uses zeus defineElement for all primitives', () => {
    for (const name of [...group11Primitives, ...group12Primitives]) {
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

  it('maps progress value to styled indicator width', () => {
    const source = readFile('packages/registry/default/progress.tsx')
    expect(source).toContain('--zeus-progress-percent')
    expect(source).toContain('w-[var(--zeus-progress-percent)]')
    expect(source).toContain('resolvePercent')
  })

  it('adds avatar image load/error events', () => {
    const source = readFile('packages/primitives/avatar/src/avatar.tsx')
    expect(source).toContain('imageLoad')
    expect(source).toContain('imageError')
    expect(source).toContain('AvatarFallback')
  })

  it('stores avatar image status on host state', () => {
    const source = readFile('packages/primitives/avatar/src/avatar.tsx')
    expect(source).toContain('imageStatus')
    expect(source).toContain('ctx.host.imageStatus = status')
    expect(source).toContain("attr: 'image-status'")
    expect(source).toContain('data-image-status')
  })
})
