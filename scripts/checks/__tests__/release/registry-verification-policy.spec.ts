import { describe, expect, it } from 'vitest'

import {
  backoffDelayMs,
  classifyFetchError,
  classifyHttpStatus,
  DEFAULT_VERIFICATION_POLICY,
  parseRetryAfter,
  reportIsPassing,
  resolveVerificationPolicy,
  RETRYABLE_ERROR_KINDS,
  verifyPackages,
} from '../../release/registry-verification-policy'

const policy = {
  ...DEFAULT_VERIFICATION_POLICY,
  windowMs: 60_000,
  concurrency: 2,
  backoffBaseMs: 1_000,
  backoffMaxMs: 4_000,
  jitterRatio: 0,
}

describe('registry verification policy', () => {
  it('retries a missing version, then verifies when it appears', async () => {
    let calls = 0
    const report = await verifyPackages({
      packageNames: ['@zeus-web/a'],
      version: '1.0.0',
      tag: 'beta',
      registry: 'https://registry.npmjs.org/',
      policy,
      wait: async () => {},
      checkOnce: async () => {
        calls += 1
        return calls < 3
          ? { ok: false, errorKind: 'VERSION_ABSENT' }
          : { ok: true, observedVersion: '1.0.0' }
      },
    })

    expect(report.packages[0]!.status).toBe('VERIFIED')
    expect(report.packages[0]!.attempts).toBe(3)
    expect(reportIsPassing(report)).toBe(true)
  })

  it('fails a contract mismatch immediately instead of burning the window', async () => {
    /*
     * The defect beta.35 hit: a non-retryable problem was retried for the
     * whole window and then reported as a timeout, pointing the reader at the
     * network. One attempt is the assertion that matters.
     */
    let calls = 0
    const report = await verifyPackages({
      packageNames: ['@zeus-web/b'],
      version: '1.0.0',
      tag: 'beta',
      registry: 'https://registry.npmjs.org/',
      policy,
      wait: async () => {
        throw new Error('must not wait on a contract mismatch')
      },
      checkOnce: async () => {
        calls += 1
        return {
          ok: false,
          errorKind: 'INTEGRITY_MISMATCH',
          errorMessage: 'sha512 differs',
        }
      },
    })

    expect(calls).toBe(1)
    expect(report.packages[0]!.status).toBe('CONTRACT_MISMATCH')
    expect(report.packages[0]!.errorKind).toBe('INTEGRITY_MISMATCH')
    expect(reportIsPassing(report)).toBe(false)
  })

  it('reports a timeout when the shared deadline passes, not a contract error', async () => {
    let clock = 0
    const report = await verifyPackages({
      packageNames: ['@zeus-web/c'],
      version: '1.0.0',
      tag: 'beta',
      registry: 'https://registry.npmjs.org/',
      policy: { ...policy, windowMs: 5_000 },
      now: () => clock,
      wait: async ms => {
        clock += ms
      },
      checkOnce: async () => ({ ok: false, errorKind: 'VERSION_ABSENT' }),
    })

    expect(report.packages[0]!.status).toBe('VERIFICATION_TIMEOUT')
    expect(report.summary.verificationTimeout).toBe(1)
    expect(reportIsPassing(report)).toBe(false)
  })

  it('shares one deadline across every package', async () => {
    /*
     * 46 independent windows would be 46 × 10 minutes. The report carries a
     * single deadlineAt, and every package's elapsed time must be bounded by
     * it rather than by its own budget.
     */
    let clock = 0
    const names = Array.from({ length: 6 }, (_, index) => `@zeus-web/p${index}`)

    const report = await verifyPackages({
      packageNames: names,
      version: '1.0.0',
      tag: 'beta',
      registry: 'https://registry.npmjs.org/',
      policy: {
        ...policy,
        windowMs: 9_000,
        concurrency: 2,
        backoffBaseMs: 2_000,
      },
      now: () => clock,
      wait: async ms => {
        clock += ms
      },
      checkOnce: async () => ({ ok: false, errorKind: 'VERSION_ABSENT' }),
    })

    const deadline = Date.parse(report.deadlineAt)
    const started = Date.parse(report.startedAt)

    expect(deadline - started).toBe(9_000)
    for (const record of report.packages) {
      expect(Date.parse(record.verifiedAt)).toBeLessThanOrEqual(deadline)
    }
  })

  it('honours Retry-After instead of the computed backoff', async () => {
    const waits: number[] = []

    await verifyPackages({
      packageNames: ['@zeus-web/d'],
      version: '1.0.0',
      tag: 'beta',
      registry: 'https://registry.npmjs.org/',
      policy,
      wait: async ms => {
        waits.push(ms)
      },
      checkOnce: async () =>
        waits.length === 0
          ? { ok: false, errorKind: 'RATE_LIMITED', retryAfterMs: 7_000 }
          : { ok: true },
    })

    expect(waits[0]).toBe(7_000)
  })

  it('never downgrades a retry exhaustion to a pass', async () => {
    const report = await verifyPackages({
      packageNames: ['@zeus-web/e'],
      version: '1.0.0',
      tag: 'beta',
      registry: 'https://registry.npmjs.org/',
      policy: { ...policy, windowMs: 1_000, backoffBaseMs: 500 },
      wait: async ms => {
        await new Promise(resolve => setTimeout(resolve, 0))
        void ms
      },
      now: (() => {
        let value = 0
        return () => {
          value += 400
          return value
        }
      })(),
      checkOnce: async () => ({ ok: false, errorKind: 'VERSION_ABSENT' }),
    })

    expect(reportIsPassing(report)).toBe(false)
    expect(report.packages[0]!.status).not.toBe('VERIFIED')
  })

  it('runs packages concurrently rather than serially', async () => {
    let inFlight = 0
    let peak = 0

    await verifyPackages({
      packageNames: Array.from({ length: 8 }, (_, index) => `p${index}`),
      version: '1.0.0',
      tag: 'beta',
      registry: 'https://registry.npmjs.org/',
      policy: { ...policy, concurrency: 4 },
      checkOnce: async () => {
        inFlight += 1
        peak = Math.max(peak, inFlight)
        await new Promise(resolve => setTimeout(resolve, 5))
        inFlight -= 1

        return { ok: true }
      },
    })

    expect(peak).toBeGreaterThan(1)
    expect(peak).toBeLessThanOrEqual(4)
  })
})

describe('error classification', () => {
  it('separates propagation from contract and infrastructure', () => {
    expect(classifyHttpStatus(404)).toBe('VERSION_ABSENT')
    expect(classifyHttpStatus(429)).toBe('RATE_LIMITED')
    expect(classifyHttpStatus(503)).toBe('SERVER_ERROR')
    expect(classifyHttpStatus(401)).toBe('AUTH')
    // A 200 that does not parse is not a propagation problem.
    expect(classifyHttpStatus(200)).toBe('MALFORMED_RESPONSE')
  })

  it('retries only the classes that can clear on their own', () => {
    expect(RETRYABLE_ERROR_KINDS).toContain('VERSION_ABSENT')
    expect(RETRYABLE_ERROR_KINDS).toContain('RATE_LIMITED')
    expect(RETRYABLE_ERROR_KINDS).toContain('SERVER_ERROR')
    expect(RETRYABLE_ERROR_KINDS).not.toContain('INTEGRITY_MISMATCH')
    expect(RETRYABLE_ERROR_KINDS).not.toContain('DIST_TAG_MISMATCH')
    expect(RETRYABLE_ERROR_KINDS).not.toContain('PROVENANCE_MISMATCH')
    expect(RETRYABLE_ERROR_KINDS).not.toContain('AUTH')
  })

  it('classifies socket errors as retryable network failures', () => {
    expect(classifyFetchError(new Error('socket hang up'))).toBe('NETWORK')
    expect(
      classifyFetchError(
        Object.assign(new Error('fetch failed'), {
          cause: { code: 'ECONNRESET' },
        }),
      ),
    ).toBe('NETWORK')
    expect(
      classifyFetchError(
        Object.assign(new Error('timed out'), {
          cause: { code: 'UND_ERR_CONNECT_TIMEOUT' },
        }),
      ),
    ).toBe('TIMEOUT')
  })
})

describe('backoff', () => {
  it('doubles per attempt and stops at the ceiling', () => {
    expect(backoffDelayMs(1, policy, () => 0.5)).toBe(1_000)
    expect(backoffDelayMs(2, policy, () => 0.5)).toBe(2_000)
    expect(backoffDelayMs(3, policy, () => 0.5)).toBe(4_000)
    expect(backoffDelayMs(9, policy, () => 0.5)).toBe(4_000)
  })

  it('spreads retries with jitter so packages do not wake together', () => {
    const low = backoffDelayMs(3, { ...policy, jitterRatio: 0.5 }, () => 0)
    const high = backoffDelayMs(3, { ...policy, jitterRatio: 0.5 }, () => 1)

    expect(low).toBe(2_000)
    expect(high).toBe(6_000)
    expect(low).not.toBe(high)
  })

  it('parses Retry-After as seconds or an HTTP date', () => {
    expect(parseRetryAfter('120')).toBe(120_000)
    expect(parseRetryAfter('0')).toBe(0)
    expect(parseRetryAfter(null)).toBeUndefined()
    expect(parseRetryAfter('not-a-date')).toBeUndefined()
  })
})

describe('policy configuration', () => {
  it('defaults to a ten-minute window', () => {
    expect(DEFAULT_VERIFICATION_POLICY.windowMs).toBe(600_000)
  })

  it('lets the window be raised from the environment', () => {
    const resolved = resolveVerificationPolicy(
      {},
      {
        ZEUS_REGISTRY_VERIFICATION_WINDOW_SECONDS: '900',
      },
    )

    expect(resolved.windowMs).toBe(900_000)
  })

  it('ignores an unusable override instead of shortening the window', () => {
    for (const raw of ['0', '-5', 'abc', '']) {
      const resolved = resolveVerificationPolicy(
        {},
        {
          ZEUS_REGISTRY_VERIFICATION_WINDOW_SECONDS: raw,
        },
      )

      expect(resolved.windowMs).toBe(DEFAULT_VERIFICATION_POLICY.windowMs)
    }
  })
})
