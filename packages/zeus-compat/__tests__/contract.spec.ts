import { ZEUS_CAPABILITIES as UPSTREAM_ZEUS_CAPABILITIES } from '@zeus-js/zeus/capabilities'
import { describe, expect, it } from 'vitest'

import {
  assertZeusCompatRequirements,
  defineElement,
  Host,
  Slot,
  ZEUS_CAPABILITIES,
} from '../src'

describe('@zeus-web/zeus-compat contract', () => {
  it('exposes runtime component APIs required by primitives', () => {
    expect(typeof defineElement).toBe('function')
    expect(Host).toBeDefined()
    expect(Slot).toBeDefined()
  })

  it('re-exports the upstream Zeus capability manifest', () => {
    expect(ZEUS_CAPABILITIES).toBe(UPSTREAM_ZEUS_CAPABILITIES)
  })

  it('declares required Zeus capabilities', () => {
    expect(ZEUS_CAPABILITIES.webComponents.defineElement).toBe(true)
    expect(ZEUS_CAPABILITIES.webComponents.Host).toBe(true)
    expect(ZEUS_CAPABILITIES.webComponents.Slot).toBe(true)
    expect(ZEUS_CAPABILITIES.webComponents.props).toBe(true)
    expect(ZEUS_CAPABILITIES.webComponents.attrs).toBe(true)
    expect(ZEUS_CAPABILITIES.webComponents.events).toBe(true)
    expect(ZEUS_CAPABILITIES.webComponents.styles).toBe(true)
  })

  it('passes required compatibility requirements', () => {
    expect(() => assertZeusCompatRequirements()).not.toThrow()
  })
})
