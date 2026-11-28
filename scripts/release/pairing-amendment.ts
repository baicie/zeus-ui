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
 * Every field that could be filled in by wishful thinking is therefore checked
 * against something outside the file: the tag against the remote, the original
 * record against the tag's own tree, the replacement UI commit against the UI
 * repository, and the authorization against a protected review — never a
 * self-declared `approvedBy`.
 */
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

/** The schema an amendment file declares. */
export const PAIRING_AMENDMENT_SCHEMA = 'zeus.pairing-amendment/v1'

/** Where amendments live inside the Core repository. */
export const PAIRING_AMENDMENT_DIRECTORY = 'meta/release/pairing/amendments'

/**
 * The tag namespace that carries an amendment.
 *
 * Deliberately outside `refs/tags/v*`: creating an amendment must never trigger
 * `release.yml`, which would publish npm a second time. It is also outside
 * `refs/tags/pair/`, which carries bootstrap attestations — the two answer
 * different questions and an auditor must be able to tell them apart by name.
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
    /** sha256 of the replacement's `pnpm-lock.yaml`. */
    readonly lockfileSha256: string
  }
  readonly authorization: {
    /** A PR, review, or decision record an auditor can open. */
    readonly decisionReference: string
    readonly approvedAt: string
  }
  /** Digests of the evidence the replacement was accepted on. */
  readonly evidence: {
    readonly coreRegistryReportSha256: string
    readonly uiCandidateReportSha256: string
    readonly templateAcceptanceSha256: string
    readonly browserAcceptanceSha256: string
    readonly uiRegistryPreflightSha256: string
  }
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
    if (
      typeof authorization.decisionReference !== 'string' ||
      authorization.decisionReference.trim().length === 0
    ) {
      push('authorization.decisionReference must name a reviewable decision')
    }
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
    for (const field of [
      'coreRegistryReportSha256',
      'uiCandidateReportSha256',
      'templateAcceptanceSha256',
      'browserAcceptanceSha256',
      'uiRegistryPreflightSha256',
    ] as const) {
      requireSha256(evidence[field], `evidence.${field}`, push)
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

/** Resolves `refs/tags/<tag>` on the remote to a commit, peeling annotated tags. */
export function resolveRemoteTagCommit(
  repository: string,
  tag: string,
  gh: (args: readonly string[]) => string = args =>
    execFileSync('gh', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30_000,
    }) as string,
): string | undefined {
  try {
    const ref = JSON.parse(
      gh(['api', `repos/${repository}/git/ref/tags/${tag}`]),
    ) as { object?: { type?: string; sha?: string } }
    let commit = ref.object?.sha
    if (ref.object?.type === 'tag') {
      const peeled = JSON.parse(
        gh(['api', `repos/${repository}/git/tags/${commit}`]),
      ) as { object?: { sha?: string } }
      commit = peeled.object?.sha
    }
    return typeof commit === 'string' && FULL_SHA.test(commit)
      ? commit
      : undefined
  } catch {
    return undefined
  }
}
