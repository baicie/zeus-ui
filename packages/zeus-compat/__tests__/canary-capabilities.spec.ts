// Canary-only contract test: verifies @zeus-js/zeus/capabilities is actually exported
// by the installed Zeus package. This test MUST pass on canary CI and MUST NOT be
// included in the regular unit test suite.
//
// The local zeus-capabilities.d.ts provides types so this file type-checks against
// the beta. When Zeus exports @zeus-js/zeus/capabilities, this declaration file
// should be deleted to use the real types instead.

import { describe, expect, it } from 'vitest'

describe('@zeus-js/zeus/capabilities canary contract', () => {
  it('exports a valid ZEUS_CAPABILITIES object', async () => {
    const mod = (await import('@zeus-js/zeus/capabilities')) as {
      ZEUS_CAPABILITIES: unknown
    }

    expect(mod.ZEUS_CAPABILITIES).toBeDefined()
    expect(typeof mod.ZEUS_CAPABILITIES).toBe('object')
  })

  it('declares required web component features as available', async () => {
    const mod = (await import('@zeus-js/zeus/capabilities')) as {
      ZEUS_CAPABILITIES: {
        webComponents: {
          defineElement: boolean
          Host: boolean
          Slot: boolean
          props: boolean
          attrs: boolean
          events: boolean
        }
      }
    }

    expect(mod.ZEUS_CAPABILITIES.webComponents.defineElement).toBe(true)
    expect(mod.ZEUS_CAPABILITIES.webComponents.Host).toBe(true)
    expect(mod.ZEUS_CAPABILITIES.webComponents.Slot).toBe(true)
    expect(mod.ZEUS_CAPABILITIES.webComponents.props).toBe(true)
    expect(mod.ZEUS_CAPABILITIES.webComponents.attrs).toBe(true)
    expect(mod.ZEUS_CAPABILITIES.webComponents.events).toBe(true)
  })

  it('has a non-fallback version string', async () => {
    const mod = (await import('@zeus-js/zeus/capabilities')) as {
      ZEUS_CAPABILITIES: { version: string }
    }

    expect(mod.ZEUS_CAPABILITIES.version).not.toBe('0.1.0-beta.0')
  })
})
