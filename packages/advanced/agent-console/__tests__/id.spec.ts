import { describe, expect, it } from 'vitest'

import {
  createAgentConsoleId,
  normalizeAgentConsoleId,
  resetAgentConsoleIdCounter,
} from '../src/core'

describe('agent console id', () => {
  it('creates deterministic incrementing ids', () => {
    resetAgentConsoleIdCounter()

    expect(createAgentConsoleId('x')).toBe('x-1')
    expect(createAgentConsoleId('x')).toBe('x-2')
    expect(createAgentConsoleId('msg')).toBe('msg-3')
  })

  it('normalizes provided ids', () => {
    resetAgentConsoleIdCounter()

    expect(normalizeAgentConsoleId('custom', 'x')).toBe('custom')
    expect(normalizeAgentConsoleId('', 'x')).toBe('x-1')
    expect(normalizeAgentConsoleId(undefined, 'x')).toBe('x-2')
  })
})
