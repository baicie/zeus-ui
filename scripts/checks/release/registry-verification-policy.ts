/**
 * How long to keep asking the registry whether a release is visible.
 *
 * ## What was wrong
 *
 * The previous policy was one number: retry every 10s, at most 12 times, i.e.
 * a two-minute window. beta.35 published all 46 packages successfully and then
 * failed verification on `@zeus-web/ai-primitives`, which was still returning
 * 404 when the window closed. The registry had the package minutes later.
 *
 * Two separate defects hid behind that one timeout:
 *
 * 1. **The window was too short and flat.** npm's CDN propagates a new
 *    version unevenly; two minutes is enough for most packages and not for
 *    the tail. Waiting a fixed 10s twelve times does not give the tail any
 *    more room than the head.
 * 2. **Every failure was retried the same way.** `verifyRegistry` caught
 *    all* errors and retried, so a genuine contract mismatch — wrong
 *    integrity, wrong dist-tag, missing provenance — looked exactly like a
 *    package that had not propagated yet. It burned the whole window and then
 *    reported a timeout, which sends the reader looking for a network
 *    problem that does not exist.
 *
 * ## What this does instead
 *
 * Each attempt is classified. Only classes that can plausibly clear on their
 * own are retried:
 *
 * | Class                  | Retried | Why                                              |
 * | ---------------------- | ------- | ------------------------------------------------ |
 * | `PROPAGATION_PENDING`  | yes     | the one case the window exists for                |
 * | `REGISTRY_UNAVAILABLE` | yes     | 429/5xx/timeouts/socket errors are transient      |
 * | `CONTRACT_MISMATCH`    | no      | waiting cannot change a wrong digest or dist-tag  |
 * | `VERIFICATION_TIMEOUT` | —       | terminal; the window closed                       |
 *
 * Retries use exponential backoff with jitter so 46 packages do not all wake
 * at the same instant, and honour `Retry-After` when the registry sends one.
 *
 * The window is a **deadline shared by every package**, not 46 independent
 * waits: `deadline = firstAttemptAt + windowMs`. A package that is still
 * pending when the deadline passes is reported `VERIFICATION_TIMEOUT` with
 * whatever was last observed, so the report says which packages were late
 * rather than collapsing into one message.
 *
 * ## What it still cannot do
 *
 * Tell you a package will *never* appear. A version that never propagates and
 * a version that propagates after the deadline produce the same
 * `PROPAGATION_PENDING` observations until the deadline separates them. That
 * is why the deadline is reported explicitly in the evidence file.
 */
import { setTimeout as sleep } from 'node:timers/promises'

/** Where a package stands after verification. */
export type VerificationStatus =
  | 'VERIFIED'
  | 'PROPAGATION_PENDING'
  | 'REGISTRY_UNAVAILABLE'
  | 'CONTRACT_MISMATCH'
  | 'VERIFICATION_TIMEOUT'

/**
 * Why an attempt did not verify. `undefined` on a verified package.
 *
 * The split that matters is `PROPAGATION_PENDING` vs `CONTRACT_MISMATCH`:
 * the first is a reason to wait, the second is a reason to fail now.
 */
export type VerificationErrorKind =
  | 'VERSION_ABSENT'
  | 'NETWORK'
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'AUTH'
  | 'MALFORMED_RESPONSE'
  | 'INTEGRITY_MISMATCH'
  | 'DIST_TAG_MISMATCH'
  | 'DEPENDENCY_MISMATCH'
  | 'PROVENANCE_MISMATCH'
  | 'CONTRACT_MISMATCH'

/** The subset worth waiting on. Everything else fails closed immediately. */
export const RETRYABLE_ERROR_KINDS: readonly VerificationErrorKind[] = [
  'VERSION_ABSENT',
  'NETWORK',
  'TIMEOUT',
  'RATE_LIMITED',
  'SERVER_ERROR',
]

export interface VerificationAttemptResult {
  readonly ok: boolean
  readonly errorKind?: VerificationErrorKind
  readonly errorMessage?: string
  /** From `Retry-After`, in milliseconds, when the registry sent one. */
  readonly retryAfterMs?: number
  /** Whatever the registry said, even when the check failed. */
  readonly observedVersion?: string | null
  readonly observedDistTag?: string | null
  readonly integrity?: string | null
}

/** One row of the structural report. */
export interface PackageVerificationRecord {
  readonly package: string
  readonly expectedVersion: string
  readonly observedVersion: string | null
  readonly expectedDistTag: string
  readonly observedDistTag: string | null
  readonly registry: string
  readonly attempts: number
  readonly firstAttemptAt: string
  readonly verifiedAt: string
  readonly elapsedMs: number
  readonly integrity: string | null
  readonly status: VerificationStatus
  readonly errorKind?: VerificationErrorKind
  readonly errorMessage?: string
}

export interface VerificationReport {
  readonly schema: 'zeus-ui.registry-verification/v1'
  readonly version: string
  readonly tag: string
  readonly registry: string
  readonly startedAt: string
  readonly finishedAt: string
  readonly deadlineAt: string
  readonly windowMs: number
  readonly concurrency: number
  readonly summary: {
    readonly total: number
    readonly verified: number
    readonly propagationPending: number
    readonly registryUnavailable: number
    readonly contractMismatch: number
    readonly verificationTimeout: number
  }
  readonly packages: readonly PackageVerificationRecord[]
}

export interface VerificationPolicy {
  /** Total propagation window, shared by every package. Default 10 min. */
  readonly windowMs: number
  /** How many packages are in flight at once. */
  readonly concurrency: number
  /** Backoff base; attempt n waits `base * 2^(n-1)` plus jitter. */
  readonly backoffBaseMs: number
  /** Backoff ceiling, jitter aside. */
  readonly backoffMaxMs: number
  /** Per-request timeout passed to the fetch layer. */
  readonly requestTimeoutMs: number
  /** Randomisation applied to each backoff, as a fraction of the delay. */
  readonly jitterRatio: number
}

export const DEFAULT_VERIFICATION_POLICY: VerificationPolicy = {
  windowMs: 10 * 60 * 1000,
  concurrency: 8,
  backoffBaseMs: 2_000,
  backoffMaxMs: 30_000,
  requestTimeoutMs: 20_000,
  jitterRatio: 0.3,
}

/**
 * Reads policy overrides from the environment.
 *
 * The window is the one operators actually need to move — a release that
 * propagates unusually slowly should not require a code change — so it is
 * configurable. Concurrency and timeouts stay fixed unless explicitly raised;
 * lowering them only makes a stuck window worse.
 */
export function resolveVerificationPolicy(
  overrides: Partial<VerificationPolicy> = {},
  env: NodeJS.ProcessEnv = process.env,
): VerificationPolicy {
  const fromEnv = (name: string): number | undefined => {
    const raw = env[name]

    if (raw === undefined || raw === '') return undefined

    const parsed = Number(raw)

    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
  }

  const windowSeconds = fromEnv('ZEUS_REGISTRY_VERIFICATION_WINDOW_SECONDS')

  return {
    ...DEFAULT_VERIFICATION_POLICY,
    ...(windowSeconds === undefined ? {} : { windowMs: windowSeconds * 1000 }),
    ...overrides,
  }
}

/**
 * Exponential backoff with jitter.
 *
 * `attempt` is 1-based: attempt 1 failing waits `base`, attempt 2 waits
 * `2 * base`, and so on up to the ceiling. The jitter is what stops 46
 * packages from retrying in lockstep and hammering the registry at exactly
 * the same moment.
 */
export function backoffDelayMs(
  attempt: number,
  policy: VerificationPolicy,
  random: () => number = Math.random,
): number {
  const exponential = Math.min(
    policy.backoffMaxMs,
    policy.backoffBaseMs * 2 ** Math.max(0, attempt - 1),
  )
  const jitter = exponential * policy.jitterRatio

  // Spread across [delay - jitter, delay + jitter].
  return Math.max(0, Math.round(exponential - jitter + random() * jitter * 2))
}

/** Maps a thrown error from the fetch layer onto an error kind. */
export function classifyFetchError(error: unknown): VerificationErrorKind {
  const message = error instanceof Error ? error.message : String(error)
  const code = (error as { cause?: { code?: string } })?.cause?.code ?? ''

  if (
    /abort|timed? ?out|ETIMEDOUT|UND_ERR_CONNECT_TIMEOUT/i.test(
      `${message} ${code}`,
    )
  ) {
    return 'TIMEOUT'
  }

  if (
    /ECONNRESET|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|socket hang up/i.test(
      `${message} ${code}`,
    )
  ) {
    return 'NETWORK'
  }

  return 'NETWORK'
}

/** Maps an HTTP status onto an error kind. */
export function classifyHttpStatus(status: number): VerificationErrorKind {
  if (status === 404) return 'VERSION_ABSENT'
  if (status === 429) return 'RATE_LIMITED'
  if (status === 401 || status === 403) return 'AUTH'
  if (status >= 500) return 'SERVER_ERROR'

  return 'MALFORMED_RESPONSE'
}

/** Parses `Retry-After` as seconds or an HTTP date. */
export function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined

  const seconds = Number(value)

  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000

  const date = Date.parse(value)

  if (Number.isNaN(date)) return undefined

  return Math.max(0, date - Date.now())
}

function statusFor(
  kind: VerificationErrorKind | undefined,
  timedOut: boolean,
): VerificationStatus {
  if (kind === undefined) return 'VERIFIED'
  if (timedOut) return 'VERIFICATION_TIMEOUT'
  if (RETRYABLE_ERROR_KINDS.includes(kind)) {
    return kind === 'VERSION_ABSENT'
      ? 'PROPAGATION_PENDING'
      : 'REGISTRY_UNAVAILABLE'
  }

  return 'CONTRACT_MISMATCH'
}

export interface VerifyOptions {
  readonly packageNames: readonly string[]
  readonly version: string
  readonly tag: string
  readonly registry: string
  readonly policy: VerificationPolicy
  readonly checkOnce: (
    packageName: string,
  ) => Promise<VerificationAttemptResult>
  readonly now?: () => number
  readonly wait?: (ms: number) => Promise<void>
  readonly random?: () => number
  readonly log?: (message: string) => void
}

/**
 * Verifies every package under one shared deadline.
 *
 * Packages run `concurrency` at a time. A package leaves the loop the moment
 * it verifies or hits a non-retryable error; the rest keep going until the
 * deadline, so one late package does not take the whole window from the
 * others.
 */
export async function verifyPackages(
  options: VerifyOptions,
): Promise<VerificationReport> {
  const {
    packageNames,
    policy,
    checkOnce,
    now = Date.now,
    wait = ms => sleep(ms),
    random = Math.random,
    log = () => {},
  } = options

  const startedAt = now()
  const deadlineAt = startedAt + policy.windowMs

  interface State {
    attempts: number
    firstAttemptAt: number
    verifiedAt: number
    last: VerificationAttemptResult
    lastKind?: VerificationErrorKind
    timedOut: boolean
  }

  const states = new Map<string, State>()
  const queue = [...packageNames]

  const runOne = async (packageName: string): Promise<void> => {
    const state: State = {
      attempts: 0,
      firstAttemptAt: now(),
      verifiedAt: 0,
      last: { ok: false },
      timedOut: false,
    }
    states.set(packageName, state)

    for (;;) {
      const remaining = deadlineAt - now()

      if (remaining <= 0) {
        state.timedOut = true
        state.lastKind = state.lastKind ?? 'VERSION_ABSENT'

        return
      }

      state.attempts += 1

      let result: VerificationAttemptResult

      try {
        result = await checkOnce(packageName)
      } catch (error) {
        result = {
          ok: false,
          errorKind: classifyFetchError(error),
          errorMessage: error instanceof Error ? error.message : String(error),
        }
      }

      state.last = result

      if (result.ok) {
        state.verifiedAt = now()
        state.lastKind = undefined

        return
      }

      state.lastKind = result.errorKind ?? 'CONTRACT_MISMATCH'

      if (!RETRYABLE_ERROR_KINDS.includes(state.lastKind)) {
        state.verifiedAt = now()

        return
      }

      const delayMs =
        result.retryAfterMs ?? backoffDelayMs(state.attempts, policy, random)
      const budget = deadlineAt - now()

      if (budget <= 0) {
        state.timedOut = true
        state.verifiedAt = now()

        return
      }

      log(
        `${packageName}: attempt ${state.attempts} → ${state.lastKind}; waiting ${Math.min(delayMs, budget)}ms`,
      )

      await wait(Math.min(delayMs, budget))
    }
  }

  const worker = async (): Promise<void> => {
    for (;;) {
      const packageName = queue.shift()

      if (packageName === undefined) return

      await runOne(packageName)
    }
  }

  await Promise.all(
    Array.from(
      {
        length: Math.max(1, Math.min(policy.concurrency, packageNames.length)),
      },
      worker,
    ),
  )

  const finishedAt = now()

  const records: PackageVerificationRecord[] = packageNames.map(packageName => {
    const state = states.get(packageName)
    const kind = state?.lastKind
    const status =
      state === undefined
        ? 'VERIFICATION_TIMEOUT'
        : statusFor(kind, state.timedOut && kind !== undefined)
    const last = state?.last

    return {
      package: packageName,
      expectedVersion: options.version,
      observedVersion: last?.observedVersion ?? null,
      expectedDistTag: options.tag,
      observedDistTag: last?.observedDistTag ?? null,
      registry: options.registry,
      attempts: state?.attempts ?? 0,
      firstAttemptAt: new Date(
        state?.firstAttemptAt ?? startedAt,
      ).toISOString(),
      verifiedAt: new Date(state?.verifiedAt || finishedAt).toISOString(),
      elapsedMs:
        (state?.verifiedAt || finishedAt) -
        (state?.firstAttemptAt ?? startedAt),
      integrity: last?.integrity ?? null,
      status,
      ...(kind === undefined ? {} : { errorKind: kind }),
      ...(last?.errorMessage === undefined
        ? {}
        : { errorMessage: last.errorMessage }),
    }
  })

  const count = (status: VerificationStatus): number =>
    records.filter(record => record.status === status).length

  return {
    schema: 'zeus-ui.registry-verification/v1',
    version: options.version,
    tag: options.tag,
    registry: options.registry,
    startedAt: new Date(startedAt).toISOString(),
    finishedAt: new Date(finishedAt).toISOString(),
    deadlineAt: new Date(deadlineAt).toISOString(),
    windowMs: policy.windowMs,
    concurrency: policy.concurrency,
    summary: {
      total: records.length,
      verified: count('VERIFIED'),
      propagationPending: count('PROPAGATION_PENDING'),
      registryUnavailable: count('REGISTRY_UNAVAILABLE'),
      contractMismatch: count('CONTRACT_MISMATCH'),
      verificationTimeout: count('VERIFICATION_TIMEOUT'),
    },
    packages: records,
  }
}

/** True only when every package verified. Retries never downgrade to a pass. */
export function reportIsPassing(report: VerificationReport): boolean {
  return report.summary.verified === report.summary.total
}
