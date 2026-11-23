/**
 * Release Protocol v2 — how a UI release pairs with a Core release.
 *
 * ## What v1 got wrong
 *
 * v1 treated the two repositories as one version line:
 *
 *     const coreVersion = input.coreVersion ?? input.uiVersion
 *     if (coreVersion !== input.uiVersion) errors.push('...one version line')
 *
 * That is not how they release. Core is at `0.2.0-rc.5`; UI is at
 * `0.1.0-beta.35`. The check rejected every real release, and a test named
 * "fails when the Core version differs from the UI version" had frozen the
 * mistake as expected behaviour.
 *
 * ## What replaces it
 *
 * The versions are independent; the *contract* is what pairs. A UI release
 * names the Core version it was built and verified against, and that binding
 * is what the release must prove — not that two strings are equal.
 *
 * Three channels, three rules:
 *
 * | channel  | Core tag required | pairing record required | why |
 * | -------- | ----------------- | ----------------------- | --- |
 * | `beta`   | yes (online)      | no                      | the UI pins published Core packages and verifies the immutable Core tag; no cross-repo pairing record |
 * | `rc`     | yes               | yes                     | release candidate: a named, immutable Core commit |
 * | `latest` | yes               | yes                     | stable: same as rc, and the record may not be a bootstrap |
 *
 * `beta` is not "unchecked". It still requires every `@zeus-js/*` pin to name
 * one Core version that actually exists on the registry. At publish time the
 * Core tag must resolve to a commit; beta does not require a separate UI/Core
 * attestation record.
 */

export type ReleaseChannelName = 'beta' | 'rc' | 'latest'

/**
 * Which identity each side uses. Kept as named fields rather than prose so a
 * reader cannot conflate them, which is what v1 did when it wrote the UI
 * version into the Core tag lookup.
 */
export interface ReleaseIdentity {
  /** The version the UI publishes, e.g. `0.1.0-beta.35`. */
  readonly uiVersion: string
  /** The Core version the UI was built against, e.g. `0.2.0-rc.5`. */
  readonly coreVersion: string
  /** The UI commit being released (40-char SHA). */
  readonly uiCommit: string | null
  /** The Core commit the UI was verified against (40-char SHA). */
  readonly coreCommit: string | null
}

export interface ChannelRule {
  readonly channel: ReleaseChannelName
  /**
   * Whether the release must name an immutable Core commit and a pairing
   * record that pins it.
   */
  readonly requiresPairing: boolean
  /**
   * Whether the pairing record may be a bootstrap record (no UI commit),
   * which is only legal for the first publication of a version line.
   */
  readonly allowsBootstrap: boolean
  /** One line an operator can read in a failure message. */
  readonly rationale: string
}

const RULES: Readonly<Record<ReleaseChannelName, ChannelRule>> = {
  beta: {
    channel: 'beta',
    requiresPairing: false,
    allowsBootstrap: false,
    rationale:
      'beta is the pre-contract channel: exact Core pins and its immutable Core tag are required, but no cross-repository pairing record',
  },
  rc: {
    channel: 'rc',
    requiresPairing: true,
    allowsBootstrap: true,
    rationale:
      "an rc names the immutable Core commit it was verified against; bootstrap is allowed for a version line's first publication",
  },
  latest: {
    channel: 'latest',
    requiresPairing: true,
    allowsBootstrap: false,
    rationale:
      'a stable release pairs with a verified Core commit, and a bootstrap record cannot back a stable claim',
  },
}

export function channelRule(channel: ReleaseChannelName): ChannelRule {
  return RULES[channel]
}

/**
 * The Core version a channel's pairing record must name.
 *
 * The UI release states which Core it was verified against; this is that
 * value, checked for shape. It is deliberately *not* derived from
 * `uiVersion` — deriving it is what made v1 look up `v0.1.0-beta.35` in the
 * Core repository.
 */
export function coreTagFor(coreVersion: string): string {
  return `v${coreVersion}`
}

export const EXACT_SEMVER = /^\d+\.\d+\.\d+(?:-[0-9a-z]+(?:[.-][0-9a-z]+)*)?$/i
export const FULL_SHA = /^[0-9a-f]{40}$/

export interface PairingPlan {
  readonly ok: boolean
  readonly channel?: ReleaseChannelName
  readonly rule?: ChannelRule
  /** The Core tag this release must resolve, e.g. `v0.2.0-rc.5`. */
  readonly coreTag?: string
  readonly errors: readonly string[]
}

export interface PlanPairingOptions {
  /**
   * Whether the plan is the online half.
   *
   * A static run answers from the tree alone: it knows which Core version the
   * UI names, but the Core commit only exists once `v<coreVersion>` is
   * resolved on GitHub. Requiring a commit there would fail every pull
   * request — the deadlock the static/online split exists to avoid.
   *
   * Defaults to `false`, so a caller that forgets to say gets the permissive
   * half rather than a refusal it cannot satisfy.
   */
  readonly online?: boolean
}

/**
 * Decides what a release must prove, before any network call.
 *
 * Everything here is answerable from the release's own inputs, so a missing
 * Core commit or a malformed version fails in a pull request rather than
 * after a tag exists.
 */
export function planPairing(
  identity: ReleaseIdentity,
  options: PlanPairingOptions = {},
): PairingPlan {
  const errors: string[] = []

  if (!EXACT_SEMVER.test(identity.uiVersion)) {
    errors.push(`UI version ${identity.uiVersion} is not an exact version`)
  }

  /*
   * `coreVersion` is required, never defaulted from `uiVersion`. v1 wrote
   * `input.coreVersion ?? input.uiVersion`, so a caller that forgot to pass it
   * silently asserted the two lines were the same — and then the equality check
   * below could never fire for anyone who did pass a different one.
   *
   * A UI release names the Core release it was verified against. Equal strings
   * are allowed: the two lines may coincide. What is not allowed is deriving
   * one from the other.
   */
  if (!identity.coreVersion) {
    errors.push(
      'A UI release must name the Core version it was verified against; coreVersion is required and is not derived from the UI version',
    )
    return { ok: false, errors }
  }

  if (!EXACT_SEMVER.test(identity.coreVersion)) {
    errors.push(
      `Core version ${identity.coreVersion} is not an exact version; a UI release names the Core release it was verified against`,
    )
    return { ok: false, errors }
  }

  const channel = channelOf(identity.uiVersion)

  if (channel === undefined) {
    errors.push(
      `Cannot derive a release channel from UI version ${identity.uiVersion}`,
    )
    return { ok: false, errors }
  }

  const rule = RULES[channel]

  if (!rule.requiresPairing) {
    /*
     * Static beta checks validate exact Core pins; the online publish path
     * also requires the immutable Core tag's commit, even though beta has no
     * cross-repository pair attestation record.
     */
    if (options.online === true && !FULL_SHA.test(identity.coreCommit ?? '')) {
      errors.push(
        'beta online release requires a verified 40-character Core tag commit',
      )
    }
    return {
      ok: errors.length === 0,
      channel,
      rule,
      coreTag: coreTagFor(identity.coreVersion),
      errors,
    }
  }

  /*
   * The commit half is the online half. A static plan states the channel and
   * the tag; whether that tag resolves to a commit is answered later, against
   * GitHub.
   */
  if (options.online !== true) {
    return {
      ok: errors.length === 0,
      channel,
      rule,
      coreTag: coreTagFor(identity.coreVersion),
      errors,
    }
  }

  if (identity.coreCommit === null) {
    errors.push(
      `${channel} requires the Core commit it was verified against; pass --core-commit or let the pairing check resolve ${coreTagFor(identity.coreVersion)}`,
    )
  } else if (!FULL_SHA.test(identity.coreCommit)) {
    errors.push(
      `Core commit ${identity.coreCommit} is not a full 40-character SHA`,
    )
  }

  if (identity.uiCommit === null) {
    errors.push(`${channel} requires the UI release commit`)
  } else if (!FULL_SHA.test(identity.uiCommit)) {
    errors.push(`UI commit ${identity.uiCommit} is not a full 40-character SHA`)
  }

  return {
    ok: errors.length === 0,
    channel,
    rule,
    coreTag: coreTagFor(identity.coreVersion),
    errors,
  }
}

function channelOf(version: string): ReleaseChannelName | undefined {
  const match = /^\d+\.\d+\.\d+(?:-([0-9a-z]+))?/i.exec(version)

  if (!match) {
    return undefined
  }

  if (match[1] === undefined) {
    return 'latest'
  }

  const identifier = match[1].toLowerCase()

  if (identifier === 'beta' || identifier === 'rc' || identifier === 'latest') {
    return identifier
  }

  return undefined
}
