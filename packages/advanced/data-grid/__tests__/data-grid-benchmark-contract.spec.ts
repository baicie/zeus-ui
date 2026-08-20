import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const workspaceRoot = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../../..')

interface BenchmarkTsconfig {
  include?: string[]
  compilerOptions?: {
    rootDir?: string
    types?: string[]
  }
}

interface DataGridPackageJson {
  scripts?: Record<string, string>
}

function readWorkspaceFile(path: string): string {
  return readFileSync(resolve(workspaceRoot, path), 'utf-8')
}

function readWorkspaceJson<T>(path: string): T {
  return JSON.parse(readWorkspaceFile(path)) as T
}

describe('data-grid benchmark contract', () => {
  it('keeps package build tsconfig scoped to published src output', () => {
    const tsconfig = readWorkspaceJson<BenchmarkTsconfig>(
      'packages/advanced/data-grid/tsconfig.json',
    )

    expect(tsconfig.include).toEqual(['src'])
  })

  it('declares an isolated benchmark typecheck config', () => {
    const tsconfig = readWorkspaceJson<BenchmarkTsconfig>(
      'packages/advanced/data-grid/tsconfig.bench.json',
    )
    const compilerOptions = tsconfig.compilerOptions

    expect(tsconfig.include).toEqual([
      'benchmarks/**/*.ts',
      '__tests__/benchmark-data.spec.ts',
      '__tests__/benchmark-metrics.spec.ts',
      '__tests__/data-grid-benchmark-contract.spec.ts',
      '../../../e2e/advanced/data-grid/data-grid-runtime-harness.ts',
    ])
    expect(compilerOptions && compilerOptions.rootDir).toBe('../../..')
    expect(compilerOptions && compilerOptions.types).toEqual([
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

  it('runs benchmarks in their dedicated jsdom project', () => {
    const pkg = readWorkspaceJson<DataGridPackageJson>(
      'packages/advanced/data-grid/package.json',
    )
    const scripts = pkg.scripts
    const vitestConfig = readWorkspaceFile('vitest.config.ts')
    const workflow = readWorkspaceFile('.github/workflows/test.yml')

    expect(scripts && scripts.check).toContain('pnpm check:bench')
    expect(scripts && scripts['check:bench']).toBe(
      'tsc -p tsconfig.bench.json --noEmit',
    )
    expect(scripts && scripts['test:bench']).toContain(
      '--project data-grid-benchmark --run',
    )
    expect(vitestConfig).toContain("name: 'data-grid-benchmark'")
    expect(vitestConfig).toContain("environment: 'jsdom'")
    expect(vitestConfig).toContain('fileParallelism: false')
    expect(vitestConfig).toContain('plugins: [dataGridCompiler()]')
    expect(vitestConfig).toContain('transformModule({')
    expect(vitestConfig).toContain("runtimeModule: '@zeus-js/runtime-dom'")
    expect(vitestConfig).not.toContain('transformAsync')
    expect(vitestConfig).toContain('replacement: zeusBundlerEsmPath')
    expect(workflow).toContain('data-grid-benchmark:')
    expect(workflow).toContain('pnpm --filter @zeus-web/data-grid check:bench')
    expect(workflow).toContain('pnpm data-grid:bench')
  })

  it('measures the real element and rendered DOM', () => {
    const metrics = readWorkspaceFile(
      'packages/advanced/data-grid/benchmarks/benchmark-metrics.ts',
    )
    const renderBench = readWorkspaceFile(
      'packages/advanced/data-grid/benchmarks/data-grid-render.bench.ts',
    )
    const scrollBench = readWorkspaceFile(
      'packages/advanced/data-grid/benchmarks/data-grid-scroll.bench.ts',
    )
    const updateBench = readWorkspaceFile(
      'packages/advanced/data-grid/benchmarks/data-grid-update.bench.ts',
    )

    expect(metrics).toContain('data-grid-runtime-harness')
    expect(metrics).toContain('mountDataGrid')
    expect(metrics).toContain('captureDataGridDomSnapshot')
    expect(metrics).toContain('grid.scrollToOffset(offset)')
    expect(metrics).toContain('viewport.scrollLeft = columnOffset')
    expect(metrics).toContain('harness.setElementClientWidth')
    expect(metrics).toContain(
      'const ratio = frames <= 1 ? 1 : frame / (frames - 1)',
    )
    expect(metrics).toContain(
      'const offset = Math.round(maxScrollOffset * ratio)',
    )
    expect(metrics).toContain('grid.setRows(input.nextRows)')
    expect(metrics).toContain('grid.setColumns(input.nextColumns)')
    expect(metrics).not.toContain('createDataGridBenchmarkRuntime')
    expect(renderBench).toContain('result.dom.renderedCells')
    expect(scrollBench).toContain('result.renderedCellsMax')
    expect(scrollBench).toContain('result.rangeChanges')
    expect(scrollBench).toContain('result.lastItemIndexAfterScroll')
    expect(scrollBench).toContain('result.lastColumnItemIndexAfterScroll')
    expect(scrollBench).toContain('result.lastRenderedRowIndexAfterScroll')
    expect(updateBench).toContain("nextColumns[0].field = 'col_2'")
    expect(updateBench).toContain(
      'result.domAfterRowsUpdate.firstRenderedRowKey',
    )
  })

  it('keeps benchmark timing boundaries and CI output machine-readable', () => {
    const metrics = readWorkspaceFile(
      'packages/advanced/data-grid/benchmarks/benchmark-metrics.ts',
    )
    const renderBench = readWorkspaceFile(
      'packages/advanced/data-grid/benchmarks/data-grid-render.bench.ts',
    )
    const scrollBench = readWorkspaceFile(
      'packages/advanced/data-grid/benchmarks/data-grid-scroll.bench.ts',
    )
    const updateBench = readWorkspaceFile(
      'packages/advanced/data-grid/benchmarks/data-grid-update.bench.ts',
    )
    const createRunIndex = metrics.indexOf(
      'const benchmark = createBenchmarkRun()',
    )
    const dynamicImportIndex = metrics.indexOf(
      "return import('../../../../e2e/advanced/data-grid/data-grid-runtime-harness')",
    )
    const mountIndex = metrics.indexOf(
      'return mountBenchmarkGrid(input, harness, diagnostics)',
    )
    const frameDurationIndex = metrics.indexOf(
      'frameDurationMs += performance.now() - frameStart',
    )
    const frameSnapshotIndex = metrics.indexOf(
      'const dom = captureDataGridDomSnapshot(grid)',
      frameDurationIndex,
    )

    expect(dynamicImportIndex).toBeGreaterThan(-1)
    expect(createRunIndex).toBeGreaterThan(dynamicImportIndex)
    expect(mountIndex).toBeGreaterThan(createRunIndex)
    expect(metrics).toContain('observeAllocations = false')
    expect(metrics).toMatch(
      /const diagnostics = observeAllocations\s+\? createBenchmarkDiagnostics\(\)\s+: undefined/,
    )
    expect(metrics).toMatch(
      /measureDataGridUpdates[\s\S]*?runMountedBenchmark\([\s\S]*?true,?\s*\)/,
    )
    expect(metrics).toMatch(
      /measureDataGridFirstRender[\s\S]*?runMountedBenchmark\(input, \(\) => \{[\s\S]*?sampleDataGridMemory\(\)[\s\S]*?performance\.now\(\)/,
    )
    expect(metrics).toMatch(
      /measureDataGridUpdates[\s\S]*?runMountedBenchmark\(\s*input,\s*\(\) => \{[\s\S]*?sampleDataGridMemory\(\)[\s\S]*?performance\.now\(\)/,
    )
    expect(frameDurationIndex).toBeGreaterThan(-1)
    expect(frameSnapshotIndex).toBeGreaterThan(frameDurationIndex)
    expect(renderBench).toContain(
      "console.info(formatDataGridBenchmarkResult('render', result))",
    )
    expect(scrollBench).toContain(
      "console.info(formatDataGridBenchmarkResult('scroll', result))",
    )
    expect(updateBench).toContain(
      "console.info(formatDataGridBenchmarkResult('update', result))",
    )
  })
})
