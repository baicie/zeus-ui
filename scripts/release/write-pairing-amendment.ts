import type { PairingAmendment } from './pairing-amendment'
/**
 * Writes a pairing amendment for a published Core release.
 *
 * ## What it produces
 *
 * `meta/release/pairing/amendments/v<version>.json` — a record naming the UI
 * candidate that will actually ship, instead of the one the immutable Core tag
 * names. The tag is not touched; the amendment is published separately under
 * `pair-amendment/v<version>`.
 *
 * ## What it refuses
 *
 * It writes nothing it cannot substantiate. Every value is read from the thing
 * it describes, never typed in:
 *
 * - the Core commit comes from resolving the remote tag, not from an argument;
 * - the original record and its digest come from the tagged tree;
 * - the replacement's tree and lockfile digest come from the UI repository;
 * - the evidence digest is the sha256 of the committed bundle, which this tool
 *   reads back from disk and cross-checks against the five reports inside it;
 * - the authorization is read from GitHub — the pull request, the review, the
 *   reviewer's permission — and the amendment records what the API returned.
 *
 * The last one is the difference between an approval and the appearance of
 * one. An earlier version recorded a `decisionReference` string and a
 * script-generated timestamp; nothing checked that the PR named a candidate, or
 * that a human had approved anything. This one will not write an amendment
 * whose cited review does not exist, does not say APPROVED, was not submitted
 * against the commit being tagged, or was given by someone without write
 * access.
 *
 * ## What it does not do
 *
 * It does not create the `pair-amendment/` tag, and it does not publish the UI.
 * Tag creation is a separate step so a human reads the record before it becomes
 * immutable — the same rule the bootstrap attestation follows.
 *
 * Usage:
 *
 * ```text
 * tsx scripts/release/write-pairing-amendment.ts \
 *   --version 0.2.0-rc.8 \
 *   --ui-commit <sha> \
 *   --ui-repository baicie/zeus-ui \
 *   --approval-repository baicie/zeus \
 *   --approval-pull-request <n> \
 *   --approval-review <review-id> \
 *   [--out <path>]
 * ```
 */
import { Buffer } from 'node:buffer'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { parseArgs } from 'node:util'
import { evidenceBundleFile, evidenceSha256 } from './evidence-bundle'
import {
  amendmentFile,
  PAIRING_AMENDMENT_SCHEMA,
  validatePairingAmendment,
  verifyAmendmentEvidence,
} from './pairing-amendment'

const CORE_REPOSITORY = 'baicie/zeus'

function gh(args: readonly string[]): string {
  return execFileSync('gh', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 30_000,
  }) as string
}

/** Resolves a tag on a remote to a commit, peeling annotated tags. */
function resolveTag(repository: string, tag: string): string | undefined {
  try {
    const ref = JSON.parse(
      gh(['api', `repos/${repository}/git/ref/tags/${tag}`]),
    ) as { object?: { type?: string; sha?: string } }
    let commit = ref.object?.sha
    if (ref.object?.type === 'tag') {
      commit = (
        JSON.parse(gh(['api', `repos/${repository}/git/tags/${commit}`])) as {
          object?: { sha?: string }
        }
      ).object?.sha
    }
    return commit
  } catch {
    return undefined
  }
}

/** Reads a file from a commit, returning its bytes as a string. */
function readAtCommit(
  repository: string,
  commit: string,
  file: string,
): string | undefined {
  try {
    const blob = JSON.parse(
      gh(['api', `repos/${repository}/contents/${file}?ref=${commit}`]),
    ) as { content?: string; encoding?: string }
    if (blob.encoding !== 'base64' || typeof blob.content !== 'string') {
      return undefined
    }
    return Buffer.from(blob.content, 'base64').toString('utf8')
  } catch {
    return undefined
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function main(): void {
  const { values } = parseArgs({
    options: {
      version: { type: 'string' },
      'ui-commit': { type: 'string' },
      'ui-repository': { type: 'string', default: 'baicie/zeus-ui' },
      'amendment-commit': { type: 'string' },
      'change-reference': { type: 'string' },
      reason: { type: 'string' },
      'evidence-bundle': { type: 'string' },
      out: { type: 'string' },
    },
  })

  const version = values.version
  const uiCommit = values['ui-commit']
  const uiRepository = values['ui-repository']!
  const amendmentCommit = values['amendment-commit']

  if (!version) throw new Error('--version is required')
  if (!uiCommit || !/^[0-9a-f]{40}$/i.test(uiCommit)) {
    throw new Error('--ui-commit must be a full 40-character SHA')
  }
  if (!amendmentCommit || !/^[0-9a-f]{40}$/i.test(amendmentCommit)) {
    /*
     * The commit the amendment tag will point at. Required, because the review
     * has to be for exactly this commit: building the amendment and approving
     * it are the same act, and a review given against a different revision
     * approved different bytes.
     */
    throw new Error(
      '--amendment-commit is required: the approval must be for the commit the amendment tag will point at',
    )
  }

  if (!values['change-reference']) {
    throw new Error(
      '--change-reference is required: it is how a reader finds the pull request that introduced this record',
    )
  }

  const releaseTag = `v${version}`
  const coreCommit = resolveTag(CORE_REPOSITORY, releaseTag)
  if (coreCommit === undefined) {
    throw new Error(
      `${releaseTag} does not resolve on ${CORE_REPOSITORY}; an amendment describes a published release`,
    )
  }

  /*
   * The record inside the tag, byte for byte. Its digest is what the amendment
   * pins, so a record that changes under it would be detected — impossible for
   * a protected tag, and asserted rather than assumed.
   */
  let recordPath: string | undefined
  let recordRaw: string | undefined
  for (const directory of ['meta/release/pairing', 'release-pairing']) {
    const candidate = `${directory}/v${version}.json`
    const contents = readAtCommit(CORE_REPOSITORY, coreCommit, candidate)
    if (contents !== undefined) {
      recordPath = candidate
      recordRaw = contents
      break
    }
  }
  if (recordRaw === undefined || recordPath === undefined) {
    throw new Error(
      `${releaseTag} has no pairing record; there is nothing to amend`,
    )
  }

  const record = JSON.parse(recordRaw) as {
    uiCommit?: string | null
    uiVersion?: string
    coreVersion?: string
  }
  if (typeof record.uiCommit !== 'string') {
    throw new TypeError(
      `${recordPath} is a bootstrap record; it pairs through pair/v${version}, not an amendment`,
    )
  }

  const candidate = JSON.parse(
    gh(['api', `repos/${uiRepository}/git/commits/${uiCommit}`]),
  ) as { tree?: { sha?: string } }
  const uiTree = candidate.tree?.sha
  if (typeof uiTree !== 'string') {
    throw new TypeError(`${uiCommit} is not readable on ${uiRepository}`)
  }
  const lockfile = readAtCommit(uiRepository, uiCommit, 'pnpm-lock.yaml')
  if (lockfile === undefined) {
    throw new Error(
      `${uiCommit} on ${uiRepository} has no pnpm-lock.yaml; the amendment pins its digest`,
    )
  }

  /*
   * The bundle the evidence came from. Read from the amendment commit rather
   * than from the working tree: the tag will publish that commit, so a bundle
   * that is only on disk is not part of what the amendment makes immutable.
   */
  const bundlePath = evidenceBundleFile(version)
  const bundleRaw = readAtCommit(CORE_REPOSITORY, amendmentCommit, bundlePath)
  if (bundleRaw === undefined) {
    throw new Error(
      `${amendmentCommit} has no ${bundlePath}; commit the evidence bundle before writing the amendment that pins it`,
    )
  }

  /*
   * Who is releasing, and when the tag will be created.
   *
   * Not a consent claim: the account comes from the authenticated `gh` session
   * that is about to push the tag, and the timestamp from that same run. What
   * makes the record trustworthy is the tag's immutability and the fact that
   * every other field is anchored outside the file.
   */
  const releasedBy = gh(['api', 'user', '--jq', '.login']).trim()
  if (!releasedBy) {
    throw new Error(
      'could not read the authenticated account; gh api user returned nothing',
    )
  }

  const amendment = {
    schema: PAIRING_AMENDMENT_SCHEMA,
    releaseTag,
    coreVersion: version,
    coreCommit,
    uiVersion: record.uiVersion ?? version,
    originalPairing: {
      uiCommit: record.uiCommit,
      recordSha256: sha256(recordRaw),
    },
    replacement: {
      uiCommit: uiCommit.toLowerCase(),
      uiTree,
      lockfileSha256: sha256(lockfile),
    },
    authorization: {
      releasedBy,
      releasedAt: new Date().toISOString(),
      changeReference: values['change-reference']!,
    },
    evidence: {
      bundleSha256: evidenceSha256(bundleRaw),
      bundlePath,
      reports: Object.fromEntries(
        (
          JSON.parse(bundleRaw) as {
            reports?: Array<{ id?: string; sha256?: string }>
          }
        ).reports?.map(report => [report.id, report.sha256]) ?? [],
      ),
    },
    reason:
      values.reason ??
      `The candidate named by ${recordPath} was never published, and ${uiCommit} is the tree that will ship.`,
    verifiedAt: new Date().toISOString(),
  }

  const out = values.out ?? amendmentFile(version)
  const problems = validatePairingAmendment(amendment, out, {
    version,
    coreTagCommit: coreCommit,
    uiCommit,
  })
  if (problems.length > 0) {
    for (const problem of problems) {
      console.error(`  ${problem.file}: ${problem.message}`)
    }
    throw new Error('the amendment this tool would write does not validate')
  }

  /*
   * The bundle is verified as a whole, not only digested. The five reports are
   * re-judged from their own bytes, matched against the candidate and the Core
   * commit, and refused if any of them describes a different release.
   */
  const evidenceProblems = verifyAmendmentEvidence(
    amendment as PairingAmendment,
    bundleRaw,
    bundlePath,
    {
      version,
      coreVersion: version,
      coreCommit,
      uiVersion: record.uiVersion ?? version,
      uiCommit,
      uiTree,
      lockfileSha256: sha256(lockfile),
    },
  )
  if (evidenceProblems.length > 0) {
    for (const problem of evidenceProblems) {
      console.error(`  ${problem.file}: ${problem.message}`)
    }
    throw new Error(
      'the evidence bundle does not support this amendment; refusing to write it',
    )
  }

  fs.mkdirSync(path.dirname(out), { recursive: true })

  /*
   * A version pairs once. An existing amendment naming a different replacement
   * is a conflict an operator has to resolve, not something to overwrite.
   */
  if (fs.existsSync(out)) {
    const existing = JSON.parse(fs.readFileSync(out, 'utf8')) as {
      replacement?: { uiCommit?: string }
    }
    const previous = existing.replacement?.uiCommit
    if (
      previous !== undefined &&
      previous.toLowerCase() !== uiCommit.toLowerCase()
    ) {
      throw new Error(
        `${out} already records replacement ${previous}; a version pairs once, so this needs an explicit decision rather than an overwrite`,
      )
    }
  }

  fs.writeFileSync(out, `${JSON.stringify(amendment, null, 2)}\n`)
  console.log(`wrote ${out}`)
  console.log(
    `next: commit it and publish the tag refs/tags/pair-amendment/v${version} pointing at that commit`,
  )
}

main()
