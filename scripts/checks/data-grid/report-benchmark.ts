import { readFile, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'

const [inputArg, outputArg] = process.argv.slice(2)
if (!inputArg || !outputArg) {
  throw new Error('Usage: report-benchmark.ts <benchmark-log> <report-json>')
}

const inputPath = resolve(process.cwd(), inputArg)
const outputPath = resolve(process.cwd(), outputArg)
const lines = (await readFile(inputPath, 'utf8')).split(/\r?\n/)
const prefix = '[data-grid:benchmark] '
const runs = lines
  .filter(line => line.startsWith(prefix))
  .map(line => JSON.parse(line.slice(prefix.length)) as BenchmarkRun)

if (runs.length === 0) {
  throw new Error(`No benchmark JSON lines found in ${inputPath}`)
}

const report = {
  schemaVersion: 1,
  source: basename(inputPath),
  generatedAt: new Date().toISOString(),
  runCount: runs.length,
  runs: runs.map(run => ({
    kind: run.kind,
    scenario: run.result.name,
    metrics: selectMetrics(run),
  })),
}

await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`)
console.info(`Data Grid benchmark report written: ${outputPath}`)

interface BenchmarkRun {
  kind: 'render' | 'scroll' | 'update'
  result: {
    name: string
    firstRenderMs?: number
    averageFrameLatencyMs?: number
    framesPerSecond?: number
    rowsUpdateMs?: number
    columnsUpdateMs?: number
    memoryTrend?: { heapUsedDelta: number; rssDelta: number }
    dom?: { renderedCells: number; totalElements: number }
    renderedCellsMax?: number
  }
}

function selectMetrics(run: BenchmarkRun): Record<string, number> {
  const result = run.result
  const metrics: Record<string, number> = {}
  for (const key of [
    'firstRenderMs',
    'averageFrameLatencyMs',
    'framesPerSecond',
    'rowsUpdateMs',
    'columnsUpdateMs',
    'renderedCellsMax',
  ] as const) {
    const value = result[key]
    if (typeof value === 'number' && Number.isFinite(value))
      metrics[key] = value
  }
  if (result.dom) {
    metrics.renderedCells = result.dom.renderedCells
    metrics.totalElements = result.dom.totalElements
  }
  if (result.memoryTrend) {
    metrics.heapUsedDelta = result.memoryTrend.heapUsedDelta
    metrics.rssDelta = result.memoryTrend.rssDelta
  }
  return metrics
}
