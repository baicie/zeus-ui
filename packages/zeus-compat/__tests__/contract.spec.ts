import { ZEUS_CAPABILITIES as UPSTREAM_ZEUS_CAPABILITIES } from '@zeus-js/zeus/capabilities'
import { describe, expect, it } from 'vitest'

import * as zeusCompat from '../src'

const compatExports = zeusCompat as Record<string, unknown>

describe('@zeus-web/zeus-compat contract', () => {
  it('exposes runtime component APIs required by primitives', () => {
    expect(typeof zeusCompat.defineElement).toBe('function')
    expect(zeusCompat.Host).toBeDefined()
    expect(zeusCompat.Slot).toBeDefined()
  })

  it('exposes only the current public reactive APIs', () => {
    for (const api of [
      'createSignal',
      'createMemo',
      'createEffect',
      'createRoot',
      'batch',
      'onCleanup',
    ]) {
      expect(compatExports[api], api).toBeTypeOf('function')
    }

    for (const api of [
      'computed',
      'effect',
      'nextTick',
      'scope',
      'state',
      'untrack',
      'watch',
    ]) {
      expect(compatExports, api).not.toHaveProperty(api)
    }
  })

  it('re-exports the upstream Zeus capability manifest', () => {
    expect(zeusCompat.ZEUS_CAPABILITIES).toBe(UPSTREAM_ZEUS_CAPABILITIES)
  })

  it('declares required Zeus capabilities', () => {
    expect(zeusCompat.ZEUS_CAPABILITIES.webComponents.defineElement).toBe(true)
    expect(zeusCompat.ZEUS_CAPABILITIES.webComponents.Host).toBe(true)
    expect(zeusCompat.ZEUS_CAPABILITIES.webComponents.Slot).toBe(true)
    expect(zeusCompat.ZEUS_CAPABILITIES.webComponents.props).toBe(true)
    expect(zeusCompat.ZEUS_CAPABILITIES.webComponents.attrs).toBe(true)
    expect(zeusCompat.ZEUS_CAPABILITIES.webComponents.events).toBe(true)
    expect(zeusCompat.ZEUS_CAPABILITIES.webComponents.styles).toBe(true)
  })

  it('passes required compatibility requirements', () => {
    expect(() => zeusCompat.assertZeusCompatRequirements()).not.toThrow()
  })
})
