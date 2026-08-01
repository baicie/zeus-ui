import type { WebCInstanceBenchmarkProfile } from './benchmark-config'
import type {
  WebCInstanceBenchmarkKind,
  WebCStructureSnapshot,
} from './src/benchmark-types'

export interface WebCInstanceBenchmarkSampleResult {
  kind: WebCInstanceBenchmarkKind
  label: string
  count: number
  sample: number
  mountMs: number
  updateMs: number
  disconnectMs: number
  reconnectMs: number
  disposeMs: number
  heapMountedDeltaBytes: number
  heapRetainedBytes: number
  mountStructure: WebCStructureSnapshot
  reconnectStructure: WebCStructureSnapshot
  documentCustomElementCountAfterDispose: number
}

export interface WebCInstanceBenchmarkSummary {
  kind: WebCInstanceBenchmarkKind
  label: string
  count: number
  samples: number
  mountMedianMs: number
  updateMedianMs: number
  disconnectMedianMs: number
  reconnectMedianMs: number
  disposeMedianMs: number
  heapMountedDeltaMedianBytes: number
  heapRetainedMedianBytes: number
  structure: WebCStructureSnapshot
}

export interface WebCInstanceBenchmarkChurnSampleResult {
  kind: WebCInstanceBenchmarkKind
  label: string
  count: number
  sample: number
  heapRetainedBytesByRound: number[]
  documentCustomElementCountAfterDisposeByRound: number[]
}

export interface WebCInstanceBenchmarkChurnSummary {
  kind: WebCInstanceBenchmarkKind
  label: string
  count: number
  samples: number
  rounds: number
  heapRetainedMedianBytesByRound: number[]
  heapGrowthAfterFirstMedianBytes: number
}

export interface WebCInstanceBenchmarkReport {
  generatedAt: string
  browserVersion: string
  profile: WebCInstanceBenchmarkProfile
  sampleCount: number
  summaries: WebCInstanceBenchmarkSummary[]
  churnSummaries: WebCInstanceBenchmarkChurnSummary[]
}

function median(values: number[]): number {
  const sorted = values.slice().sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2
  }

  return sorted[middle]
}

function roundDuration(value: number): number {
  return Number(value.toFixed(3))
}

export function summarizeBenchmarkSamples(
  samples: WebCInstanceBenchmarkSampleResult[],
): WebCInstanceBenchmarkSummary {
  const first = samples[0]

  if (!first) throw new Error('Cannot summarize an empty benchmark sample.')

  return {
    kind: first.kind,
    label: first.label,
    count: first.count,
    samples: samples.length,
    mountMedianMs: roundDuration(median(samples.map(item => item.mountMs))),
    updateMedianMs: roundDuration(median(samples.map(item => item.updateMs))),
    disconnectMedianMs: roundDuration(
      median(samples.map(item => item.disconnectMs)),
    ),
    reconnectMedianMs: roundDuration(
      median(samples.map(item => item.reconnectMs)),
    ),
    disposeMedianMs: roundDuration(median(samples.map(item => item.disposeMs))),
    heapMountedDeltaMedianBytes: Math.round(
      median(samples.map(item => item.heapMountedDeltaBytes)),
    ),
    heapRetainedMedianBytes: Math.round(
      median(samples.map(item => item.heapRetainedBytes)),
    ),
    structure: first.reconnectStructure,
  }
}

export function summarizeBenchmarkChurnSamples(
  samples: WebCInstanceBenchmarkChurnSampleResult[],
): WebCInstanceBenchmarkChurnSummary {
  const first = samples[0]

  if (!first) throw new Error('Cannot summarize empty benchmark churn samples.')

  const rounds = first.heapRetainedBytesByRound.length
  const heapRetainedMedianBytesByRound: number[] = []

  for (let round = 0; round < rounds; round += 1) {
    heapRetainedMedianBytesByRound.push(
      Math.round(
        median(samples.map(item => item.heapRetainedBytesByRound[round])),
      ),
    )
  }

  return {
    kind: first.kind,
    label: first.label,
    count: first.count,
    samples: samples.length,
    rounds,
    heapRetainedMedianBytesByRound,
    heapGrowthAfterFirstMedianBytes: Math.round(
      median(
        samples.map(item => {
          const values = item.heapRetainedBytesByRound
          return values[values.length - 1] - values[0]
        }),
      ),
    ),
  }
}
