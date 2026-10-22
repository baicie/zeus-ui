import type { DataGridBenchmarkScenario } from '../../../packages/advanced/data-grid/benchmarks/benchmark-data'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { DATA_GRID_BENCHMARK_SCENARIOS } from '../../../packages/advanced/data-grid/benchmarks/benchmark-data'

interface BenchmarkBaselineScenario {
  name: string
  rowCount: number
  columnCount: number
  observed: Record<string, number>
  memoryTrend: Partial<
    Record<'render' | 'scroll' | 'update', Record<string, number>>
  >
}

interface BenchmarkBaselineManifest {
  schemaVersion: number
  baselineId: string
  recordedAt: string
  commit: string
  packageVersion: string
  dataMode: string
  command: string
  environment: Record<string, string>
  budgetPolicy: {
    maxRenderedCells: number
    timing: string
    memory: string
  }
  scenarios: BenchmarkBaselineScenario[]
}

const root = process.cwd()
const manifestPath = resolve(
  root,
  'packages/advanced/data-grid/benchmarks/baseline-manifest.json',
)
const packagePath = resolve(root, 'packages/advanced/data-grid/package.json')
const manifest = readJson<BenchmarkBaselineManifest>(manifestPath)
const packageJson = readJson<{ version?: string }>(packagePath)

assert(manifest.schemaVersion === 1, 'schemaVersion must be 1')
assert(
  /^u005-data-grid-\d{4}-\d{2}-\d{2}$/.test(manifest.baselineId),
  'baselineId must include the recording date',
)
assert(
  /^\d{4}-\d{2}-\d{2}$/.test(manifest.recordedAt),
  'recordedAt must be an ISO date',
)
assert(/^[0-9a-f]{40}$/.test(manifest.commit), 'commit must be a full git SHA')
assert(
  manifest.packageVersion === packageJson.version,
  'manifest packageVersion must match the package',
)
assert(
  manifest.dataMode === 'sparse',
  'the committed baseline must use sparse benchmark data',
)
assert(
  manifest.budgetPolicy.maxRenderedCells > 0,
  'maxRenderedCells must be positive',
)
assert(
  manifest.budgetPolicy.timing.length > 0,
  'timing budget policy is required',
)
assert(
  manifest.budgetPolicy.memory.length > 0,
  'memory budget policy is required',
)

const expected = new Map(
  DATA_GRID_BENCHMARK_SCENARIOS.map(scenario => [scenario.name, scenario]),
)
assert(
  manifest.scenarios.length === expected.size,
  'baseline must cover every benchmark scenario',
)
const seen = new Set<string>()

for (const scenario of manifest.scenarios) {
  const source = expected.get(scenario.name)
  assert(source !== undefined, `unknown benchmark scenario: ${scenario.name}`)
  assert(
    !seen.has(scenario.name),
    `duplicate benchmark scenario: ${scenario.name}`,
  )
  seen.add(scenario.name)
  assertScenarioShape(scenario, source)
}

for (const scenario of DATA_GRID_BENCHMARK_SCENARIOS) {
  assert(
    seen.has(scenario.name),
    `missing benchmark scenario: ${scenario.name}`,
  )
}

console.info(
  `Data Grid benchmark baseline check passed: ${manifest.baselineId}`,
)

function assertScenarioShape(
  scenario: BenchmarkBaselineScenario,
  source: DataGridBenchmarkScenario,
): void {
  assert(
    scenario.rowCount === source.rowCount,
    `${scenario.name}: rowCount drifted`,
  )
  assert(
    scenario.columnCount === source.columnCount,
    `${scenario.name}: columnCount drifted`,
  )
  for (const [metric, value] of Object.entries(scenario.observed)) {
    assert(
      Number.isFinite(value) && value >= 0,
      `${scenario.name}: ${metric} must be a non-negative number`,
    )
  }
  for (const phase of ['render', 'scroll', 'update'] as const) {
    const memory = scenario.memoryTrend?.[phase]
    assert(
      memory !== undefined,
      `${scenario.name}: missing ${phase} memoryTrend`,
    )
    assert(
      Object.keys(memory).sort().join(',') === 'heapUsedDelta,rssDelta',
      `${scenario.name}: ${phase} memoryTrend must include heapUsedDelta and rssDelta`,
    )
    for (const [metric, value] of Object.entries(memory)) {
      assert(
        Number.isFinite(value),
        `${scenario.name}: ${phase} ${metric} must be finite`,
      )
    }
  }
  for (const metric of [
    'firstRenderMs',
    'averageFrameLatencyMs',
    'framesPerSecond',
    'rowsUpdateMs',
    'columnsUpdateMs',
  ]) {
    assert(
      scenario.observed[metric] !== undefined,
      `${scenario.name}: missing ${metric}`,
    )
  }
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`[data-grid:baseline] ${message}`)
}
