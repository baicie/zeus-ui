/**
 * Browser selection for the Workbench gates.
 *
 * Every gate used to filter the requested engine list down to the ones it knew,
 * and then trust the result. `ZEUS_AI_WORKBENCH_BROWSERS=webkit` on a machine
 * without WebKit produced `selected = []`, zero results, and
 * `[].every(r => r.passed) === true` — a green gate that ran nothing. The same
 * shape existed for a typo, a comma-only value, or an unset variable on a runner
 * without Playwright.
 *
 * This module makes a selection that cannot run a failure, in one place, so all
 * five gates fail the same way and for the same reason.
 *
 * Lookups are functions rather than module-level constants: availability is a
 * property of the machine *at the moment the gate runs*, and a constant would
 * freeze whatever the process saw at import time. It also makes the module
 * testable without mutating a shared value.
 */
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { chromium, firefox, webkit } from '@playwright/test'

export const ENGINES = { chromium, firefox, webkit } as const
export type EngineName = keyof typeof ENGINES

export const ALL_ENGINES: readonly EngineName[] = [
  'chromium',
  'firefox',
  'webkit',
]

/**
 * Where Playwright keeps its browsers. `PLAYWRIGHT_BROWSERS_PATH` wins when set
 * — CI uses it to put the browser cache on a mounted path — and the platform
 * default is the fallback, so a local run and a CI run resolve the same way.
 * Playwright treats `0` as "use the bundled path", which is not a directory.
 */
export function browserCache(): string | undefined {
  const configured = process.env.PLAYWRIGHT_BROWSERS_PATH
  if (configured && configured !== '0') return configured
  const home = process.env.HOME ?? process.env.USERPROFILE
  if (!home) return undefined
  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Caches', 'ms-playwright')
  }
  if (process.platform === 'win32') {
    return path.join(home, 'AppData', 'Local', 'ms-playwright')
  }
  return path.join(home, '.cache', 'ms-playwright')
}

function fallbackBinary(
  engine: EngineName,
  directory: string,
): string | undefined {
  if (engine === 'chromium') {
    if (process.platform === 'darwin') {
      return path.join(
        directory,
        'chrome-mac-arm64',
        'Google Chrome for Testing.app',
        'Contents',
        'MacOS',
        'Google Chrome for Testing',
      )
    }
    if (process.platform === 'win32') {
      return path.join(directory, 'chrome-win', 'chrome.exe')
    }
    return path.join(directory, 'chrome-linux', 'chrome')
  }
  if (engine === 'firefox') {
    if (process.platform === 'darwin') {
      return path.join(
        directory,
        'firefox',
        'Nightly.app',
        'Contents',
        'MacOS',
        'firefox',
      )
    }
    if (process.platform === 'win32') {
      return path.join(directory, 'firefox', 'firefox.exe')
    }
    return path.join(directory, 'firefox', 'firefox')
  }
  return path.join(directory, 'pw_run.sh')
}

/**
 * A browser binary that this machine can actually launch.
 *
 * Playwright's own `executablePath()` is authoritative. The cache scan exists
 * because the recorded revision can be absent while a neighbouring revision is
 * installed — a common state on a developer machine and on a cached CI runner.
 * It is a fallback for *finding* a browser, never a reason to skip one.
 */
export function executableFor(engine: EngineName): string | undefined {
  if (existsSync(ENGINES[engine].executablePath())) return undefined
  const cache = browserCache()
  if (!cache || !existsSync(cache)) return undefined
  const prefix = engine === 'chromium' ? 'chromium-' : `${engine}-`
  for (const entry of readdirSync(cache)
    .filter(name => name.startsWith(prefix) && !name.includes('headless'))
    .sort()
    .reverse()) {
    const candidate = fallbackBinary(engine, path.join(cache, entry))
    if (candidate && existsSync(candidate)) return candidate
  }
  return undefined
}

/**
 * True when this engine can be launched at all on this machine, right now.
 *
 * Playwright resolves `executablePath()` once per process and caches it, so the
 * answer is stable for the life of a gate. That is the correct behaviour for a
 * gate — the browser set does not change mid-run — and it is why the selection
 * functions take an availability predicate instead of reading the environment
 * themselves: a test can then describe a machine without pretending to be one.
 */
export function engineAvailable(engine: EngineName): boolean {
  if (existsSync(ENGINES[engine].executablePath())) return true
  return executableFor(engine) !== undefined
}

/** How a selection learns which engines this machine has. Injectable for tests. */
export type AvailabilityProbe = (engine: EngineName) => boolean

const defaultProbe: AvailabilityProbe = engineAvailable

export interface BrowserSelection {
  /** Engines to run, in request order, deduplicated. */
  readonly engines: readonly EngineName[]
  /** Engines that were requested and are not installed. Never silently dropped. */
  readonly missing: readonly EngineName[]
  /** The raw request, for the report. */
  readonly requested: string
}

/**
 * Parses `ZEUS_AI_WORKBENCH_BROWSERS` (or the caller's variable) strictly.
 *
 * Unknown names were previously filtered out; here they are an error, because a
 * typo silently reducing the matrix is the same failure as an empty list. The
 * caller decides whether a missing engine is fatal: `requireBrowsers` defaults
 * to yes, which is what a gate wants.
 */
export function selectBrowsers(
  raw: string | undefined,
  options: {
    readonly fallback?: readonly EngineName[]
    readonly available?: AvailabilityProbe
  } = {},
): BrowserSelection {
  const requested = raw?.trim()
    ? raw
    : (options.fallback ?? ALL_ENGINES).join(',')
  const names = requested
    .split(',')
    .map(name => name.trim().toLowerCase())
    .filter(Boolean)
  if (names.length === 0) {
    throw new Error(
      `no browser engines requested (got ${JSON.stringify(requested)}); an empty selection cannot pass a gate`,
    )
  }
  const unknown = names.filter(name => !(name in ENGINES))
  if (unknown.length > 0) {
    throw new Error(
      `unknown browser engine(s): ${unknown.join(', ')}; expected ${ALL_ENGINES.join(', ')}`,
    )
  }
  const engines = [...new Set(names)] as EngineName[]
  const available = options.available ?? defaultProbe
  const missing = engines.filter(engine => !available(engine))
  return { engines, missing, requested }
}

/**
 * The selection a gate should run, or a thrown error explaining why it cannot.
 *
 * This is the function every gate calls. It fails on: no engine requested, an
 * unknown engine name, and — by default — any requested engine that is not
 * installed. There is deliberately no code path that returns an empty list for
 * a gate.
 *
 * `onMissing` names the two legitimate non-fatal cases, and they are different
 * questions, so they are different values rather than one boolean:
 *
 * - `'skip'` — run the engines that are present and report the rest. A probe
 *   tool uses this; a gate must not, because a smaller matrix passing is not the
 *   matrix passing.
 * - `'include'` — return the request unchanged, availability unasked. For a
 *   caller that only needs to *name* the engines.
 */
export function requireBrowsers(
  raw: string | undefined,
  options: {
    readonly fallback?: readonly EngineName[]
    readonly available?: AvailabilityProbe
    readonly onMissing?: 'fail' | 'skip' | 'include'
  } = {},
): readonly EngineName[] {
  const selection = selectBrowsers(raw, options)
  const onMissing = options.onMissing ?? 'fail'
  if (selection.missing.length > 0 && onMissing === 'fail') {
    throw new Error(
      `browser(s) not installed: ${selection.missing.join(', ')} — run \`pnpm exec playwright install --with-deps ${selection.missing.join(' ')}\`. ` +
        'A gate that cannot launch a requested engine is a failure, not a skip.',
    )
  }
  if (onMissing === 'include') return selection.engines
  return selection.engines.filter(engine => !selection.missing.includes(engine))
}
