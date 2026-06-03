import { describe, expect, it } from 'vitest'

import {
  assertZeusCompatRequirements,
  defineElement,
  getZeusCapabilities,
  Host,
  resolveZeusCapabilities,
  Slot,
  ZEUS_CAPABILITIES,
} from '../src'

describe('@zeus-web/zeus-compat contract', () => {
  it('exposes runtime component APIs required by primitives', () => {
    expect(typeof defineElement).toBe('function')
    expect(Host).toBeDefined()
    expect(Slot).toBeDefined()
  })

  it('declares required Zeus capabilities', () => {
    expect(ZEUS_CAPABILITIES.webComponents.defineElement).toBe(true)
    expect(ZEUS_CAPABILITIES.webComponents.Host).toBe(true)
    expect(ZEUS_CAPABILITIES.webComponents.Slot).toBe(true)
    expect(ZEUS_CAPABILITIES.webComponents.props).toBe(true)
    expect(ZEUS_CAPABILITIES.webComponents.attrs).toBe(true)
    expect(ZEUS_CAPABILITIES.webComponents.events).toBe(true)
  })

  it('passes required compatibility requirements', () => {
    expect(() => assertZeusCompatRequirements()).not.toThrow()
  })

  it('supports dynamic resolution of Zeus capabilities', async () => {
    await resolveZeusCapabilities()
    // After resolving, getZeusCapabilities() should return the same object
    // as the static ZEUS_CAPABILITIES export (either fallback or real Zeus).
    const resolved = getZeusCapabilities()
    expect(resolved).toBeDefined()
    expect(resolved.webComponents).toBeDefined()
    expect(typeof resolved.webComponents.defineElement).toBe('boolean')
  })
})
