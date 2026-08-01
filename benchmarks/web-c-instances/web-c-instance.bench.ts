import type { Browser } from '@playwright/test'
import type { WebCInstanceBenchmarkScenario } from './benchmark-config'
import type {
  WebCInstanceBenchmarkChurnSampleResult,
  WebCInstanceBenchmarkChurnSummary,
  WebCInstanceBenchmarkReport,
  WebCInstanceBenchmarkSampleResult,
  WebCInstanceBenchmarkSummary,
} from './benchmark-results'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from '@playwright/test'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { resolveBenchmarkRunConfig } from './benchmark-config'
import {
  summarizeBenchmarkChurnSamples,
  summarizeBenchmarkSamples,
} from './benchmark-results'
import { runBenchmarkChurnSample, runBenchmarkSample } from './benchmark-runner'

const BENCHMARK_RESULT_PREFIX = '[web-c-instance:benchmark]'
const BENCHMARK_CHURN_PREFIX = '[web-c-instance:churn]'
const RESULT_PATH = fileURLToPath(
  new URL('../../temp/web-c-instance-benchmark-results.json', import.meta.url),
)
const runConfig = resolveBenchmarkRunConfig()
const summaries: WebCInstanceBenchmarkSummary[] = []
const churnSummaries: WebCInstanceBenchmarkChurnSummary[] = []

let browser: Browser | undefined

function expectedValue(
  count: number,
  multiplier: number,
  offset: number,
): number {
  return count * multiplier + offset
}

function assertFiniteDuration(value: number): void {
  expect(Number.isFinite(value)).toBe(true)
  expect(value).toBeGreaterThanOrEqual(0)
}

function assertSample(
  sample: WebCInstanceBenchmarkSampleResult,
  scenario: WebCInstanceBenchmarkScenario,
): void {
  assertFiniteDuration(sample.mountMs)
  assertFiniteDuration(sample.updateMs)
  assertFiniteDuration(sample.disconnectMs)
  assertFiniteDuration(sample.reconnectMs)
  assertFiniteDuration(sample.disposeMs)
  expect(Number.isFinite(sample.heapMountedDeltaBytes)).toBe(true)
  expect(Number.isFinite(sample.heapRetainedBytes)).toBe(true)

  const expectedButtonCount = expectedValue(
    sample.count,
    scenario.buttonMultiplier,
    0,
  )
  const expectedCustomElementCount = expectedValue(
    sample.count,
    scenario.customElementMultiplier,
    scenario.customElementOffset,
  )
  const expectedTotalElementCount = expectedValue(
    sample.count,
    scenario.totalElementMultiplier,
    scenario.totalElementOffset,
  )
  const expectedUpdatedElementCount = expectedValue(
    sample.count,
    scenario.updatedElementMultiplier,
    scenario.updatedElementOffset,
  )

  expect(sample.mountStructure).toEqual({
    buttonCount: expectedButtonCount,
    customElementCount: expectedCustomElementCount,
    totalElementCount: expectedTotalElementCount,
    updatedElementCount: 0,
  })
  expect(sample.reconnectStructure).toEqual({
    buttonCount: expectedButtonCount,
    customElementCount: expectedCustomElementCount,
    totalElementCount: expectedTotalElementCount,
    updatedElementCount: expectedUpdatedElementCount,
  })
  expect(sample.documentCustomElementCountAfterDispose).toBe(0)
}

function runScenarioSamples(
  scenario: WebCInstanceBenchmarkScenario,
  count: number,
): Promise<WebCInstanceBenchmarkSummary> {
  const samples: WebCInstanceBenchmarkSampleResult[] = []
  let sequence = Promise.resolve()

  for (let sample = 1; sample <= runConfig.sampleCount; sample += 1) {
    sequence = sequence.then(() => {
      if (!browser) throw new Error('Benchmark browser is not available.')

      return runBenchmarkSample(browser, scenario, count, sample).then(
        result => {
          assertSample(result, scenario)
          samples.push(result)
        },
      )
    })
  }

  return sequence.then(() => summarizeBenchmarkSamples(samples))
}

function assertChurnSample(
  sample: WebCInstanceBenchmarkChurnSampleResult,
): void {
  expect(sample.heapRetainedBytesByRound).toHaveLength(runConfig.churn.rounds)
  expect(sample.documentCustomElementCountAfterDisposeByRound).toHaveLength(
    runConfig.churn.rounds,
  )

  for (const value of sample.heapRetainedBytesByRound) {
    expect(Number.isFinite(value)).toBe(true)
  }

  for (const count of sample.documentCustomElementCountAfterDisposeByRound) {
    expect(count).toBe(0)
  }
}

function runChurnScenarioSamples(
  scenario: WebCInstanceBenchmarkScenario,
): Promise<WebCInstanceBenchmarkChurnSummary> {
  const samples: WebCInstanceBenchmarkChurnSampleResult[] = []
  let sequence = Promise.resolve()

  for (let sample = 1; sample <= runConfig.sampleCount; sample += 1) {
    sequence = sequence.then(() => {
      if (!browser) throw new Error('Benchmark browser is not available.')

      return runBenchmarkChurnSample(
        browser,
        scenario,
        runConfig.churn.count,
        runConfig.churn.rounds,
        sample,
      ).then(result => {
        assertChurnSample(result)
        samples.push(result)
      })
    })
  }

  return sequence.then(() => summarizeBenchmarkChurnSamples(samples))
}

function writeReport(report: WebCInstanceBenchmarkReport): Promise<void> {
  return mkdir(dirname(RESULT_PATH), { recursive: true }).then(() => {
    return writeFile(
      RESULT_PATH,
      `${JSON.stringify(report, null, 2)}\n`,
      'utf8',
    )
  })
}

beforeAll(() => {
  return chromium
    .launch({
      headless: true,
      args: ['--enable-precise-memory-info'],
    })
    .then(nextBrowser => {
      browser = nextBrowser
    })
})

afterAll(() => {
  if (!browser) return Promise.resolve()

  const report: WebCInstanceBenchmarkReport = {
    generatedAt: new Date().toISOString(),
    browserVersion: browser.version(),
    profile: runConfig.profile,
    sampleCount: runConfig.sampleCount,
    summaries,
    churnSummaries,
  }

  return writeReport(report)
    .then(() => browser!.close())
    .then(() => {
      browser = undefined
    })
})

describe('web-c instance benchmark', () => {
  for (const scenario of runConfig.scenarios) {
    for (const count of scenario.counts) {
      it(`${scenario.label}: ${count} logical instances`, () => {
        return runScenarioSamples(scenario, count).then(summary => {
          summaries.push(summary)
          console.info(BENCHMARK_RESULT_PREFIX, JSON.stringify(summary))
        })
      })
    }
  }

  describe('same-page mount and dispose churn', () => {
    for (const scenario of runConfig.churn.scenarios) {
      it(`${scenario.label}: ${runConfig.churn.count} instances x ${runConfig.churn.rounds} rounds`, () => {
        return runChurnScenarioSamples(scenario).then(summary => {
          churnSummaries.push(summary)
          console.info(BENCHMARK_CHURN_PREFIX, JSON.stringify(summary))
        })
      })
    }
  })
})
