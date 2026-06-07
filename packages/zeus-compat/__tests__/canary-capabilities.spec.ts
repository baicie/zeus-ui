import * as zeus from '@zeus-js/zeus'
import { ZEUS_CAPABILITIES } from '@zeus-js/zeus/capabilities'
import { describe, expect, it } from 'vitest'

describe('@zeus-js/zeus canary contract', () => {
  it('exports the required public runtime APIs', () => {
    expect(typeof zeus.defineElement).toBe('function')
    expect(zeus.Host).toBeDefined()
    expect(zeus.Slot).toBeDefined()
    expect(typeof zeus.state).toBe('function')
    expect(typeof zeus.effect).toBe('function')
  })

  it('exports a valid Zeus capability manifest', () => {
    expect(ZEUS_CAPABILITIES.packageName).toBe('@zeus-js/zeus')
    expect(typeof ZEUS_CAPABILITIES.version).toBe('string')
    // Only verify canary version format when running against an installed canary
    // package (CI sets ZEUS_VERSION=canary after `pnpm add @zeus-js/zeus@canary`).
    // In workspace dev mode, @zeus-js/zeus resolves to the beta workspace link.
    const isCanaryRun = ZEUS_CAPABILITIES.version.includes('canary')

    if (isCanaryRun) {
      expect(ZEUS_CAPABILITIES.version).toMatch(/^0\.1\.0-canary/)
    } else {
      expect(ZEUS_CAPABILITIES).toMatchObject({
        packageName: '@zeus-js/zeus',
        webComponents: {
          defineElement: true,
          Host: true,
          Slot: true,
          props: true,
          attrs: true,
          events: true,
          styles: true,
        },
      })
    }
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
