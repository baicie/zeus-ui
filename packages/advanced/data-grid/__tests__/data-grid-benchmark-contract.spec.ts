import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { DATA_GRID_BENCHMARK_SCENARIOS } from '../benchmarks/benchmark-data'

const workspaceRoot = existsSync(resolve(process.cwd(), 'pnpm-workspace.yaml'))
  ? process.cwd()
  : resolve(process.cwd(), '../../..')
const tsxCli = createRequire(import.meta.url).resolve('tsx/cli')
const tempRoots: string[] = []

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

interface BenchmarkTsconfig {
  include?: string[]
  compilerOptions?: {
    rootDir?: string
    types?: string[]
  }
}

interface DataGridPackageJson {
  version: string
  scripts?: Record<string, string>
}

interface BenchmarkBaselineManifest {
  schemaVersion: number
  baselineId: string
  recordedAt: string
  commit: string
  packageVersion: string
  dataMode: string
  budgetPolicy: {
    maxRenderedCells: number
  }
  scenarios: Array<{
    name: string
    rowCount: number
    columnCount: number
    observed: Record<string, number>
    memoryTrend: Record<
      'render' | 'scroll' | 'update',
      { heapUsedDelta: number; rssDelta: number }
    >
  }>
}

function readWorkspaceFile(path: string): string {
  return readFileSync(resolve(workspaceRoot, path), 'utf-8')
}

function readWorkspaceJson<T>(path: string): T {
  return JSON.parse(readWorkspaceFile(path)) as T
}

describe('data-grid benchmark contract', () => {
  it('keeps package typecheck scoped to src and shared JSX declarations', () => {
    const tsconfig = readWorkspaceJson<BenchmarkTsconfig>(
      'packages/advanced/data-grid/tsconfig.json',
    )

    expect(tsconfig.include).toEqual([
      'src',
      '../../../scripts/config/jsx.d.ts',
    ])
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
      '../../../scripts/config/jsx.d.ts',
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
    expect(vitestConfig).toContain('plugins: [advancedComponentsCompiler()]')
    expect(vitestConfig).toContain('transformModule({')
    expect(vitestConfig).toContain("runtimeModule: '@zeus-js/runtime-dom'")
    expect(vitestConfig).not.toContain('transformAsync')
    expect(vitestConfig).toContain('replacement: zeusBundlerEsmPath')
    expect(workflow).toContain('data-grid-benchmark:')
    expect(workflow).toContain('pnpm --filter @zeus-web/data-grid check:bench')
    expect(workflow).toContain('pnpm data-grid:bench')
  })

  it('keeps a versioned baseline manifest and CI report artifact', () => {
    const manifest = readWorkspaceJson<BenchmarkBaselineManifest>(
      'packages/advanced/data-grid/benchmarks/baseline-manifest.json',
    )
    const pkg = readWorkspaceJson<DataGridPackageJson>('package.json')
    const workflow = readWorkspaceFile('.github/workflows/test.yml')

    expect(manifest.schemaVersion).toBe(1)
    expect(manifest.baselineId).toMatch(/^u005-data-grid-\d{4}-\d{2}-\d{2}$/)
    expect(manifest.packageVersion).toMatch(
      /^\d+\.\d+\.\d+(?:-[\da-z.-]+)?(?:\+[\da-z.-]+)?$/i,
    )
    expect(manifest.dataMode).toBe('sparse')
    expect(manifest.budgetPolicy.maxRenderedCells).toBe(600)
    expect(manifest.scenarios).toHaveLength(
      DATA_GRID_BENCHMARK_SCENARIOS.length,
    )
    for (const scenario of manifest.scenarios) {
      expect(Object.keys(scenario.memoryTrend).sort()).toEqual([
        'render',
        'scroll',
        'update',
      ])
      for (const phase of ['render', 'scroll', 'update'] as const) {
        expect(Number.isFinite(scenario.memoryTrend[phase].heapUsedDelta)).toBe(
          true,
        )
        expect(Number.isFinite(scenario.memoryTrend[phase].rssDelta)).toBe(true)
      }
    }
    expect(pkg.scripts?.['check:data-grid-benchmark-baseline']).toBe(
      'tsx scripts/checks/data-grid/check-benchmark-baseline.ts',
    )
    expect(pkg.scripts?.['report:data-grid-benchmark']).toBe(
      'tsx scripts/checks/data-grid/report-benchmark.ts',
    )
    expect(workflow).toContain(
      ['data-grid-benchmark-', '$', '{{ github.run_id }}'].join(''),
    )
    expect(workflow).toContain('.artifacts/data-grid-benchmark/report.json')
    expect(workflow).toContain('set -o pipefail')
  })

  it('preserves the recorded source of the 2026-10-24 baseline', () => {
    const manifest = readWorkspaceJson<BenchmarkBaselineManifest>(
      'packages/advanced/data-grid/benchmarks/baseline-manifest.json',
    )
    const report = readWorkspaceJson<{ source: string }>(
      'packages/advanced/data-grid/benchmarks/baselines/u005-data-grid-2026-10-24-report.json',
    )

    expect(manifest).toMatchObject({
      baselineId: 'u005-data-grid-2026-10-24',
      recordedAt: '2026-10-24',
      commit: 'd28d8a0047742d507d69f6f1c629231ddeca133e',
      packageVersion: '0.1.0',
    })
    expect(report.source).toBe('zeus-ui-data-grid-0.1.0-2026-10-24.log')
  })

  it.each(['0.1.0', '0.1.0-beta.34', '0.1.0+benchmark.1'])(
    'accepts valid SemVer %s in a synthetic fixture after the package advances',
    recordedVersion => {
      expect(runBaselineCheck(recordedVersion, '0.2.0')).toContain(
        'Data Grid benchmark baseline check passed',
      )
    },
  )

  it.each(['', 'latest', '^0.1.0', '01.2.3', '0.1.0-beta.01', '0.1.0-'])(
    'rejects invalid recorded baseline version %j',
    recordedVersion => {
      expect(() => runBaselineCheck(recordedVersion, '0.2.0')).toThrow(
        'packageVersion must be a valid recorded semver version',
      )
    },
  )

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

function runBaselineCheck(
  recordedVersion: string,
  currentVersion: string,
): string {
  const root = mkdtempSync(join(tmpdir(), 'zeus-data-grid-baseline-'))
  tempRoots.push(root)
  const manifest = readWorkspaceJson<BenchmarkBaselineManifest>(
    'packages/advanced/data-grid/benchmarks/baseline-manifest.json',
  )
  manifest.packageVersion = recordedVersion
  const manifestPath = resolve(
    root,
    'packages/advanced/data-grid/benchmarks/baseline-manifest.json',
  )
  mkdirSync(dirname(manifestPath), { recursive: true })
  writeFileSync(manifestPath, JSON.stringify(manifest))
  writeFileSync(
    resolve(root, 'packages/advanced/data-grid/package.json'),
    JSON.stringify({ version: currentVersion }),
  )
  return execFileSync(
    process.execPath,
    [
      tsxCli,
      resolve(
        workspaceRoot,
        'scripts/checks/data-grid/check-benchmark-baseline.ts',
      ),
    ],
    { cwd: root, encoding: 'utf8', stdio: 'pipe', timeout: 10_000 },
  )
}
