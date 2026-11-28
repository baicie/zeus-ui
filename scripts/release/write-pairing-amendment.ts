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
 * - each evidence digest is the sha256 of a file that exists.
 *
 * It also refuses to overwrite an existing amendment with a different
 * replacement: a version pairs once, and two amendments for one release leave
 * an auditor with no way to tell which pair shipped.
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
 *   --decision-reference <pr-or-issue> \
 *   [--out <path>]
 * ```
 */
import { Buffer } from 'node:buffer'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'

import {
  amendmentFile,
  PAIRING_AMENDMENT_SCHEMA,
  validatePairingAmendment,
} from './pairing-amendment'

const CORE_REPOSITORY = 'baicie/zeus'

function gh(args: string[]): string {
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

/**
 * The sha256 of a local evidence file.
 *
 * Evidence is produced by the runs that verified the replacement, and the
 * amendment pins their digests so a later reader can tell whether the file they
 * hold is the one that was accepted.
 */
function evidenceDigest(file: string, flag: string): string {
  if (!fs.existsSync(file)) {
    throw new Error(
      `--${flag} ${file} does not exist; a digest of nothing is not evidence`,
    )
  }
  return sha256(fs.readFileSync(file, 'utf8'))
}

function main(): void {
  const { values } = parseArgs({
    options: {
      version: { type: 'string' },
      'ui-commit': { type: 'string' },
      'ui-repository': { type: 'string', default: 'baicie/zeus-ui' },
      'decision-reference': { type: 'string' },
      reason: { type: 'string' },
      'core-registry-report': { type: 'string' },
      'ui-candidate-report': { type: 'string' },
      'template-acceptance': { type: 'string' },
      'browser-acceptance': { type: 'string' },
      'ui-registry-preflight': { type: 'string' },
      out: { type: 'string' },
    },
  })

  const version = values.version
  const uiCommit = values['ui-commit']
  const uiRepository = values['ui-repository']!
  const decision = values['decision-reference']

  if (!version) throw new Error('--version is required')
  if (!uiCommit || !/^[0-9a-f]{40}$/i.test(uiCommit)) {
    throw new Error('--ui-commit must be a full 40-character SHA')
  }
  if (!decision) {
    throw new Error(
      '--decision-reference is required: the amendment must name a review a reader can open',
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
      decisionReference: decision,
      approvedAt: new Date().toISOString(),
    },
    evidence: {
      coreRegistryReportSha256: evidenceDigest(
        values['core-registry-report'] ?? '',
        'core-registry-report',
      ),
      uiCandidateReportSha256: evidenceDigest(
        values['ui-candidate-report'] ?? '',
        'ui-candidate-report',
      ),
      templateAcceptanceSha256: evidenceDigest(
        values['template-acceptance'] ?? '',
        'template-acceptance',
      ),
      browserAcceptanceSha256: evidenceDigest(
        values['browser-acceptance'] ?? '',
        'browser-acceptance',
      ),
      uiRegistryPreflightSha256: evidenceDigest(
        values['ui-registry-preflight'] ?? '',
        'ui-registry-preflight',
      ),
    },
    reason:
      values.reason ??
      `The candidate named by ${recordPath} was never published, and ${uiCommit} is the tree that will ship.`,
    verifiedAt: new Date().toISOString(),
  }

  const problems = validatePairingAmendment(amendment, amendmentFile(version), {
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

  const out = values.out ?? amendmentFile(version)
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
