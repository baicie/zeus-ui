import { ZEUS_CAPABILITIES } from '@zeus-js/zeus/capabilities'
import { describe, expect, it } from 'vitest'

describe('@zeus-js/zeus/capabilities canary contract', () => {
  it('exports a valid Zeus capability manifest', () => {
    expect(ZEUS_CAPABILITIES.packageName).toBe('@zeus-js/zeus')
    expect(typeof ZEUS_CAPABILITIES.version).toBe('string')
    expect(ZEUS_CAPABILITIES.version).toMatch(/-canary(?:[.-]|$)/)
  })

  it('declares required web component features as available', () => {
    expect(ZEUS_CAPABILITIES.webComponents.defineElement).toBe(true)
    expect(ZEUS_CAPABILITIES.webComponents.Host).toBe(true)
    expect(ZEUS_CAPABILITIES.webComponents.Slot).toBe(true)
    expect(ZEUS_CAPABILITIES.webComponents.props).toBe(true)
    expect(ZEUS_CAPABILITIES.webComponents.attrs).toBe(true)
    expect(ZEUS_CAPABILITIES.webComponents.events).toBe(true)
    expect(ZEUS_CAPABILITIES.webComponents.styles).toBe(true)
  })
})
