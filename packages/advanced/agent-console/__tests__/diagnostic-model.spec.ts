import { describe, expect, it } from 'vitest'

import {
  addAgentConsoleDiagnostic,
  createAgentConsoleDiagnostic,
  getAgentConsoleDiagnosticById,
  getAgentConsoleDiagnosticsByLevel,
} from '../src/core'

describe('diagnostic model', () => {
  it('creates diagnostic', () => {
    expect(
      createAgentConsoleDiagnostic({
        id: 'd1',
        level: 'warning',
        message: 'Slow tool',
        source: 'tool',
        createdAt: 1,
      }),
    ).toEqual({
      id: 'd1',
      level: 'warning',
      message: 'Slow tool',
      source: 'tool',
      createdAt: 1,
      metadata: undefined,
    })
  })

  it('adds and filters diagnostics', () => {
    const diagnostics = [
      ...addAgentConsoleDiagnostic([], {
        id: 'd1',
        level: 'info',
        message: 'Start',
      }),
      ...addAgentConsoleDiagnostic([], {
        id: 'd2',
        level: 'error',
        message: 'Failed',
      }),
    ]

    expect(getAgentConsoleDiagnosticById(diagnostics, 'd2')?.message).toBe(
      'Failed',
    )
    expect(
      getAgentConsoleDiagnosticsByLevel(diagnostics, 'error'),
    ).toHaveLength(1)
  })
})
