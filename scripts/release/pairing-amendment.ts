import type {
  EvidenceExpectation,
  EvidenceReportId,
  ReleaseEvidenceBundle,
} from './evidence-bundle'
import { execFileSync } from 'node:child_process'
/**
 * Recording why a published Core release is paired with a different UI commit
 * than the one its immutable tag names.
 *
 * ## The situation this exists for
 *
 * A Core release tag is immutable by rule, and its tree carries the pairing
 * record written when the release was cut. That record names the UI commit the
 * release was verified against. When the UI candidate has *not* been published,
 * and the UI repository's history changes under it — a squash merge rewriting
 * the commit, or fixes required to make the UI tree releasable at all — the
 * tag's record names a commit that is no longer the one that will ship.
 *
 * The tag cannot move and the record inside it cannot be edited. Without a way
 * to say "this published Core release is paired with this other UI commit, and
 * here is why", the only options are to republish Core (which means a new
 * version for a metadata change) or to leave the pair permanently incomplete.
 *
 * ## What it is not
 *
 * It is not a fallback for a pairing failure. A direct pair and a bootstrap
 * attestation are both stronger: the first was verified before publication,
 * the second says outright that no pair existed. An amendment only applies
 * when the release *was* paired, that pair was never published on the UI side,
 * and a replacement candidate has been fully re-verified.
 *
 * ## What changed in v2, and why
 *
 * v1 pinned five sha256 strings and called them evidence, and accepted an
 * authorization object whose `decisionReference` was a non-empty string. Both
 * were claims the writer could make up: a digest of a file nobody holds proves
 * nothing, and "see PR #419" is not an approval of the amendment being read.
 * Two consequences were worse than the original gap:
 *
 * - a bundle of correct-looking hex satisfied the evidence check, so a release
 *   could be paired on five files that never existed;
 * - an amendment written by the tool was structurally indistinguishable from
 *   one a maintainer had read and approved.
 *
 * v2 replaces both with things a reader can check:
 *
 * - `evidence.bundleSha256` names a committed bundle that *carries* the five
 *   reports, each with its producer, its subject commit, and its own bytes.
 *   The verifier recomputes every digest and re-judges every verdict, so a
 *   bundle cannot be relabelled after the fact.
 * - `authorization` names a merged pull request, and the approval is read from
 *   GitHub's review record — the approver, the commit they approved, and their
 *   permission level. A script can write the PR number; it cannot write the
 *   review.
 *
 * Nothing here is self-declared. `verifiedAt` and `approvedAt` are the two
 * fields no check depends on precisely because a script produces them.
 */
import { createHash } from 'node:crypto'
import fs from 'node:fs'

import path from 'node:path'
import {
  EVIDENCE_REPORT_IDS,
  evidenceBundleFile,
  evidenceSha256,
  verifyEvidenceBundle,
} from './evidence-bundle'

/** The schema an amendment file declares. */
export const PAIRING_AMENDMENT_SCHEMA = 'zeus.pairing-amendment/v2'

/** Where amendments live inside the Core repository. */
export const PAIRING_AMENDMENT_DIRECTORY = 'meta/release/pairing/amendments'

/**
 * The tag namespace that carries an amendment.
 *
 * Deliberately outside `refs/tags/v*`: creating an amendment must never trigger
 * `release.yml`, which would publish npm a second time. It is also outside
 * `refs/tags/pair/`, which carries bootstrap attestations — the two answer
 * different questions and an auditor must be able to tell them apart by name.
 *
 * Both namespaces are covered by the repository's tag immutability ruleset
 * (27438539); the ruleset's `ref_name.include` lists `refs/tags/pair/*` and
 * `refs/tags/pair-amendment/*` alongside the release namespaces.
 */
export const PAIRING_AMENDMENT_TAG_PREFIX = 'pair-amendment/'

const FULL_SHA = /^[0-9a-f]{40}$/i
const SHA256 = /^[0-9a-f]{64}$/i
const SEMVER = /^\d+\.\d+\.\d+(?:-(?:alpha|beta|rc)\.\d+)?$/
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/

/** The file an amendment for a version lives in. */
export function amendmentFile(version: string): string {
  return `${PAIRING_AMENDMENT_DIRECTORY}/v${version}.json`
}

/** The tag an amendment for a version is published under. */
export function amendmentTag(version: string): string {
  return `${PAIRING_AMENDMENT_TAG_PREFIX}v${version}`
}

/**
 * Who approved the amendment, and how a reader re-checks it.
 *
 * Every field is read back from GitHub by the verifier; the amendment's copy
 * exists so a reader without API access can see what is being claimed, not so a
 * script can assert it. `repository` and `pullRequest` are the lookup key; the
 * other four are compared against what the API returns and a disagreement is a
 * refusal.
 */
export interface PairingAuthorization {
  readonly repository: string
  readonly pullRequest: number
  /** The login whose approving review is required. */
  readonly approver: string
  /** The review id, so "some review said approve" cannot substitute. */
  readonly reviewId: number
  /** The PR head the approval was submitted against. */
  readonly approvedCommit: string
  /** When GitHub recorded the approval. Never the writer's clock. */
  readonly approvedAt: string
}

/** Digests of the evidence the replacement was accepted on. */
export interface PairingEvidence {
  /** sha256 of the bundle file as committed in Core. */
  readonly bundleSha256: string
  /** Where the bundle lives, relative to the Core repository root. */
  readonly bundlePath: string
  /** Per report, the digest the bundle records. */
  readonly reports: Readonly<Record<EvidenceReportId, string>>
}

export interface PairingAmendment {
  readonly schema: typeof PAIRING_AMENDMENT_SCHEMA
  readonly releaseTag: string
  readonly coreVersion: string
  readonly coreCommit: string
  readonly uiVersion: string
  /** What the immutable tag's own record says. */
  readonly originalPairing: {
    readonly uiCommit: string
    /** sha256 of the record file as it sits in the tagged tree. */
    readonly recordSha256: string
  }
  /** The UI candidate that will actually ship. */
  readonly replacement: {
    readonly uiCommit: string
    /** The replacement commit's root tree object. */
    readonly uiTree: string
    /** sha256 of the replacement's `pnpm-lock.yaml`, always present. */
    readonly lockfileSha256: string
  }
  readonly authorization: PairingAuthorization
  readonly evidence: PairingEvidence
  readonly reason: string
  readonly verifiedAt: string
}

export interface AmendmentProblem {
  readonly file: string
  readonly message: string
}

/** What the caller has already established independently of the file. */
export interface AmendmentExpectation {
  readonly version: string
  /** The commit `v<version>` resolves to on the remote. */
  readonly coreTagCommit?: string
  /** The UI commit the release is about to publish from. */
  readonly uiCommit?: string
}

/**
 * What a lookup for an amendment found.
 *
 * Four states, not two. The distinction between "no amendment exists" and "the
 * lookup could not be made" is the difference between refusing a release for
 * the right reason and refusing it for no reason — and, worse, between a
 * network blip and a valid direct pair. v1 collapsed them into `undefined`.
 */
export type AmendmentLookup =
  | { readonly state: 'ABSENT' }
  | { readonly state: 'PRESENT_VALID'; readonly amendment: PairingAmendment }
  | { readonly state: 'PRESENT_INVALID'; readonly errors: readonly string[] }
  | { readonly state: 'LOOKUP_FAILED'; readonly errors: readonly string[] }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireSha(
  value: unknown,
  field: string,
  push: (message: string) => void,
): void {
  if (typeof value !== 'string' || !FULL_SHA.test(value)) {
    push(`${field} must be a full 40-character SHA, not a branch or tag`)
  }
}

function requireSha256(
  value: unknown,
  field: string,
  push: (message: string) => void,
): void {
  if (typeof value !== 'string' || !SHA256.test(value)) {
    push(`${field} must be a sha256 hex digest`)
  }
}

/**
 * Validates one amendment against facts the caller established elsewhere.
 *
 * Structural only: it cannot know whether the replacement was really verified
 * or whether the authorization is real. Those are checked by the callers that
 * can ask GitHub and the registry — this function's job is to refuse anything
 * internally inconsistent, so a caller that checks three things is not handed a
 * file whose other ten fields are wrong.
 */
export function validatePairingAmendment(
  value: unknown,
  file: string,
  expected: AmendmentExpectation,
): AmendmentProblem[] {
  const problems: AmendmentProblem[] = []
  const push = (message: string): void => {
    problems.push({ file, message })
  }

  if (!isRecord(value)) {
    push('not a JSON object')
    return problems
  }

  if (value.schema !== PAIRING_AMENDMENT_SCHEMA) {
    push(`schema must be ${PAIRING_AMENDMENT_SCHEMA}`)
  }

  const expectedFile = amendmentFile(expected.version)
  if (path.basename(file) !== path.basename(expectedFile)) {
    push(
      `file name must be ${path.basename(expectedFile)} so the release finds it by version`,
    )
  }

  if (value.releaseTag !== `v${expected.version}`) {
    push(
      `releaseTag ${String(value.releaseTag)} does not name this release (v${expected.version})`,
    )
  }

  for (const field of ['coreVersion', 'uiVersion'] as const) {
    const raw = value[field]
    if (typeof raw !== 'string' || !SEMVER.test(raw)) {
      push(`${field} must be a version this policy releases`)
    } else if (raw !== expected.version) {
      push(
        `${field} ${raw} does not equal the release version ${expected.version}`,
      )
    }
  }

  requireSha(value.coreCommit, 'coreCommit', push)

  /*
   * The amendment must describe the release that actually exists. A mismatch
   * here is the one that matters most: it would attach a fresh UI candidate to
   * a Core release that was never published.
   */
  if (
    expected.coreTagCommit !== undefined &&
    typeof value.coreCommit === 'string' &&
    value.coreCommit.toLowerCase() !== expected.coreTagCommit.toLowerCase()
  ) {
    push(
      `coreCommit ${value.coreCommit} is not the commit v${expected.version} resolves to (${expected.coreTagCommit})`,
    )
  }

  const original = value.originalPairing
  if (!isRecord(original)) {
    push('originalPairing must be an object')
  } else {
    requireSha(original.uiCommit, 'originalPairing.uiCommit', push)
    requireSha256(original.recordSha256, 'originalPairing.recordSha256', push)
  }

  const replacement = value.replacement
  if (!isRecord(replacement)) {
    push('replacement must be an object')
  } else {
    requireSha(replacement.uiCommit, 'replacement.uiCommit', push)
    requireSha(replacement.uiTree, 'replacement.uiTree', push)
    /*
     * Required, and required by the validator rather than tolerated as
     * optional by the reader. v1's reader skipped the comparison when the
     * digest was absent, so an amendment with no lockfile digest — or a
     * candidate whose lockfile could not be fetched — was accepted on the tree
     * alone. That is the fail-open this field exists to close: a UI tree whose
     * lockfile resolves a different Core is a different candidate.
     */
    requireSha256(
      replacement.lockfileSha256,
      'replacement.lockfileSha256',
      push,
    )

    /*
     * A replacement that equals the original is not an amendment; it is a
     * direct pair wearing a different name, and accepting it would let the
     * weaker path be used where the stronger one applies.
     */
    if (
      isRecord(original) &&
      typeof original.uiCommit === 'string' &&
      typeof replacement.uiCommit === 'string' &&
      original.uiCommit.toLowerCase() === replacement.uiCommit.toLowerCase()
    ) {
      push(
        'replacement.uiCommit equals originalPairing.uiCommit; this is a direct pair, not an amendment',
      )
    }

    if (
      expected.uiCommit !== undefined &&
      typeof replacement.uiCommit === 'string' &&
      replacement.uiCommit.toLowerCase() !== expected.uiCommit.toLowerCase()
    ) {
      push(
        `replacement.uiCommit ${replacement.uiCommit} is not the commit being released (${expected.uiCommit})`,
      )
    }
  }

  const authorization = value.authorization
  if (!isRecord(authorization)) {
    push('authorization must be an object')
  } else {
    /*
     * A pull request a reader can open, and the specific approving review that
     * authorises this amendment. `decisionReference` used to be any non-empty
     * string; "see #419" is not an approval of the bytes being read, and the
     * implementation PRs #419/#171 approve a protocol, not a candidate.
     */
    if (
      typeof authorization.repository !== 'string' ||
      !/^[\w.-]+\/[\w.-]+$/.test(authorization.repository)
    ) {
      push('authorization.repository must name the repository holding the PR')
    }
    if (
      typeof authorization.pullRequest !== 'number' ||
      !Number.isInteger(authorization.pullRequest) ||
      authorization.pullRequest <= 0
    ) {
      push('authorization.pullRequest must be the merged amendment PR number')
    }
    if (
      typeof authorization.approver !== 'string' ||
      authorization.approver.trim().length === 0
    ) {
      push('authorization.approver must name the maintainer who approved it')
    }
    if (
      typeof authorization.reviewId !== 'number' ||
      !Number.isInteger(authorization.reviewId) ||
      authorization.reviewId <= 0
    ) {
      push('authorization.reviewId must name the approving review')
    }
    requireSha(
      authorization.approvedCommit,
      'authorization.approvedCommit',
      push,
    )
    if (
      typeof authorization.approvedAt !== 'string' ||
      !ISO_UTC.test(authorization.approvedAt)
    ) {
      push('authorization.approvedAt must be an ISO-8601 UTC timestamp')
    }
  }

  const evidence = value.evidence
  if (!isRecord(evidence)) {
    push('evidence must be an object')
  } else {
    requireSha256(evidence.bundleSha256, 'evidence.bundleSha256', push)
    if (
      typeof evidence.bundlePath !== 'string' ||
      evidence.bundlePath !== evidenceBundleFile(expected.version)
    ) {
      push(
        `evidence.bundlePath must be ${evidenceBundleFile(expected.version)} so the reader finds it by version`,
      )
    }
    const reports = evidence.reports
    if (!isRecord(reports)) {
      push('evidence.reports must carry a digest per report')
    } else {
      for (const id of EVIDENCE_REPORT_IDS) {
        requireSha256(reports[id], `evidence.reports.${id}`, push)
      }
      for (const id of Object.keys(reports)) {
        if (!EVIDENCE_REPORT_IDS.includes(id as EvidenceReportId)) {
          push(`evidence.reports.${id} is not one of the five required reports`)
        }
      }
    }
  }

  if (typeof value.reason !== 'string' || value.reason.trim().length === 0) {
    push('reason must say why the original candidate is not the one shipping')
  }

  if (typeof value.verifiedAt !== 'string' || !ISO_UTC.test(value.verifiedAt)) {
    push('verifiedAt must be an ISO-8601 UTC timestamp')
  }

  return problems
}

/**
 * Cross-checks an amendment against the evidence bundle it names.
 *
 * The amendment pins the bundle's digest; the bundle pins each report's
 * digest. This is where the two are compared, so a bundle swapped after the
 * amendment was approved — or an amendment written against a bundle that was
 * never committed — fails here rather than at the publish step.
 */
export function verifyAmendmentEvidence(
  amendment: PairingAmendment,
  bundleRaw: string,
  bundlePath: string,
  expected: EvidenceExpectation,
): AmendmentProblem[] {
  const problems: AmendmentProblem[] = []
  const push = (message: string): void => {
    problems.push({ file: bundlePath, message })
  }

  const digest = evidenceSha256(bundleRaw)
  if (
    typeof amendment.evidence?.bundleSha256 === 'string' &&
    amendment.evidence.bundleSha256.toLowerCase() !== digest
  ) {
    push(
      `amendment records evidence.bundleSha256 ${amendment.evidence.bundleSha256}, but ${bundlePath} hashes to ${digest}`,
    )
  }

  if (
    typeof amendment.evidence?.bundlePath === 'string' &&
    amendment.evidence.bundlePath !== bundlePath
  ) {
    push(
      `amendment names ${amendment.evidence.bundlePath}, but the bundle read is ${bundlePath}`,
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(bundleRaw)
  } catch {
    push('the bundle is not valid JSON')
    return problems
  }

  problems.push(...verifyEvidenceBundle(parsed, bundlePath, expected))

  const bundle = parsed as ReleaseEvidenceBundle
  for (const report of bundle.reports ?? []) {
    const recorded = amendment.evidence?.reports?.[report.id]
    if (
      typeof recorded === 'string' &&
      typeof report.sha256 === 'string' &&
      recorded.toLowerCase() !== report.sha256.toLowerCase()
    ) {
      push(
        `amendment records ${report.id} as ${recorded}, but the bundle records ${report.sha256}`,
      )
    }
  }

  return problems
}

/** The sha256 of a file's bytes, which is how records are pinned. */
export function fileSha256(absolutePath: string): string {
  return createHash('sha256')
    .update(fs.readFileSync(absolutePath))
    .digest('hex')
}

/** Reads a JSON document, returning undefined when it is absent or invalid. */
export function readAmendment(file: string): PairingAmendment | undefined {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as PairingAmendment
  } catch {
    return undefined
  }
}

/**
 * Whether an amendment already exists for this version.
 *
 * Two conflicting amendments for one version are the failure the design
 * forbids: an auditor would have no way to tell which pair shipped.
 */
export function findExistingAmendment(
  root: string,
  version: string,
): PairingAmendment | undefined {
  return readAmendment(path.join(root, amendmentFile(version)))
}

/**
 * The result of resolving a tag on a remote.
 *
 * Three states rather than `string | undefined`, because "the tag is not
 * there" and "the API did not answer" lead to different decisions: the first
 * means this release is not amended, the second means nobody knows.
 */
export type TagLookup =
  | { readonly state: 'FOUND'; readonly commit: string }
  | { readonly state: 'ABSENT' }
  | { readonly state: 'ERROR'; readonly message: string }

/** Resolves `refs/tags/<tag>` on the remote, peeling annotated tags. */
export function resolveRemoteTag(
  repository: string,
  tag: string,
  gh: (args: readonly string[]) => string = args =>
    execFileSync('gh', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30_000,
    }) as string,
): TagLookup {
  let ref: { object?: { type?: string; sha?: string } }
  try {
    ref = JSON.parse(
      gh(['api', `repos/${repository}/git/ref/tags/${tag}`]),
    ) as { object?: { type?: string; sha?: string } }
  } catch (error) {
    /*
     * A 404 is the registry saying the tag does not exist, which is a real
     * finding. Anything else — rate limit, token, DNS — is the API not
     * answering, and must never be read as "no amendment".
     */
    const message = error instanceof Error ? error.message : String(error)
    const notFound = /HTTP 404|Not Found/i.test(message)
    return notFound
      ? { state: 'ABSENT' }
      : { state: 'ERROR', message: `could not resolve ${tag}: ${message}` }
  }

  let commit = ref.object?.sha
  if (ref.object?.type === 'tag') {
    try {
      const peeled = JSON.parse(
        gh(['api', `repos/${repository}/git/tags/${commit}`]),
      ) as { object?: { sha?: string } }
      commit = peeled.object?.sha
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return {
        state: 'ERROR',
        message: `could not peel annotated tag ${tag}: ${message}`,
      }
    }
  }

  return typeof commit === 'string' && FULL_SHA.test(commit)
    ? { state: 'FOUND', commit }
    : { state: 'ERROR', message: `${tag} did not resolve to a commit` }
}

/** Resolves `refs/tags/<tag>` to a commit, or undefined on any failure. */
export function resolveRemoteTagCommit(
  repository: string,
  tag: string,
  gh?: (args: readonly string[]) => string,
): string | undefined {
  const result = resolveRemoteTag(repository, tag, gh)
  return result.state === 'FOUND' ? result.commit : undefined
}
