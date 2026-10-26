import type { ModeFixtureResult } from '../wc/component-mode-fixture'
import {
  verifyComponentModeParity,
  verifyComponentModeRuns,
} from '../wc/component-mode-parity'

function complete(): ModeFixtureResult {
  return {
    stages: [
      'upgrade',
      'updates',
      'runtime-move',
      'imperative',
      'move',
      'dispose',
      'reconnect',
    ].map(name => ({ name, values: { value: 'same' } })),
  }
}

describe('real component mode parity evidence', () => {
  it('accepts equal observations after all required lifecycle stages', () => {
    expect(() =>
      verifyComponentModeParity(complete(), complete()),
    ).not.toThrow()
  })
  it('rejects equal but incomplete observations', () => {
    expect(() =>
      verifyComponentModeParity({ stages: [] }, { stages: [] }),
    ).toThrow('every lifecycle stage')
  })
  it('keeps discarded internal DOM diagnostics outside the live contract', () => {
    const eager = complete()
    const lazy = complete()
    eager.diagnostics = { disposedControls: { triggerExpanded: 'true' } }
    lazy.diagnostics = { disposedControls: { triggerExpanded: 'false' } }
    expect(() => verifyComponentModeParity(eager, lazy)).not.toThrow()
  })
  it('rejects attribute or cleanup differences between real modes', () => {
    const lazy = complete()
    lazy.stages[5].values = { value: 'leaked event' }
    expect(() => verifyComponentModeParity(complete(), lazy)).toThrow(
      'observations differ',
    )
  })
  it('rejects a cleanup failure after both browser fixtures passed', () => {
    expect(() =>
      verifyComponentModeRuns(
        ['chromium'],
        [
          {
            browser: 'chromium',
            mode: 'eager',
            status: 'passed',
            result: complete(),
          },
          {
            browser: 'chromium',
            mode: 'lazy',
            status: 'passed',
            result: complete(),
          },
          {
            browser: 'chromium',
            mode: 'lazy',
            status: 'failed',
            error: 'server.close failed',
          },
        ],
      ),
    ).toThrow('exactly one eager and one lazy run')
  })
  it('rejects a failed or missing requested browser mode', () => {
    expect(() =>
      verifyComponentModeRuns(
        ['chromium'],
        [
          {
            browser: 'chromium',
            mode: 'eager',
            status: 'passed',
            result: complete(),
          },
          {
            browser: 'chromium',
            mode: 'lazy',
            status: 'failed',
            error: 'browser unavailable',
          },
        ],
      ),
    ).toThrow('chromium lazy run failed')
  })
})
