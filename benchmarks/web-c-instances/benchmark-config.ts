import type { WebCInstanceBenchmarkKind } from './src/benchmark-types'

import process from 'node:process'

export type WebCInstanceBenchmarkProfile = 'full' | 'smoke'

export interface WebCInstanceBenchmarkScenario {
  label: string
  kind: WebCInstanceBenchmarkKind
  counts: number[]
  buttonMultiplier: number
  customElementMultiplier: number
  customElementOffset: number
  totalElementMultiplier: number
  totalElementOffset: number
  updatedElementMultiplier: number
  updatedElementOffset: number
}

export interface WebCInstanceBenchmarkRunConfig {
  profile: WebCInstanceBenchmarkProfile
  sampleCount: number
  scenarios: WebCInstanceBenchmarkScenario[]
  churn: WebCInstanceBenchmarkChurnConfig
}

export interface WebCInstanceBenchmarkChurnConfig {
  count: number
  rounds: number
  scenarios: WebCInstanceBenchmarkScenario[]
}

const FULL_CONTROL_COUNTS = [100, 1_000, 5_000]
const FULL_COMPOSITE_COUNTS = [100, 500, 1_000]
const SMOKE_CONTROL_COUNTS = [10]
const SMOKE_COMPOSITE_COUNTS = [5]

function resolveProfile(): WebCInstanceBenchmarkProfile {
  return process.env.ZEUS_WEB_C_BENCH_PROFILE === 'smoke' ? 'smoke' : 'full'
}

function resolveSampleCount(profile: WebCInstanceBenchmarkProfile): number {
  const configured = process.env.ZEUS_WEB_C_BENCH_SAMPLES

  if (configured === undefined) return profile === 'smoke' ? 1 : 3

  const sampleCount = Number(configured)

  if (!Number.isInteger(sampleCount) || sampleCount <= 0 || sampleCount > 10) {
    throw new TypeError(
      'ZEUS_WEB_C_BENCH_SAMPLES must be an integer between 1 and 10.',
    )
  }

  return sampleCount
}

function createScenario(
  label: string,
  kind: WebCInstanceBenchmarkKind,
  counts: number[],
  metrics: {
    buttonMultiplier: number
    customElementMultiplier: number
    customElementOffset: number
    totalElementMultiplier: number
    totalElementOffset: number
    updatedElementMultiplier: number
    updatedElementOffset: number
  },
): WebCInstanceBenchmarkScenario {
  return {
    label,
    kind,
    counts,
    buttonMultiplier: metrics.buttonMultiplier,
    customElementMultiplier: metrics.customElementMultiplier,
    customElementOffset: metrics.customElementOffset,
    totalElementMultiplier: metrics.totalElementMultiplier,
    totalElementOffset: metrics.totalElementOffset,
    updatedElementMultiplier: metrics.updatedElementMultiplier,
    updatedElementOffset: metrics.updatedElementOffset,
  }
}

export function resolveBenchmarkRunConfig(): WebCInstanceBenchmarkRunConfig {
  const profile = resolveProfile()
  const controlCounts =
    profile === 'smoke' ? SMOKE_CONTROL_COUNTS : FULL_CONTROL_COUNTS
  const compositeCounts =
    profile === 'smoke' ? SMOKE_COMPOSITE_COUNTS : FULL_COMPOSITE_COUNTS

  const baselineMetrics = {
    buttonMultiplier: 1,
    customElementMultiplier: 0,
    customElementOffset: 0,
    totalElementMultiplier: 1,
    totalElementOffset: 1,
    updatedElementMultiplier: 1,
    updatedElementOffset: 0,
  }
  const buttonMetrics = {
    buttonMultiplier: 1,
    customElementMultiplier: 1,
    customElementOffset: 0,
    totalElementMultiplier: 5,
    totalElementOffset: 1,
    updatedElementMultiplier: 1,
    updatedElementOffset: 0,
  }
  const accordionMetrics = {
    buttonMultiplier: 1,
    customElementMultiplier: 3,
    customElementOffset: 1,
    totalElementMultiplier: 4,
    totalElementOffset: 2,
    updatedElementMultiplier: 0,
    updatedElementOffset: 1,
  }
  const scenarios = [
    createScenario(
      'native button baseline',
      'native-button-baseline',
      controlCounts,
      baselineMetrics,
    ),
    createScenario(
      'native zw-button',
      'native-button',
      controlCounts,
      buttonMetrics,
    ),
    createScenario(
      'React zw-button wrapper',
      'react-button',
      controlCounts,
      buttonMetrics,
    ),
    createScenario(
      'Vue native button baseline',
      'vue-button-baseline',
      controlCounts,
      baselineMetrics,
    ),
    createScenario(
      'Vue native zw-button',
      'vue-native-button',
      controlCounts,
      buttonMetrics,
    ),
    createScenario(
      'Vue zw-button wrapper',
      'vue-button',
      controlCounts,
      buttonMetrics,
    ),
    createScenario(
      'native accordion items',
      'native-accordion',
      compositeCounts,
      accordionMetrics,
    ),
  ]
  const churnScenarios = scenarios.filter(scenario => {
    return (
      scenario.kind === 'native-button' ||
      scenario.kind === 'react-button' ||
      scenario.kind === 'vue-button-baseline' ||
      scenario.kind === 'vue-native-button' ||
      scenario.kind === 'vue-button'
    )
  })

  return {
    profile,
    sampleCount: resolveSampleCount(profile),
    scenarios,
    churn: {
      count: profile === 'smoke' ? 10 : 1_000,
      rounds: profile === 'smoke' ? 2 : 5,
      scenarios: churnScenarios,
    },
  }
}
