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

function readWorkspaceJson<T>(path: string): T {
  return JSON.parse(readWorkspaceFile(path)) as T
}

describe('data-grid benchmark contract', () => {
  it('keeps package build tsconfig scoped to published src output', () => {
    const tsconfig = readWorkspaceJson<{
      include?: string[]
    }>('packages/advanced/data-grid/tsconfig.json')

    expect(tsconfig.include).toEqual(['src'])
  })

  it('declares benchmark typecheck tsconfig', () => {
    const tsconfig = readWorkspaceJson<{
      include?: string[]
      compilerOptions?: {
        types?: string[]
      }
    }>('packages/advanced/data-grid/tsconfig.bench.json')

    expect(tsconfig.include).toEqual([
      'benchmarks/**/*.ts',
      '__tests__/benchmark-data.spec.ts',
      '__tests__/benchmark-metrics.spec.ts',
      '__tests__/data-grid-benchmark-contract.spec.ts',
    ])

    expect(tsconfig.compilerOptions?.types).toEqual([
      '@zeus-js/zeus/jsx',
      'vitest/globals',
      'node',
    ])
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

  it('wires benchmark commands into data-grid package scripts', () => {
    const pkg = readWorkspaceJson<{
      scripts?: Record<string, string>
    }>('packages/advanced/data-grid/package.json')

    expect(pkg.scripts?.check).toContain('pnpm check:bench')
    expect(pkg.scripts?.['check:bench']).toBe(
      'tsc -p tsconfig.bench.json --noEmit',
    )
    expect(pkg.scripts?.['test:bench']).toContain('data-grid-render.bench.ts')
    expect(pkg.scripts?.['test:bench']).toContain('data-grid-scroll.bench.ts')
    expect(pkg.scripts?.['test:bench']).toContain('data-grid-update.bench.ts')
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
