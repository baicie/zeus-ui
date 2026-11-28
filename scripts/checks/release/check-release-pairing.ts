import type { ReleaseChannel } from '../../release/channel'
import type { AcceptanceCoverage } from '../../release/evidence-bundle'
import type {
  PairingAmendment,
  TagLookup,
} from '../../release/pairing-amendment'
/**
 * Immutable Core/UI pairing for a Zeus UI release — Core-anchored.
 *
 * ## What was wrong
 *
 * The previous protocol kept a record in **both** repositories, each naming the
 * other's commit:
 *
 *   Core   `release-pairing/v<version>.json` → `uiCommit`
 *   UI     `release-pairing/v<version>.json` → `coreCommit`, `uiCommit`
 *
 * Two problems, one fatal:
 *
 * 1. The UI record named its **own** commit — the commit that contains the
 *    file. Writing a commit's SHA into a file changes that commit's SHA, so
 *    the record could only ever be correct for a commit that is not the one
 *    carrying it. The README told maintainers to amend repeatedly until the
 *    two matched, which never converges: it is a fixed-point problem with no
 *    fixed point.
 * 2. Across the two repositories the references form a cycle: Core names UI,
 *    UI names Core. Neither can be finalised first without the other being
 *    finalised first.
 *
 * ## What replaces it
 *
 * Core is the anchor, and the dependency is one-way.
 *
 * 1. The UI release candidate is committed and pushed. Its SHA is whatever git
 *    computed; nothing needs to know it in advance.
 * 2. **Core** commits `release-pairing/v<version>.json` naming that UI SHA, and
 *    Core is tagged. This is the authoritative record — it is in the tagged
 *    tree, so it cannot change without changing what the tag points at.
 * 3. The UI release reads Core's tag, resolves it to a commit, reads the
 *    record **from that commit**, and requires its own release SHA to equal
 *    the `uiCommit` the record names.
 *
 * Nothing in the UI repository names the UI commit. Nothing in the UI
 * repository names a Core commit either — Core is resolved from the tag. The
 * UI tree does not need to know any SHA, which is what makes the protocol
 * constructible.
 *
 * ## Static and online
 *
 * `evaluateStatic` answers everything that can be answered from the tree alone:
 * version line, pins, channel. It runs in a UI pull request and never touches
 * the network, so a PR is not blocked by a Core tag that does not exist yet.
 *
 * `evaluatePairing` adds the online half: resolve the Core tag, read the record
 * from that commit, compare. It runs at release time, where the tag exists.
 *
 * A failed lookup is a failure, never a skip. "I could not reach GitHub" and
 * "the record matches" are different answers.
 */
import { Buffer } from 'node:buffer'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'

import path from 'node:path'

import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import pc from 'picocolors'
import { resolveChannel } from '../../release/channel'
import {
  amendmentFile,
  amendmentTag,
  resolveRemoteTag,
  validatePairingAmendment,
  verifyAmendmentEvidence,
} from '../../release/pairing-amendment'
import { planPairing } from '../../release/release-protocol'
import { resolveWorkspaceZeusVersion } from '../../release/zeus-alignment-contract'
import { listZeusDependencyManifests } from '../../release/zeus-dependency-manifests'

/**
 * The shape of **Core's** record, which is the authority.
 *
 * Deliberately not the same schema as anything in the UI repository: the UI no
 * longer keeps a record, and a shared schema would invite one back.
 */
export const CORE_PAIRING_SCHEMA = 'zeus.release-pairing/v1'
/**
 * Where a Core tag keeps its pairing record, in the order to try.
 *
 * Core moved the directory to `meta/release/pairing` and the tags created
 * before that move still carry `release-pairing`, and a tag cannot be edited.
 * Core's own reader (`TAGGED_RECORD_PATHS` in `pair-attestation.ts`) lists
 * both for this reason. This checker only knew the old path, so every record
 * written after the move read as missing.
 */
export const CORE_PAIRING_DIRECTORIES = [
  'meta/release/pairing',
  'release-pairing',
] as const

/** Kept for the callers that name a single directory. */
export const CORE_PAIRING_DIRECTORY = CORE_PAIRING_DIRECTORIES[0]
/**
 * The schema of the attestation that supplies a pair for a bootstrap release.
 *
 * Defined in Core at `scripts/release/pair-attestation.ts`; duplicated here
 * because the UI must refuse a payload it does not recognise, and reading the
 * constant from Core would make a Core-side typo silently accept anything.
 */
export const PAIR_ATTESTATION_SCHEMA = 'zeus.pair-attestation/v1'

const FULL_SHA = /^[0-9a-f]{40}$/i
const EXACT_VERSION = /^\d+\.\d+\.\d+(?:-[0-9a-z]+(?:[.-][0-9a-z]+)*)?$/i

/**
 * Core packages versioned outside the fixed release group, mirroring
 * `INDEPENDENT_PACKAGE_VERSIONS` in the UI baseline check. Every other
 * `@zeus-js/*` pin must equal the paired Core version exactly.
 */
export const INDEPENDENT_CORE_PINS: Readonly<Record<string, string>> = {
  '@zeus-js/vite-plugin': '0.0.5',
}

/** Core's record, as read from the commit a Core tag resolves to. */
export interface CorePairingRecord {
  readonly schema: string
  readonly coreVersion: string
  /**
   * The paired UI commit, or `null` when the release published unpaired.
   *
   * `null` is not a missing value: it states that the tag was created before
   * any UI commit could exist, which is what a new version line's first RC
   * does. Such a record is only complete together with a pair attestation.
   */
  readonly uiCommit: string | null
  readonly uiVersion: string
  readonly verifiedAt: string
  readonly firstPublish?: readonly string[]
  /** The record declared it published unpaired. */
  readonly bootstrap?: boolean
}

export interface CorePin {
  readonly file: string
  readonly name: string
  readonly version: string
}

/**
 * What the UI can check without the network.
 *
 * `uiRoot` is the checkout under test; `uiVersion` comes from the manifest or
 * the dispatch input, never from a record.
 */
export interface StaticPairingInput {
  readonly uiRoot: string
  readonly uiVersion: string
  readonly coreVersion?: string
  readonly requirePairing?: boolean
  readonly listCorePins?: (uiRoot: string) => CorePin[]
}

/** Adds the online half: Core's tag, Core's record, the comparison. */
export interface OnlinePairingInput extends StaticPairingInput {
  /** The UI commit being released. Taken from the workflow's checkout. */
  readonly uiCommit: string
  /** Resolves `v<coreVersion>` on Core to a commit, or explains why not. */
  readonly resolveCoreTag?: (tag: string) => string | undefined
  /**
   * Resolves `pair/v<coreVersion>` on Core to a commit, or `undefined`.
   *
   * Separate from `resolveCoreTag` because the two are different tags in
   * different namespaces, and a bootstrap release needs both: the release tag
   * to prove what was published, the pair tag to prove who it was paired with.
   */
  readonly resolvePairTag?: (tag: string) => string | undefined
  /**
   * The three-state form of the same lookup.
   *
   * `resolvePairTag` cannot express "the API did not answer", and for an
   * amendment that distinction decides whether the release may fall through to
   * the tagged record. Tools pass this one; tests may keep the simple hook.
   */
  readonly resolvePairTagLookup?: (tag: string) => TagLookup
  /** Reads a file from a Core commit. */
  readonly readCoreFile?: (commit: string, file: string) => string | undefined
  /** The UI repository an amendment's replacement commit must exist on. */
  readonly uiRepository?: string
  /**
   * Reads a UI commit's tree and lockfile digest.
   *
   * Injected so the amendment checks can be exercised without a network, and
   * so a caller that already has the commit can answer from what it has.
   */
  readonly verifyUiCandidate?: VerifyUiCandidate
  /**
   * The acceptance coverage contract this release must prove.
   *
   * Supplied by the caller that knows the candidate matrix and the package
   * inventory. Without it the bundle is judged on internal consistency alone,
   * which cannot tell "6 of 6" from "1 of 1".
   */
  readonly coverage?: AcceptanceCoverage
  /** Where the Core artifacts came from; recorded, never inferred. */
  readonly coreSource?: 'registry' | 'workspace' | 'candidate' | 'unknown'
}

/** What an amendment's replacement UI commit must prove about itself. */
export interface UiCandidateIdentity {
  readonly tree: string
  /**
   * The sha256 of the commit's `pnpm-lock.yaml`.
   *
   * Required, not optional. It used to be `string | undefined`, and the
   * comparison below skipped when either side was missing — so a candidate
   * whose lockfile could not be fetched, and an amendment that omitted the
   * field, both passed on the tree alone. A UI tree whose lockfile resolves a
   * different Core is a different release candidate; the digest is what says
   * which one this is. A lookup that cannot produce it is a failure, never a
   * skip.
   */
  readonly lockfileSha256: string
}

/**
 * The outcome of reading a UI commit's identity.
 *
 * `MISSING` is the repository saying the commit is not there — a real finding.
 * `ERROR` is the API not answering, which blocks rather than degrades, and
 * carries the reason so a refusal names the cause instead of "(no message)".
 */
export type UiCandidateLookup =
  | ({ readonly state: 'FOUND' } & UiCandidateIdentity)
  | { readonly state: 'MISSING'; readonly message: string }
  | { readonly state: 'ERROR'; readonly message: string }

export type VerifyUiCandidate = (
  repository: string,
  commit: string,
) => UiCandidateLookup

/**
 * The amendable identity of a release, decided in one place.
 *
 * The order is authoritative, not opportunistic: an amendment that exists and
 * is valid *replaces* the tagged candidate, so the tagged candidate must then
 * be refused. v1 only consulted an amendment when the two commits already
 * differed, which left the original candidate with a live direct-verification
 * path no matter what the amendment said — two valid pairings for one release.
 */
export interface AmendmentVerdict {
  readonly state:
    | 'ABSENT'
    | 'PRESENT_VALID'
    | 'PRESENT_INVALID'
    | 'LOOKUP_FAILED'
  readonly errors: readonly string[]
  readonly amendment?: PairingAmendment
  readonly tag?: string
  readonly commit?: string
}

export interface PairingResult {
  readonly ok: boolean
  readonly channel?: ReleaseChannel
  readonly record?: CorePairingRecord
  /** Present when the pair came from an amendment rather than the tagged record. */
  readonly amended?: {
    readonly tag: string
    readonly commit: string
    readonly replacement?: string
  }
  /**
   * The Core tag this release must resolve, `v<coreVersion>`.
   *
   * Carried on the result because the report needs it: v1 built the report
   * from the version alone, so every consumer re-derived the tag and one of
   * them derived it from the *UI* version.
   */
  readonly coreTag?: string
  /**
   * The Core commit the pair was verified against.
   *
   * Only an online run can know this. It is on the result rather than passed
   * separately to the report builder because v1 lost it in exactly that gap:
   * the runner resolved the tag, the report was built without it, and the
   * workflow then refused a report that "carries no coreCommit".
   */
  readonly coreCommit?: string
  readonly errors: readonly string[]
}

/**
 * Everything answerable from the UI tree alone.
 *
 * No network. A pull request runs this; a Core tag may not exist yet, and
 * requiring one here would make every UI PR fail until after the Core release
 * — the deadlock this split exists to avoid.
 */
export function evaluateStatic(input: StaticPairingInput): PairingResult {
  const errors: string[] = []
  const channelResult = resolveChannel(input.uiVersion)
  if (channelResult.errors.length > 0) {
    return { ok: false, errors: [...channelResult.errors] }
  }
  const channel = channelResult.channel!

  /*
   * The two repositories release on separate version lines, so the pairing
   * contract is "the UI names the Core it was verified against", not "the two
   * strings are equal". `planPairing` owns that rule; see
   * `scripts/release/release-protocol.ts` for why v1's equality requirement
   * rejected every real release.
   *
   * `coreVersion` is required here. It used to default to `uiVersion`, which
   * made a caller that forgot it silently assert the lines were the same.
   */
  const plan = planPairing({
    uiVersion: input.uiVersion,
    coreVersion: input.coreVersion ?? '',
    uiCommit: null,
    coreCommit: null,
  })
  errors.push(...plan.errors.filter(e => !errors.includes(e)))
  const coreVersion = input.coreVersion

  if (!EXACT_VERSION.test(input.uiVersion)) {
    const message = `UI version ${input.uiVersion} is not an exact version`
    if (!errors.includes(message)) errors.push(message)
  }

  /*
   * The pins are the UI's own statement about which Core it was built against.
   * They are checkable offline, so they are checked offline — a wrong pin is a
   * mistake to catch in the PR, not at release time.
   */
  const pins = (input.listCorePins ?? listCorePins)(input.uiRoot)
  if (pins.length === 0) {
    errors.push('No @zeus-js/* pins were found in the UI workspace')
  }
  for (const pin of pins) {
    const independent = INDEPENDENT_CORE_PINS[pin.name]
    if (independent !== undefined) {
      if (pin.version !== independent) {
        errors.push(
          `${pin.file}: ${pin.name} ${pin.version} != independent Core version ${independent}`,
        )
      }
      continue
    }

    /*
     * No Core version means `planPairing` already refused the release; a
     * comparison against `undefined` would add one identical error per pin and
     * bury that one.
     */
    if (coreVersion === undefined) {
      continue
    }

    if (pin.version !== coreVersion) {
      errors.push(
        `${pin.file}: ${pin.name} ${pin.version} != paired Core version ${coreVersion}`,
      )
    }
  }

  return {
    ok: errors.length === 0,
    channel,
    ...(plan.coreTag ? { coreTag: plan.coreTag } : {}),
    errors,
  }
}

/**
 * The full check: static, plus Core's tag and Core's record.
 *
 * Runs at release time. Every failure mode — tag missing, record missing,
 * record malformed, record naming a different UI commit, GitHub unreachable —
 * is an error, and none of them degrades to a pass.
 */
export function evaluatePairing(input: OnlinePairingInput): PairingResult {
  const staticResult = evaluateStatic(input)
  const errors = [...staticResult.errors]
  const channel = staticResult.channel
  if (channel === undefined) return { ok: false, errors }

  /*
   * No `?? input.uiVersion` fallback: the Core version is its own input, and
   * defaulting it to the UI version is what sent v1's dispatch looking for a
   * Core tag named after the UI release.
   */
  const coreVersion = input.coreVersion

  if (coreVersion === undefined) {
    return { ok: false, channel, errors }
  }

  const requirePairing = input.requirePairing ?? channel !== 'beta'
  const coreTag = `v${coreVersion}`

  if (!FULL_SHA.test(input.uiCommit)) {
    errors.push('release SHA must be a full 40-character UI commit SHA')
  }

  if (!requirePairing) {
    /*
     * Beta does not need a cross-repository pairing record, but publishing a
     * consumer requires the Core release itself to be immutable and real.
     * Resolve the Core tag independently of the UI version and carry its SHA
     * into the report. The workflow's later verification must not be able to
     * mistake a pin-only static check for an immutable release binding.
     */
    const resolveCoreTag = input.resolveCoreTag ?? resolveCoreTagOnGitHub
    const coreCommit = resolveCoreTag(coreTag)
    if (coreCommit === undefined || !FULL_SHA.test(coreCommit)) {
      errors.push(
        `Core tag ${coreTag} cannot be resolved to a 40-character commit; a beta release must consume an immutable published Core release`,
      )
      return { ok: false, channel, coreTag, errors }
    }
    return {
      ok: errors.length === 0,
      channel,
      coreTag,
      coreCommit,
      errors,
    }
  }

  const resolveCoreTag = input.resolveCoreTag ?? resolveCoreTagOnGitHub
  const tagCommit = resolveCoreTag(coreTag)
  if (tagCommit === undefined) {
    errors.push(
      `Core tag v${coreVersion} cannot be resolved; the paired Core release does not exist or GitHub could not be reached`,
    )
    return { ok: false, channel, errors }
  }
  if (!FULL_SHA.test(tagCommit)) {
    errors.push(`Core tag v${coreVersion} did not resolve to a commit`)
    return { ok: false, channel, coreTag, errors }
  }

  /*
   * The record is read **from the tagged commit**, not from the UI checkout and
   * not from a branch. A record that only exists on `main` after the tag says
   * nothing about what was released.
   */
  const readCoreFile = input.readCoreFile ?? readCoreFileAtCommit
  let raw: string | undefined
  let recordPath = ''

  /*
   * Both directories, newest first. The tags created before the move carry
   * the old one permanently, so a single-path read makes one half of the
   * published history unreadable.
   */
  for (const directory of CORE_PAIRING_DIRECTORIES) {
    const candidate = `${directory}/v${coreVersion}.json`
    const contents = readCoreFile(tagCommit, candidate)

    if (contents !== undefined) {
      raw = contents
      recordPath = candidate
      break
    }
  }

  if (raw === undefined) {
    errors.push(
      `Core tag v${coreVersion} points at ${tagCommit}, which has no ${CORE_PAIRING_DIRECTORIES.map(d => `${d}/v${coreVersion}.json`).join(' or ')}`,
    )
    return { ok: false, channel, coreTag, errors }
  }

  const parsed = parseCorePairingRecord(raw, errors)
  if (!parsed) return { ok: false, channel, coreTag, errors }

  /*
   * A bootstrap release published before any UI commit existed, so the record
   * inside its tag names `uiCommit: null` — and that tag cannot move. Reading
   * only this file would make every bootstrap release permanently unpairable.
   *
   * The pair is therefore established afterwards, by a protected `pair/v…`
   * tag pointing at a commit that attests the same Core commit plus the UI
   * candidate. The attestation is read here, and it is *required* to agree
   * with the tagged record on everything both of them state.
   */
  if (parsed.uiCommit === null) {
    return evaluateBootstrapPairing({
      input,
      coreVersion,
      tagCommit,
      channel,
      errors,
      record: parsed,
    })
  }

  if (parsed.coreVersion !== coreVersion) {
    errors.push(
      `Core record ${recordPath} coreVersion ${parsed.coreVersion} != expected ${coreVersion}`,
    )
  }
  if (parsed.uiVersion !== input.uiVersion) {
    errors.push(
      `Core record uiVersion ${parsed.uiVersion} != release version ${input.uiVersion}`,
    )
  }
  /*
   * Whether an amendment exists decides the whole shape of this check, so it is
   * asked *before* comparing commits rather than as a reaction to a mismatch.
   *
   * That order is the point. v1 consulted the amendment only when the release
   * commit already differed from the tagged one. An amendment is published to
   * supersede a candidate, so while it is in force the superseded commit must
   * be refused — and under the old order the superseded commit had a live
   * direct-verification path forever. Two commits could both be paired with one
   * Core release, and which one shipped depended on who ran the release.
   */
  const verdict = readAmendmentVerdict({
    input,
    coreVersion,
    tagCommit,
    recordPath,
    recordRaw: raw,
    originalUiCommit: parsed.uiCommit,
  })

  if (verdict.state === 'LOOKUP_FAILED') {
    /*
     * Not "no amendment". A network or permission failure must not send the
     * release down the direct path, because whether an amendment exists is
     * exactly the fact that could not be established.
     */
    errors.push(...verdict.errors)
    return { ok: false, channel, coreTag, errors }
  }

  if (verdict.state === 'PRESENT_INVALID') {
    /*
     * An amendment exists and does not hold. Falling back to the tagged
     * candidate here would make a corrupt amendment the way to restore a pair
     * that was already superseded — a downgrade dressed as a resolution.
     */
    errors.push(...verdict.errors)
    return { ok: false, channel, coreTag, errors }
  }

  if (verdict.state === 'PRESENT_VALID') {
    /*
     * A valid amendment names the replacement, and the validator has already
     * refused any other commit — so reaching here means the release is that
     * replacement. The branch exists to state the outcome, not to compare
     * again: a second comparison is a second place for the rule to drift.
     *
     * Everything in `errors` was checked against the amendment as well — the
     * version fields, the pins, the channel — so a clean run arrives with none.
     */
    return {
      ok: errors.length === 0,
      channel,
      coreTag,
      coreCommit: tagCommit,
      record: parsed,
      amended: {
        tag: verdict.tag ?? amendmentTag(coreVersion),
        commit: verdict.commit ?? '',
        replacement: verdict.amendment?.replacement.uiCommit,
      },
      errors,
    }
  }

  /*
   * No amendment exists, so the tagged record is authoritative: Core names the
   * UI commit it paired with and the release must be that commit. This is what
   * replaces the UI writing its own SHA into its own tree.
   */
  if (parsed.uiCommit.toLowerCase() !== input.uiCommit.toLowerCase()) {
    errors.push(
      `Core record at v${coreVersion} names UI commit ${parsed.uiCommit}, but this release is ${input.uiCommit}`,
    )
  }

  return {
    ok: errors.length === 0,
    channel,
    coreTag,
    coreCommit: tagCommit,
    record: parsed,
    errors,
  }
}

/**
 * Finds out whether an amendment is in force for this release, and whether it
 * holds.
 *
 * ## The four states and why they are not two
 *
 * `ABSENT` means the remote has no `pair-amendment/v<version>` tag: the tagged
 * record is authoritative. `LOOKUP_FAILED` means the question could not be
 * asked — rate limit, token, network. They must never be the same value,
 * because treating an unanswered question as "no amendment" is exactly how a
 * superseded candidate gets released: the release falls through to the direct
 * path and compares against a record that a valid amendment has already
 * replaced. v1 returned `undefined` for both.
 *
 * `PRESENT_INVALID` is an amendment that exists and fails its own checks. It is
 * a refusal, not a cue to retry the direct path, for the same reason: the file
 * might be corrupt, but its existence proves someone intended to supersede the
 * tagged candidate, and a corrupt amendment must not restore a pair that was
 * meant to be replaced.
 *
 * `PRESENT_VALID` carries the recommendation; the caller decides what to do
 * with it, because only the caller knows which commit it is releasing.
 */
function readAmendmentVerdict(args: {
  input: OnlinePairingInput
  coreVersion: string
  tagCommit: string
  recordPath: string
  recordRaw: string
  originalUiCommit: string
}): AmendmentVerdict {
  const { input, coreVersion, tagCommit, recordPath, recordRaw } = args
  const errors: string[] = []

  /*
   * The amendment lives in the Core repository, addressed by tag — not in the
   * UI checkout, and not on any branch. A file on `main` describes an intention;
   * a tag describes what was published.
   */
  const amendmentTagName = amendmentTag(coreVersion)

  /*
   * `resolvePairTag`, not `resolveCoreTag`: the amendment lives in its own tag
   * namespace, and a caller that answers for *any* tag would make every release
   * look amended. Bootstrap attestations already use this hook for the same
   * reason.
   */
  /*
   * A three-state lookup, not `string | undefined`.
   *
   * `resolveCoreTagOnGitHub` returns `undefined` for both "the tag is not
   * there" and "the API did not answer", because the rest of the protocol can
   * treat both as a refusal. Here that equivalence is wrong: an unanswered
   * question about whether an amendment exists must not be answered "no",
   * or the release falls through to the direct path and compares against a
   * record a valid amendment may already have replaced. `resolveRemoteTag`
   * keeps the two apart.
   */
  const remoteLookup = input.resolvePairTagLookup
    ? (tag: string): TagLookup => input.resolvePairTagLookup!(tag)
    : (tag: string): TagLookup => {
        if (input.resolvePairTag !== undefined) {
          /*
           * An injected legacy hook can only say found-or-not. Treated as a
           * test-only shortcut: a throw is a failed lookup, `undefined` is
           * absent.
           */
          try {
            const commit = input.resolvePairTag(tag)
            return commit === undefined
              ? { state: 'ABSENT' }
              : { state: 'FOUND', commit }
          } catch (error) {
            return {
              state: 'ERROR',
              message: error instanceof Error ? error.message : String(error),
            }
          }
        }
        return resolveRemoteTag('baicie/zeus', tag)
      }

  const lookup = remoteLookup(amendmentTagName)
  if (lookup.state === 'ERROR') {
    return {
      state: 'LOOKUP_FAILED',
      errors: [
        `could not determine whether ${amendmentTagName} exists: ${lookup.message}`,
      ],
    }
  }
  if (lookup.state === 'ABSENT') return { state: 'ABSENT', errors: [] }
  const amendmentCommit = lookup.commit

  const readCoreFile = input.readCoreFile ?? readCoreFileAtCommit
  const amendmentPath = amendmentFile(coreVersion)
  const amendmentRaw = readCoreFile(amendmentCommit, amendmentPath)
  if (amendmentRaw === undefined) {
    return {
      state: 'PRESENT_INVALID',
      errors: [
        `${amendmentTagName} points at ${amendmentCommit}, which has no ${amendmentPath}`,
      ],
      tag: amendmentTagName,
      commit: amendmentCommit,
    }
  }

  let parsedAmendment: unknown
  try {
    parsedAmendment = JSON.parse(amendmentRaw)
  } catch {
    return {
      state: 'PRESENT_INVALID',
      errors: [`${amendmentPath} at ${amendmentTagName} is not valid JSON`],
      tag: amendmentTagName,
      commit: amendmentCommit,
    }
  }

  /*
   * Say what is actually happening before saying which field is wrong.
   *
   * The validator's message for this case is "replacement.uiCommit … is not the
   * commit being released", which is accurate and explains nothing: a reader
   * needs to know that a published amendment has *replaced* the candidate they
   * are trying to release, and that the release cannot proceed from it.
   */
  const amended = parsedAmendment as PairingAmendment
  const amendedReplacement = amended.replacement?.uiCommit
  if (
    typeof amendedReplacement === 'string' &&
    amendedReplacement.toLowerCase() !== input.uiCommit.toLowerCase()
  ) {
    errors.push(
      `v${coreVersion} is amended: the candidate that ships is ${amendedReplacement}, so ${input.uiCommit} cannot be released under this version`,
    )
  }

  errors.push(
    ...validatePairingAmendment(parsedAmendment, amendmentPath, {
      version: coreVersion,
      coreTagCommit: tagCommit,
      uiCommit: input.uiCommit,
    }).map(problem => problem.message),
  )

  /*
   * The amendment must describe *this* record, byte for byte. Without the
   * digest, an amendment could be written against one pairing record and
   * silently applied after the tag's record changed — which is impossible for a
   * protected tag but is asserted rather than assumed.
   */
  const actualRecordSha256 = createHash('sha256')
    .update(recordRaw)
    .digest('hex')
  const amendment = parsedAmendment as PairingAmendment
  if (
    typeof amendment.originalPairing?.recordSha256 === 'string' &&
    amendment.originalPairing.recordSha256.toLowerCase() !== actualRecordSha256
  ) {
    errors.push(
      `amendment records originalPairing.recordSha256 ${amendment.originalPairing.recordSha256}, but ${recordPath} at v${coreVersion} hashes to ${actualRecordSha256}`,
    )
  }
  if (
    typeof amendment.originalPairing?.uiCommit === 'string' &&
    amendment.originalPairing.uiCommit.toLowerCase() !==
      args.originalUiCommit.toLowerCase()
  ) {
    errors.push(
      `amendment records originalPairing.uiCommit ${amendment.originalPairing.uiCommit}, but ${recordPath} names ${args.originalUiCommit}`,
    )
  }

  /*
   * The replacement must exist on the UI remote, and its tree and lockfile must
   * be the ones the amendment pinned. A commit that only exists locally cannot
   * be checked out by the publish job.
   *
   * The lockfile is not skippable. When the digest cannot be produced the
   * answer is a refusal that says so, because "the tree matches" is a weaker
   * claim than the one the amendment makes: two commits can share a tree and
   * differ in their lockfile, and the lockfile is what names the Core this
   * candidate installs.
   */
  const verifyUiCandidate = input.verifyUiCandidate ?? lookupUiCandidateOnGitHub
  const candidate = verifyUiCandidate(
    input.uiRepository ?? 'baicie/zeus-ui',
    amendment.replacement?.uiCommit ?? '',
  )
  if (candidate.state === 'ERROR') {
    errors.push(
      `amendment replacement uiCommit ${String(amendment.replacement?.uiCommit)} could not be read from the UI repository: ${candidate.message}`,
    )
  } else if (candidate.state === 'MISSING') {
    errors.push(
      `amendment replacement uiCommit ${String(amendment.replacement?.uiCommit)} is not on the UI repository: ${candidate.message}`,
    )
  } else {
    if (
      typeof amendment.replacement?.uiTree === 'string' &&
      candidate.tree.toLowerCase() !==
        amendment.replacement.uiTree.toLowerCase()
    ) {
      errors.push(
        `amendment records uiTree ${amendment.replacement.uiTree}, but ${candidate.tree} is what the commit has`,
      )
    }
    if (
      typeof amendment.replacement?.lockfileSha256 === 'string' &&
      candidate.lockfileSha256.toLowerCase() !==
        amendment.replacement.lockfileSha256.toLowerCase()
    ) {
      errors.push(
        `amendment records lockfileSha256 ${amendment.replacement.lockfileSha256}, but the commit's pnpm-lock.yaml hashes to ${candidate.lockfileSha256}`,
      )
    }
  }

  /*
   * The evidence travels with the amendment and is checked here rather than
   * left to a reader.
   *
   * The amendment pins the bundle's digest; the bundle carries the five
   * reports with their producer, subject commit, bytes and verdict; every one
   * of those is recomputed. A digest of a file nobody holds would satisfy a
   * format check and nothing else, which is what v1 accepted.
   */
  const bundlePath = amendment.evidence?.bundlePath
  if (typeof bundlePath === 'string' && bundlePath.length > 0) {
    const bundleRaw = readCoreFile(amendmentCommit, bundlePath)
    if (bundleRaw === undefined) {
      errors.push(
        `${amendmentTagName} points at ${amendmentCommit}, which has no ${bundlePath}; the amendment's evidence must be committed with it`,
      )
    } else if (candidate.state === 'FOUND') {
      errors.push(
        ...verifyAmendmentEvidence(amendment, bundleRaw, bundlePath, {
          version: coreVersion,
          coreVersion,
          coreCommit: tagCommit,
          uiVersion: amendment.uiVersion ?? input.uiVersion,
          uiCommit: amendment.replacement?.uiCommit ?? input.uiCommit,
          uiTree: candidate.tree,
          lockfileSha256: candidate.lockfileSha256,
          ...(input.coreSource ? { coreSource: input.coreSource } : {}),
          ...(input.coverage ? { coverage: input.coverage } : {}),
        }).map(problem => `${problem.file}: ${problem.message}`),
      )
    }
  }

  if (errors.length > 0) {
    return {
      state: 'PRESENT_INVALID',
      errors,
      tag: amendmentTagName,
      commit: amendmentCommit,
    }
  }
  return {
    state: 'PRESENT_VALID',
    errors: [],
    amendment,
    tag: amendmentTagName,
    commit: amendmentCommit,
  }
}

/**
 * The pair for a release whose Core tag published unpaired.
 *
 * ## Why this is a separate path rather than a fallback
 *
 * A bootstrap release cannot name a UI commit: the UI lockfile resolves only
 * after those packages are on the registry, and the record has to be inside
 * the tagged commit. So the tag is permanent and says `uiCommit: null`, and
 * the pair is recorded afterwards under a protected `pair/v<version>` tag that
 * names the same Core commit plus a UI candidate.
 *
 * ## What is checked
 *
 * The attestation is not trusted for anything the caller can establish:
 *
 * - its `coreCommit` must equal the commit `v<version>` resolves to, so a pair
 *   cannot describe a Core tree that was never published under this version;
 * - its `uiCommit` must equal the release's commit, so the pair cannot name a
 *   candidate other than the one being released;
 * - its version fields must agree with the release;
 * - it must be read from the commit the `pair/v<version>` tag points at, not
 *   from a branch, so a later edit to `main` changes nothing about it.
 *
 * Every one of those failing is a refusal. There is no partial credit: a pair
 * that half-matches describes two different things.
 */
function evaluateBootstrapPairing(args: {
  input: OnlinePairingInput
  coreVersion: string
  tagCommit: string
  channel: ReleaseChannel
  errors: string[]
  record: CorePairingRecord
}): PairingResult {
  const { input, coreVersion, tagCommit, channel, errors, record } = args

  const resolvePairTag =
    input.resolvePairTag ?? (tag => resolveCoreTagOnGitHub(tag))
  const pairTag = `pair/v${coreVersion}`
  const pairCommit = resolvePairTag(pairTag)
  if (pairCommit === undefined) {
    errors.push(
      `Core tag v${coreVersion} published unpaired, and no ${pairTag} attestation exists; the pair was never recorded, so this release cannot claim it`,
    )
    return {
      ok: false,
      channel,
      coreTag: `v${coreVersion}`,
      coreCommit: tagCommit,
      record,
      errors,
    }
  }
  if (!FULL_SHA.test(pairCommit)) {
    errors.push(`${pairTag} did not resolve to a commit`)
    return {
      ok: false,
      channel,
      coreTag: `v${coreVersion}`,
      coreCommit: tagCommit,
      record,
      errors,
    }
  }

  const readCoreFile = input.readCoreFile ?? readCoreFileAtCommit
  const attestationPath = `release-pairing/attestations/v${coreVersion}.json`
  const raw = readCoreFile(pairCommit, attestationPath)
  if (raw === undefined) {
    errors.push(
      `${pairTag} points at ${pairCommit}, which has no ${attestationPath}`,
    )
    return {
      ok: false,
      channel,
      coreTag: `v${coreVersion}`,
      coreCommit: tagCommit,
      record,
      errors,
    }
  }

  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch (error) {
    errors.push(
      `pair attestation is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    )
    return {
      ok: false,
      channel,
      coreTag: `v${coreVersion}`,
      coreCommit: tagCommit,
      record,
      errors,
    }
  }
  if (!isPlainObject(value)) {
    errors.push('pair attestation must be a JSON object')
    return {
      ok: false,
      channel,
      coreTag: `v${coreVersion}`,
      coreCommit: tagCommit,
      record,
      errors,
    }
  }

  if (value.schema !== PAIR_ATTESTATION_SCHEMA) {
    errors.push(`pair attestation schema must be ${PAIR_ATTESTATION_SCHEMA}`)
  }
  if (value.releaseTag !== `v${coreVersion}`) {
    errors.push(
      `pair attestation releaseTag ${String(value.releaseTag)} != v${coreVersion}`,
    )
  }

  /*
   * The comparison that makes this a pair. Core published at `tagCommit`; the
   * attestation must name that exact commit. Anything else pairs the UI with a
   * Core tree that this version never published.
   */
  const attestedCore =
    typeof value.coreCommit === 'string' ? value.coreCommit : ''
  if (attestedCore.toLowerCase() !== tagCommit.toLowerCase()) {
    errors.push(
      `pair attestation names Core commit ${attestedCore || '(missing)'}, but v${coreVersion} points at ${tagCommit}`,
    )
  }

  const attestedUi = typeof value.uiCommit === 'string' ? value.uiCommit : ''
  if (!FULL_SHA.test(attestedUi)) {
    errors.push('pair attestation uiCommit is not a full 40-character SHA')
  } else if (attestedUi.toLowerCase() !== input.uiCommit.toLowerCase()) {
    errors.push(
      `pair attestation names UI commit ${attestedUi}, but this release is ${input.uiCommit}`,
    )
  }

  if (value.coreVersion !== coreVersion) {
    errors.push(
      `pair attestation coreVersion ${String(value.coreVersion)} != ${coreVersion}`,
    )
  }
  if (value.uiVersion !== input.uiVersion) {
    errors.push(
      `pair attestation uiVersion ${String(value.uiVersion)} != release version ${input.uiVersion}`,
    )
  }
  /*
   * The tagged record and the attestation both describe this release, so they
   * must agree on the one fact they share beyond the version: that it was
   * published unpaired. An attestation claiming `bootstrap: false` describes a
   * release whose tag carries a pair — which this tag does not.
   */
  if (value.bootstrap !== true) {
    errors.push(
      'pair attestation must record bootstrap: true, because the release tag it pairs with published unpaired',
    )
  }

  return {
    ok: errors.length === 0,
    channel,
    coreTag: `v${coreVersion}`,
    coreCommit: tagCommit,
    record: {
      ...record,
      uiCommit: attestedUi,
    },
    errors,
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseCorePairingRecord(
  raw: string,
  errors: string[],
): CorePairingRecord | undefined {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch (error) {
    errors.push(
      `Core pairing record is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    )
    return undefined
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push('Core pairing record must be a JSON object')
    return undefined
  }
  const record = value as Partial<CorePairingRecord>
  const typeErrors: string[] = []
  if (record.schema !== CORE_PAIRING_SCHEMA) {
    typeErrors.push(`Core pairing record schema must be ${CORE_PAIRING_SCHEMA}`)
  }
  for (const field of ['coreVersion', 'uiVersion'] as const) {
    if (
      typeof record[field] !== 'string' ||
      !EXACT_VERSION.test(record[field]!)
    ) {
      typeErrors.push(`Core pairing record ${field} must be an exact version`)
    }
  }
  /*
   * `uiCommit` is either a full SHA or `null`.
   *
   * `null` means the tag published unpaired, which is legal only for a new
   * version line's first RC and only when the record says `bootstrap: true`.
   * Accepting `null` here without that flag would turn "the field is missing"
   * into "the release is paired" — the ambiguity the flag exists to remove.
   */
  const bootstrapDeclared = record.bootstrap === true
  if (record.uiCommit === null) {
    if (!bootstrapDeclared) {
      typeErrors.push(
        'Core pairing record uiCommit is null but the record does not declare bootstrap',
      )
    }
  } else if (
    typeof record.uiCommit !== 'string' ||
    !FULL_SHA.test(record.uiCommit)
  ) {
    typeErrors.push(
      'Core pairing record uiCommit must be a full 40-character SHA, or null on a bootstrap record',
    )
  }
  if (bootstrapDeclared && typeof record.uiCommit === 'string') {
    typeErrors.push(
      'Core pairing record declares bootstrap but also names a UI commit; a release is paired or unpaired, never both',
    )
  }
  if (typeErrors.length > 0) {
    errors.push(...typeErrors)
    return undefined
  }
  return record as CorePairingRecord
}

/** `@zeus-js/*` pins declared anywhere in the UI workspace. */
export function listCorePins(uiRoot: string): CorePin[] {
  const pins: CorePin[] = []
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue
      const absolute = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        visit(absolute)
        continue
      }
      if (entry.name !== 'package.json') continue
      let manifest: Record<string, unknown>
      try {
        manifest = JSON.parse(readFileSync(absolute, 'utf8')) as Record<
          string,
          unknown
        >
      } catch {
        continue
      }
      for (const field of [
        'dependencies',
        'devDependencies',
        'peerDependencies',
        'optionalDependencies',
      ]) {
        const block = manifest[field]
        if (!block || typeof block !== 'object') continue
        for (const [name, version] of Object.entries(
          block as Record<string, unknown>,
        )) {
          if (!name.startsWith('@zeus-js/')) continue
          if (typeof version !== 'string') continue
          pins.push({
            file: path.relative(uiRoot, absolute),
            name,
            version,
          })
        }
      }
    }
  }
  /*
   * Every workspace member, not just `packages/`.
   *
   * `pnpm-workspace.yaml` also lists `benchmarks/*`, `apps/*` and `examples/*`.
   * Scanning only `packages/` let `examples/ai-workbench` — which still pinned
   * `@zeus-js/zeus@0.1.1-beta.20` while the other 46 packages moved to
   * `0.2.0-rc.0` — pass the static half as `passed`. The mismatch surfaced
   * later, as an unresolvable install against the registry, which is a much
   * worse place to find it: the tree looked complete and the failure named a
   * package rather than the file that was stale.
   */
  for (const group of ['packages', 'benchmarks', 'apps', 'examples']) {
    const directory = path.join(uiRoot, group)
    if (existsSync(directory)) visit(directory)
  }
  return pins
}

/**
 * `v<version>` on Core, resolved through the GitHub API.
 *
 * Annotated tags point at a tag object rather than a commit, so the object is
 * dereferenced when needed. `undefined` means the lookup failed — missing tag,
 * rate limit, no token — and the caller treats it as a failure.
 */
/**
 * Reads a UI commit's identity from GitHub: its root tree, and the sha256 of
 * its `pnpm-lock.yaml`.
 *
 * The lockfile digest is computed from the blob's own bytes rather than taken
 * from an API field, because the point of pinning it is that the amendment must
 * describe the lockfile that will ship. GitHub serves blobs base64-encoded; the
 * digest is over the decoded content.
 *
 * ## Why this returns three states instead of `undefined`
 *
 * The previous version returned `UiCandidateIdentity | undefined` and left
 * `lockfileSha256` optional, so two different situations produced the same
 * value: a commit that does not exist, and a lockfile whose fetch or decode
 * failed. The caller skipped the lockfile comparison when the digest was
 * missing, which meant a failed fetch *weakened* the check it should have
 * blocked — the fail-open this function is now shaped to prevent.
 *
 * ## The large-file path
 *
 * The Contents API refuses to inline blobs above roughly 1 MB, and this
 * repository's lockfile is already several hundred KB. When `content` is
 * absent or the response says `encoding: "none"`, the blob is read through the
 * Git Data API by its own SHA — that endpoint always returns the bytes, encoded
 * in base64, and it is addressed by blob id so the content is pinned to the
 * commit's tree rather than to a branch that may have moved.
 */
export function lookupUiCandidateOnGitHub(
  repository: string,
  commit: string,
): UiCandidateLookup {
  if (!/^[0-9a-f]{40}$/i.test(commit)) {
    return {
      state: 'MISSING',
      message: `${commit || '(empty)'} is not a commit SHA`,
    }
  }
  const gh = (args: string[]): string =>
    execFileSync('gh', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30_000,
    }) as string

  let treeSha: string
  try {
    const tree = JSON.parse(
      gh(['api', `repos/${repository}/git/commits/${commit}`]),
    ) as { tree?: { sha?: string } }
    if (typeof tree.tree?.sha !== 'string') {
      return {
        state: 'MISSING',
        message: `${commit} on ${repository} carries no root tree`,
      }
    }
    treeSha = tree.tree.sha
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return /HTTP 404|Not Found/i.test(message)
      ? { state: 'MISSING', message: `${commit} is not on ${repository}` }
      : {
          state: 'ERROR',
          message: `reading ${commit} from ${repository} failed: ${message}`,
        }
  }

  /*
   * The lockfile's blob id comes from the commit's own tree, so the bytes read
   * next are the ones at that commit — never the current contents of a branch.
   */
  let blobSha: string
  try {
    const tree = JSON.parse(
      gh(['api', `repos/${repository}/git/trees/${treeSha}`]),
    ) as { tree?: Array<{ path?: string; type?: string; sha?: string }> }
    const entry = (tree.tree ?? []).find(
      item => item.path === 'pnpm-lock.yaml' && item.type === 'blob',
    )
    if (!entry?.sha) {
      return {
        state: 'MISSING',
        message: `${commit} on ${repository} has no pnpm-lock.yaml; the amendment pins its digest, so there is nothing to compare`,
      }
    }
    blobSha = entry.sha
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      state: 'ERROR',
      message: `reading the tree of ${commit} failed: ${message}`,
    }
  }

  try {
    const blob = JSON.parse(
      gh(['api', `repos/${repository}/git/blobs/${blobSha}`]),
    ) as { content?: string; encoding?: string; size?: number }
    if (blob.encoding !== 'base64' || typeof blob.content !== 'string') {
      return {
        state: 'ERROR',
        message: `blob ${blobSha} for ${commit}'s pnpm-lock.yaml came back as ${String(blob.encoding)} rather than base64`,
      }
    }
    /*
     * GitHub wraps base64 at 60 characters, and `gh` prints it verbatim, so the
     * newlines are stripped before decoding. Keeping them makes some decoders
     * stop at the first line and hash 60 bytes — a digest that looks plausible
     * and matches nothing.
     */
    const encoded = blob.content.replace(/\s+/g, '')
    const bytes = Buffer.from(encoded, 'base64')
    /*
     * A silent truncation would produce a valid-looking digest of the wrong
     * bytes. Comparing against the size GitHub reports turns that into a named
     * error instead.
     */
    if (typeof blob.size === 'number' && blob.size !== bytes.length) {
      return {
        state: 'ERROR',
        message: `blob ${blobSha} declares ${String(blob.size)} bytes but decoded ${String(bytes.length)}; refusing to hash a truncated lockfile`,
      }
    }
    return {
      state: 'FOUND',
      tree: treeSha,
      lockfileSha256: createHash('sha256').update(bytes).digest('hex'),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      state: 'ERROR',
      message: `reading blob ${blobSha} failed: ${message}`,
    }
  }
}

export function resolveCoreTagOnGitHub(
  tag: string,
  repository = 'baicie/zeus',
): string | undefined {
  /*
   * A unit test that forgets to inject a resolver should fail fast, not block.
   *
   * This already cost two CI rounds: an unguarded case reached `gh api`, and
   * Windows waited on it for the whole test timeout while Linux failed the call
   * immediately. Refusing under `VITEST` turns "a test forgot" into a clear
   * error at the ask, and leaves production — which never sets it — unchanged.
   */
  if (
    process.env.VITEST === 'true' &&
    process.env.ZEUS_ALLOW_GH_IN_TESTS !== '1'
  ) {
    throw new Error(
      `resolveCoreTagOnGitHub(${tag}) was called from a unit test; inject resolveCoreTag or resolvePairTag instead`,
    )
  }
  const gh = (args: string[]): string =>
    execFileSync('gh', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30_000,
    }) as string
  try {
    const ref = JSON.parse(
      gh(['api', `repos/${repository}/git/ref/tags/${tag}`]),
    ) as { object?: { type?: string; sha?: string } }
    const object = ref.object
    if (!object || typeof object.sha !== 'string') return undefined
    if (object.type === 'commit') return object.sha
    const tagObject = JSON.parse(
      gh(['api', `repos/${repository}/git/tags/${object.sha}`]),
    ) as { object?: { sha?: string } }
    return typeof tagObject.object?.sha === 'string'
      ? tagObject.object.sha
      : undefined
  } catch {
    return undefined
  }
}

/** A file at a commit on Core, or `undefined` when it is not there. */
export function readCoreFileAtCommit(
  commit: string,
  file: string,
  repository = 'baicie/zeus',
): string | undefined {
  try {
    return execFileSync(
      'gh',
      [
        'api',
        `repos/${repository}/contents/${file}?ref=${commit}`,
        '-H',
        'Accept: application/vnd.github.raw',
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000 },
    ) as string
  } catch {
    return undefined
  }
}

/**
 * A template for a Core pairing record, for the short window between a UI
 * candidate being pushed and Core recording it.
 *
 * It deliberately contains no UI commit: that value comes from Core, and a
 * tool that wrote one here would be recreating the self-reference.
 */
export function writeCorePairingTemplate(
  directory: string,
  version: string,
): string {
  mkdirSync(directory, { recursive: true })
  const file = path.join(directory, `v${version}.json`)
  if (existsSync(file)) return file
  writeFileSync(
    file,
    `${JSON.stringify(
      {
        schema: CORE_PAIRING_SCHEMA,
        coreVersion: version,
        uiCommit: '<UI commit, filled in by the Core release PR>',
        uiVersion: version,
        verifiedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  )
  return file
}

/**
 * The report a release uploads as evidence.
 *
 * ## Why it is a separate artifact from the exit code
 *
 * The workflows upload `release-pairing.json` with `if-no-files-found: error`,
 * so the file is a hard requirement — but before this existed, nothing wrote
 * it. The `--out` flag was accepted and ignored, which meant the upload step
 * failed after every check had passed, or (worse, if the flag had been
 * dropped) an artifact from an earlier run could be what got preserved.
 *
 * ## What makes it evidence rather than a log
 *
 * It records the mode it ran in and refuses to be read as the other one. A
 * static pass and an online pass answer different questions — "the pins agree"
 * versus "the pair was proven against an immutable tag" — and a reader who
 * cannot tell which they are holding has no way to know whether the pair was
 * ever checked.
 *
 * It is written on failure too. A refusal that leaves no record is a refusal
 * nobody can diagnose, and the recovery path for a half-published release
 * depends on knowing exactly which clause failed.
 */
export const PAIRING_REPORT_SCHEMA = 'zeus.ui-pairing-report/v1'

export interface PairingReport {
  readonly schema: typeof PAIRING_REPORT_SCHEMA
  /** `static` answers offline questions only; `online` adds the pair. */
  readonly mode: 'static' | 'online'
  readonly version: string
  readonly channel: ReleaseChannel | null
  readonly ok: boolean
  readonly errors: readonly string[]
  readonly verifiedAt: string
  /** Everything below is `null` in static mode, by construction. */
  readonly coreTag: string | null
  readonly coreTagCommit: string | null
  readonly pairTag: string | null
  readonly pairTagCommit: string | null
  readonly coreCommit: string | null
  readonly uiCommit: string | null
  /**
   * How the pair was established when it was not the tagged record.
   *
   * `null` means the record inside `v<coreVersion>` named this exact commit — a
   * direct pair. An object means a weaker mode was used, and it says which one
   * and from where.
   *
   * This field exists because the report is what the release workflow reads to
   * decide whether to publish, and what an auditor reads afterwards. Without
   * it, an amended release produced a report indistinguishable from a direct
   * one: `pairTag` was computed as `pair/v<coreVersion>` regardless of mode, so
   * the evidence positively named a bootstrap attestation that was never
   * involved. A report that misdescribes its own authority is worse than no
   * report.
   */
  readonly pairingMode: 'direct' | 'bootstrap' | 'amendment'
  readonly amendment: {
    readonly tag: string
    readonly commit: string
    readonly replacement: string | null
  } | null
}

export interface WritePairingReportInput {
  readonly result: PairingResult
  readonly mode: 'static' | 'online'
  /** The UI version being released. */
  readonly version: string
  /** The Core version this UI release was verified against. */
  readonly coreVersion?: string
  /** Explicit Core tag override; defaults to the result's `coreTag`. */
  readonly coreTag?: string
  readonly uiCommit?: string
  readonly coreTagCommit?: string
  readonly pairTagCommit?: string
  readonly coreCommit?: string
}

export function buildPairingReport(
  input: WritePairingReportInput,
): PairingReport {
  const online = input.mode === 'online'
  return {
    schema: PAIRING_REPORT_SCHEMA,
    mode: input.mode,
    version: input.version,
    channel: input.result.channel ?? null,
    ok: input.result.ok,
    errors: [...input.result.errors],
    verifiedAt: new Date().toISOString(),
    /*
     * `coreTag` is named in both modes because it is the tag whose immutability
     * the pair depends on. The rest are online-only: a static run has not read
     * any of them, and emitting a placeholder would let a reader mistake "not
     * looked up" for "looked up and empty".
     */
    /*
     * The report states the Core tag from the *result*, not from the release
     * version. v1 wrote `v${input.version}`, where `version` is the UI
     * version, so the report named a Core tag that cannot exist whenever the
     * two version lines differ.
     */
    coreTag: input.result.coreTag ?? input.coreTag ?? null,
    coreTagCommit: online
      ? (input.coreTagCommit ?? input.result.coreCommit ?? null)
      : null,
    /*
     * The bootstrap attestation tag, and only when bootstrap is the mode.
     *
     * It used to be emitted for every non-beta release, so an amended pair's
     * report named a `pair/v…` tag that either did not exist or described a
     * different pairing. `pairTagCommit` was `input.pairTagCommit ?? null`, and
     * no caller ever passed it, so the field was always null while the tag name
     * sat next to it — the worst of both: a claim with no supporting commit.
     */
    pairTag:
      input.result.channel === 'beta' || input.result.amended !== undefined
        ? null
        : input.result.coreTag
          ? `pair/${input.result.coreTag}`
          : online && input.coreVersion
            ? `pair/v${input.coreVersion}`
            : null,
    pairTagCommit: online ? (input.pairTagCommit ?? null) : null,
    /*
     * Carried on the result by the runner that resolved it. This is the field
     * the release workflow refuses to proceed without, and v1 dropped it here
     * because the report was built from the version string alone.
     */
    coreCommit: online
      ? (input.coreCommit ??
        input.result.coreCommit ??
        input.coreTagCommit ??
        null)
      : null,
    uiCommit: online ? (input.uiCommit ?? null) : null,
    pairingMode:
      input.result.amended !== undefined
        ? 'amendment'
        : input.result.record === undefined
          ? 'bootstrap'
          : 'direct',
    amendment:
      input.result.amended === undefined
        ? null
        : {
            tag: input.result.amended.tag,
            commit: input.result.amended.commit,
            replacement: input.result.amended.replacement ?? null,
          },
  }
}

/**
 * Writes the report, returning the path.
 *
 * Failure to write is not swallowed: the workflow's next step requires the
 * file, and a run that silently skipped writing it would surface as a missing
 * artifact far from the cause.
 */
export function writePairingReport(
  file: string,
  report: PairingReport,
): string {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`)
  return file
}

/**
 * The publish dispatch carries a Core SHA. Compare it with the commit just
 * resolved from the immutable Core tag, never trust the dispatch value as the
 * source of truth. A syntactically valid but unrelated SHA must fail before
 * any package is published.
 */
export function compareExpectedCoreCommit(
  result: PairingResult,
  expectedCommit: string,
): PairingResult {
  const errors = [...result.errors]
  if (!FULL_SHA.test(expectedCommit)) {
    errors.push('expected Core commit must be a full 40-character SHA')
  } else if (
    !result.coreCommit ||
    result.coreCommit.toLowerCase() !== expectedCommit.toLowerCase()
  ) {
    errors.push(
      `verified Core commit ${result.coreCommit ?? '(missing)'} does not match publish dispatch ${expectedCommit}`,
    )
  }
  return {
    ...result,
    ok: result.ok && errors.length === 0,
    errors,
  }
}

/**
 * The UI version from the workspace's own manifest.
 *
 * Used only as a CLI default; an explicit `--version` always wins. The value
 * comes from `package.json` rather than from a pin, because the UI version is
 * what the UI publishes, not what it depends on.
 */
function readWorkspaceUiVersion(): string | undefined {
  try {
    const raw = readFileSync(path.resolve('package.json'), 'utf8')
    const version = (JSON.parse(raw) as { version?: string }).version
    return typeof version === 'string' ? version : undefined
  } catch {
    return undefined
  }
}

/**
 * The Core version the workspace's `@zeus-js` pins agree on.
 *
 * This is the fact `evaluateStatic` checks from the other side: if the pins
 * disagree, this returns `null` and the release is refused — which is the
 * intended outcome, not an error to paper over.
 */
function resolveWorkspaceCoreVersion(uiRoot: string): string | undefined {
  return (
    resolveWorkspaceZeusVersion(listZeusDependencyManifests(uiRoot)) ??
    undefined
  )
}

/**
 * `@zeus-js/*` specs that are dist-tags rather than versions.
 *
 * A pin of `canary` says "whatever is on the canary tag right now", which is a
 * different claim from "the release this was verified against". The pairing
 * contract is the second one, so a workspace full of dist-tags has said nothing
 * this command can check.
 *
 * It used to fall through to `FALLBACK_EXPECTED_ZEUS_VERSION` and *pass*: on a
 * tree where every `@zeus-js/*` pin was `canary`, `check-release-pairing`
 * printed `UI release pairing 0.1.0-beta.35 passed (beta, static)` and exited
 * zero — inventing a Core version from a constant while the workspace named
 * none. That is the canary compatibility job, so the job was green for a run
 * that proved nothing.
 */
function distTagPins(
  uiRoot: string,
): Array<{ file: string; name: string; spec: string }> {
  const found: Array<{ file: string; name: string; spec: string }> = []
  for (const file of listZeusDependencyManifests(uiRoot)) {
    let manifest: Record<string, unknown>
    try {
      manifest = JSON.parse(readFileSync(file, 'utf8')) as Record<
        string,
        unknown
      >
    } catch {
      continue
    }
    for (const field of ['dependencies', 'devDependencies']) {
      const deps = manifest[field]
      if (!deps || typeof deps !== 'object') continue
      for (const [name, spec] of Object.entries(
        deps as Record<string, unknown>,
      )) {
        if (!name.startsWith('@zeus-js/')) continue
        if (typeof spec !== 'string') continue
        if (/^\d+\.\d+\.\d+/.test(spec)) continue
        found.push({ file, name, spec })
      }
    }
  }
  return found
}

/**
 * Reads the coverage contract a caller supplies.
 *
 * Malformed input is a refusal, not a silent skip: a file that was meant to
 * tighten the check and does not parse would otherwise leave the run looking
 * stricter than it is.
 */
function readCoverage(
  file: string | undefined,
): AcceptanceCoverage | undefined {
  if (file === undefined) return undefined
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    throw new Error(
      `--coverage ${file} could not be read: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`--coverage ${file} must contain a JSON object`)
  }
  return parsed as AcceptanceCoverage
}

const CORE_SOURCES = ['registry', 'workspace', 'candidate', 'unknown'] as const

function readCoreSource(
  value: string | undefined,
): 'registry' | 'workspace' | 'candidate' | 'unknown' | undefined {
  if (value === undefined) return undefined
  if (!(CORE_SOURCES as readonly string[]).includes(value)) {
    throw new Error(
      `--core-source must be one of ${CORE_SOURCES.join(', ')}, not ${value}`,
    )
  }
  return value as (typeof CORE_SOURCES)[number]
}

function main(): void {
  const { values } = parseArgs({
    options: {
      'ui-root': { type: 'string', default: process.cwd() },
      version: { type: 'string' },
      'core-version': { type: 'string' },
      'expected-core-commit': { type: 'string' },
      'release-sha': { type: 'string' },
      online: { type: 'boolean', default: false },
      out: { type: 'string' },
      /*
       * Which repository an amendment's replacement commit must exist on.
       * Defaults to the canonical UI repository; named here so a fork or a
       * renamed repository reads correctly rather than silently checking the
       * wrong place.
       */
      'ui-repository': { type: 'string' },
      /*
       * The acceptance coverage contract, as JSON.
       *
       * A file rather than flags: the template list and package inventory are
       * generated from the release tree, and typing them on a command line is
       * how one of them silently goes missing.
       */
      coverage: { type: 'string' },
      'core-source': { type: 'string' },
    },
  })
  /*
   * Both versions default to the workspace, so `pnpm check:release-pairing`
   * works from the precheck with no arguments. Requiring them made the
   * precheck entry fail with exit 2 on every run, which is a gate that can
   * only be passed by deleting it.
   *
   * `coreVersion` is still required by `planPairing` — the default here is the
   * version the workspace's `@zeus-js` pins agree on, which is the same fact
   * stated from the other side. If they disagree, the resolver returns null
   * and `planPairing` refuses.
   */
  const uiVersion = values.version ?? readWorkspaceUiVersion()
  const coreVersion =
    values['core-version'] ??
    resolveWorkspaceCoreVersion(path.resolve(values['ui-root'] ?? '.'))

  if (!uiVersion) {
    console.error(
      'usage: check-release-pairing --version <v> [--core-version <v>] [--ui-root <path>] [--online --release-sha <sha>] [--out <file>]',
    )
    process.exitCode = 2
    return
  }
  if (values.online && !values['release-sha']) {
    /*
     * An online run without the release SHA cannot compare anything: every
     * commit-comparison would be against the empty string, and a record that
     * disagrees with `''` produces a confusing message. Refusing here names the
     * omission instead.
     */
    console.error('usage: --online requires --release-sha <40-character SHA>')
    process.exitCode = 2
    return
  }

  if (values['expected-core-commit'] !== undefined && !values.online) {
    console.error('--expected-core-commit requires --online')
    process.exitCode = 2
    return
  }

  const uiRoot = path.resolve(values['ui-root'] ?? '.')

  /*
   * A tree pinned to dist-tags has named no Core release. Say that, rather than
   * falling back to a constant and reporting a pairing nobody verified — the
   * canary compatibility job ran in exactly this shape and was green.
   */
  const tags = distTagPins(uiRoot)
  if (tags.length > 0 && values['core-version'] === undefined) {
    const specs = [...new Set(tags.map(tag => tag.spec))].sort()
    console.error(
      `The workspace pins ${tags.length} @zeus-js package(s) to a dist-tag (${specs.join(', ')}), ` +
        'which names no release to pair against. Pass --core-version with the exact version ' +
        'this tree was verified against, or pin the workspace to that version.',
    )
    process.exitCode = 2
    return
  }

  if (!coreVersion) {
    console.error(
      'No Core version could be resolved from the workspace pins; pass --core-version',
    )
    process.exitCode = 2
    return
  }

  const coverage = readCoverage(values.coverage)
  const coreSource = readCoreSource(values['core-source'])

  const evaluated = values.online
    ? evaluatePairing({
        uiRoot,
        uiVersion,
        coreVersion,
        uiCommit: values['release-sha'] ?? '',
        ...(values['ui-repository']
          ? { uiRepository: values['ui-repository'] }
          : {}),
        ...(coverage ? { coverage } : {}),
        ...(coreSource ? { coreSource } : {}),
      })
    : evaluateStatic({
        uiRoot,
        uiVersion,
        coreVersion,
      })

  /*
   * The dispatch supplies a Core SHA; compare it with the commit the tag just
   * resolved to rather than trusting it. A syntactically valid but unrelated
   * SHA must fail before anything is published.
   */
  const result =
    values['expected-core-commit'] === undefined
      ? evaluated
      : compareExpectedCoreCommit(evaluated, values['expected-core-commit'])

  for (const error of result.errors) console.error(pc.red(error))

  if (values.out) {
    /*
     * Written before the exit code is decided, so a failing run still leaves
     * the evidence its recovery depends on.
     */
    const report = buildPairingReport({
      result,
      mode: values.online ? 'online' : 'static',
      version: uiVersion,
      /*
       * The Core version travels with the report. v1 omitted it, so the report
       * builder fell back to the *UI* version for the Core tag and the
       * workflow then rejected the report for carrying no coreCommit.
       *
       * `coreCommit` is not passed here: `evaluatePairing` resolved it and put
       * it on the result, which is the single place it can come from without
       * the caller re-deriving it.
       */
      ...(values['core-version']
        ? { coreVersion: values['core-version'] }
        : {}),
      ...(values.online && values['release-sha']
        ? { uiCommit: values['release-sha'] }
        : {}),
    })
    writePairingReport(values.out, report)
    console.log(pc.dim(`wrote ${values.out} (${report.mode}, ok=${report.ok})`))
  }

  if (result.ok) {
    console.log(
      pc.green(
        `UI release pairing ${uiVersion} passed (${result.channel}${values.online ? ', online' : ', static'})`,
      ),
    )
  } else {
    process.exitCode = 1
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main()
}
