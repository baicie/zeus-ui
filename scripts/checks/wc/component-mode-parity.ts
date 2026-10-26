import type { ModeFixtureResult } from './component-mode-fixture'

import { deepStrictEqual, strictEqual } from 'node:assert'

export interface ComponentModeRun {
  browser: string
  mode: 'eager' | 'lazy'
  status: 'passed' | 'failed'
  result?: ModeFixtureResult
  error?: string
}

export function verifyComponentModeRuns(
  browsers: string[],
  results: ComponentModeRun[],
): void {
  strictEqual(
    results.length,
    browsers.length * 2,
    'Every browser must complete exactly one eager and one lazy run',
  )
  for (const browser of browsers) {
    const pair = results.filter(result => result.browser === browser)
    const eager = pair.find(result => result.mode === 'eager')
    const lazy = pair.find(result => result.mode === 'lazy')
    strictEqual(pair.length, 2, `${browser} has missing or duplicate runs`)
    if (!eager || eager.status !== 'passed' || !eager.result) {
      throw new Error(`${browser} eager run failed`)
    }
    if (!lazy || lazy.status !== 'passed' || !lazy.result) {
      throw new Error(`${browser} lazy run failed`)
    }
    verifyComponentModeParity(eager.result, lazy.result)
  }
}

export function verifyComponentModeParity(
  eager: ModeFixtureResult,
  lazy: ModeFixtureResult,
): void {
  const expected = [
    'upgrade',
    'updates',
    'runtime-move',
    'imperative',
    'move',
    'dispose',
    'reconnect',
  ]
  deepStrictEqual(
    eager.stages.map(stage => stage.name),
    expected,
    'eager fixture did not complete every lifecycle stage',
  )
  deepStrictEqual(
    lazy.stages.map(stage => stage.name),
    expected,
    'lazy fixture did not complete every lifecycle stage',
  )
  deepStrictEqual(
    eager.stages,
    lazy.stages,
    'Real Golden component eager/lazy observations differ',
  )
}
