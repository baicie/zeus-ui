// packages/advanced/data-grid/__tests__/data-grid-benchmark-contract.spec.ts

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const workspaceRoot = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../../..')

function readWorkspaceFile(path: string): string {
  return readFileSync(resolve(workspaceRoot, path), 'utf-8')
}

describe('data-grid benchmark contract', () => {
  it('keeps benchmark files outside published src output', () => {
    const tsconfig = readWorkspaceFile(
      'packages/advanced/data-grid/tsconfig.json',
    )

    expect(tsconfig).toContain('"include": ["src"]')
  })

  it('declares all Phase G1 benchmark files', () => {
    const files = [
      'packages/advanced/data-grid/benchmarks/data-grid-render.bench.ts',
      'packages/advanced/data-grid/benchmarks/data-grid-scroll.bench.ts',
      'packages/advanced/data-grid/benchmarks/data-grid-update.bench.ts',
    ]

    for (const file of files) {
      expect(existsSync(resolve(workspaceRoot, file))).toBe(true)
    }
  })

  it('wires benchmark command into data-grid package scripts', () => {
    const pkg = readWorkspaceFile('packages/advanced/data-grid/package.json')

    expect(pkg).toContain('"test:bench"')
    expect(pkg).toContain('data-grid-render.bench.ts')
    expect(pkg).toContain('data-grid-scroll.bench.ts')
    expect(pkg).toContain('data-grid-update.bench.ts')
  })

  it('keeps benchmark assertions based on current virtualized row contract', () => {
    const renderBench = readWorkspaceFile(
      'packages/advanced/data-grid/benchmarks/data-grid-render.bench.ts',
    )
    const scrollBench = readWorkspaceFile(
      'packages/advanced/data-grid/benchmarks/data-grid-scroll.bench.ts',
    )

    expect(renderBench).toContain('getRenderedRowsBudget')
    expect(renderBench).toContain('estimatedDomNodes.cellNodes')
    expect(scrollBench).toContain('normalizeColumns')
    expect(scrollBench).toContain('createRows')
    expect(scrollBench).toContain('createVirtualizer')
    expect(scrollBench).toContain('rangeChanges')
  })
})
