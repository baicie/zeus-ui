import type { AvailabilityProbe, EngineName } from '../ai/support/browsers'
import path from 'node:path'

import process from 'node:process'

import { describe, expect, it } from 'vitest'
import {
  ALL_ENGINES,
  browserCache,
  requireBrowsers,
  selectBrowsers,
} from '../ai/support/browsers'

/**
 * The browser selection is a gate's fail-closed boundary.
 *
 * Before R6-B every Workbench check filtered the requested engines down to the
 * ones it recognised and trusted the result. An empty list produced zero
 * results, and `[].every(r => r.passed)` is `true` — so `pnpm check:ai-workbench`
 * on a runner without WebKit, or with a typo in the variable, reported success
 * having launched nothing.
 *
 * These tests pin the three ways that used to happen: an empty request, an
 * unknown name, and a requested engine that is not installed. Availability is
 * injected rather than read from the machine: Playwright caches
 * `executablePath()` per process, so the only honest way to describe a runner
 * without a browser is to say so directly.
 */
const allPresent: AvailabilityProbe = () => true
const onlyChromium: AvailabilityProbe = engine => engine === 'chromium'
const nonePresent: AvailabilityProbe = () => false

describe('browser selection', () => {
  it('defaults to all three engines when the variable is unset', () => {
    expect(
      selectBrowsers(undefined, { available: allPresent }).engines,
    ).toEqual(ALL_ENGINES)
  })

  it('falls back to the caller default when the variable is empty', () => {
    const options = {
      fallback: ['chromium'] as EngineName[],
      available: allPresent,
    }
    expect(selectBrowsers(undefined, options).engines).toEqual(['chromium'])
    expect(selectBrowsers('  ', options).engines).toEqual(['chromium'])
  })

  it('throws for an empty selection with no fallback', () => {
    const options = { fallback: [] as EngineName[], available: allPresent }
    expect(() => selectBrowsers('', options)).toThrow(
      /no browser engines requested/,
    )
    expect(() => selectBrowsers(',', options)).toThrow(
      /no browser engines requested/,
    )
  })

  it('throws for an unknown engine instead of dropping it', () => {
    // The old filter turned `webkitt` into `[]` and the gate then passed.
    expect(() => selectBrowsers('webkitt', { available: allPresent })).toThrow(
      /unknown browser engine\(s\): webkitt/,
    )
    expect(() =>
      selectBrowsers('chromium,chrom', { available: allPresent }),
    ).toThrow(/unknown browser engine\(s\): chrom/)
  })

  it('deduplicates and lowercases a request', () => {
    expect(
      selectBrowsers('Chromium, chromium ,FIREFOX', { available: allPresent })
        .engines,
    ).toEqual(['chromium', 'firefox'])
  })

  it('reports a requested engine that is not installed', () => {
    const selection = selectBrowsers('firefox', { available: onlyChromium })
    expect(selection.engines).toEqual(['firefox'])
    expect(selection.missing).toEqual(['firefox'])
  })

  it('refuses a requested engine that is not installed', () => {
    expect(() =>
      requireBrowsers('firefox', { available: onlyChromium }),
    ).toThrow(/browser\(s\) not installed: firefox/)
    // The message has to tell the operator how to fix it.
    expect(() =>
      requireBrowsers('firefox', { available: onlyChromium }),
    ).toThrow(/playwright install --with-deps firefox/)
  })

  it('refuses every engine when none is installed, rather than returning []', () => {
    // This is the exact shape of the old bug: no browser anywhere, gate green.
    expect(() =>
      requireBrowsers(undefined, { available: nonePresent }),
    ).toThrow(/browser\(s\) not installed: chromium, firefox, webkit/)
  })

  it('can skip a missing engine, but only when the caller says so', () => {
    // A probe use: Chromium is present and runs; the rest are reported. Contrast
    // with the default, which fails — a smaller matrix passing is not the
    // matrix passing.
    expect(
      requireBrowsers('chromium,firefox', {
        available: onlyChromium,
        onMissing: 'skip',
      }),
    ).toEqual(['chromium'])
    expect(() =>
      requireBrowsers('chromium,firefox', { available: onlyChromium }),
    ).toThrow(/browser\(s\) not installed: firefox/)
  })

  it('can name engines without asking about availability', () => {
    expect(
      requireBrowsers('chromium,firefox', {
        available: nonePresent,
        onMissing: 'include',
      }),
    ).toEqual(['chromium', 'firefox'])
  })

  it('honours PLAYWRIGHT_BROWSERS_PATH, including the 0 opt-out', () => {
    const saved = process.env.PLAYWRIGHT_BROWSERS_PATH
    try {
      process.env.PLAYWRIGHT_BROWSERS_PATH = '/tmp/somewhere'
      expect(browserCache()).toBe('/tmp/somewhere')
      // `0` is Playwright's "use the bundled path" value, not a directory.
      process.env.PLAYWRIGHT_BROWSERS_PATH = '0'
      expect(browserCache()).not.toBe('0')
      expect(path.isAbsolute(browserCache() ?? '')).toBe(true)
    } finally {
      if (saved === undefined) delete process.env.PLAYWRIGHT_BROWSERS_PATH
      else process.env.PLAYWRIGHT_BROWSERS_PATH = saved
    }
  })
})
