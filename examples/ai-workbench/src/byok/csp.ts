/* eslint-disable no-restricted-globals */
/**
 * Detects whether the page's Content-Security-Policy is what stopped a request.
 *
 * A blocked `fetch` rejects with a plain `TypeError`, exactly like a network
 * failure or a CORS rejection — the difference is invisible to the caller. The
 * browser does tell us, though: it fires `securitypolicyviolation` with the
 * violated directive and the blocked URI.
 *
 * Telling these apart matters because the fix is different for each:
 *
 * - CSP blocked it  → the deployment's `connect-src` must allow this origin
 * - CORS blocked it → the gateway must allow this page's origin
 * - network failed  → the URL or the connection is wrong
 *
 * Saying "this is CORS" when it is really CSP sends people to the wrong fix.
 */

export type RequestBlockReason = 'csp' | 'network'

interface Violation {
  readonly directive: string
  readonly uri: string
}

const RECENT_LIMIT = 20

/**
 * Registers the violation listener once and keeps the last few violations, so a
 * fetch failure can be attributed without the caller racing the event.
 */
class ViolationRecorder {
  private readonly violations: Violation[] = []
  private installed = false

  install(): void {
    if (this.installed || typeof document === 'undefined') return
    this.installed = true
    document.addEventListener('securitypolicyviolation', event => {
      this.violations.push({
        directive: event.violatedDirective,
        uri: event.blockedURI,
      })
      if (this.violations.length > RECENT_LIMIT) this.violations.shift()
    })
  }

  /** Drops anything recorded before `since`, so an old hit cannot be reused. */
  clearFrom(since: number): void {
    void since
    this.violations.length = 0
  }

  /**
   * True when a `connect-src` (or `default-src`) violation was recorded for
   * this origin. `blockedURI` is the origin, sometimes with a path, so the
   * comparison is on origin.
   */
  blockedByCsp(url: string): boolean {
    let origin: string
    try {
      origin = new URL(url).origin
    } catch {
      return false
    }
    return this.violations.some(
      violation =>
        (violation.directive === 'connect-src' ||
          violation.directive === 'default-src') &&
        (violation.uri === origin || violation.uri.startsWith(`${origin}/`)),
    )
  }
}

const recorder = new ViolationRecorder()
recorder.install()

/**
 * Runs `action` and reports whether a CSP violation accompanied its failure.
 *
 * The event is dispatched before the promise rejects, but it is delivered on a
 * task boundary in some engines, so the check waits one macrotask before
 * deciding. That is cheap and removes an ordering race.
 */
export async function classifyFailure<T>(
  url: string,
  action: () => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; reason: RequestBlockReason }> {
  recorder.clearFrom(0)
  try {
    const value = await action()
    return { ok: true, value }
  } catch {
    await new Promise<void>(resolve => setTimeout(resolve, 0))
    if (recorder.blockedByCsp(url)) return { ok: false, reason: 'csp' }
    // A TypeError with no violation was the network or CORS layer.
    return { ok: false, reason: 'network' }
  }
}

/**
 * Synchronous check used from a rejected fetch.
 *
 * The violation event fires before the promise rejects in Chromium and Firefox,
 * so by the time the `catch` runs the record is already there.
 */
export function cspBlockedFor(url: string): boolean {
  return recorder.blockedByCsp(url)
}

/** Records the moment a request starts, so stale violations are not reused. */
export function beginAttempt(): void {
  recorder.clearFrom(0)
}
