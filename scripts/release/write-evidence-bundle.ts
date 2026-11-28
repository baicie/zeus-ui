import type {
  EvidenceProducer,
  EvidenceReport,
  EvidenceReportId,
  ReleaseEvidenceBundle,
} from './evidence-bundle'
/**
 * Writes the evidence bundle a pairing amendment is accepted on.
 *
 * ## Why the bundle is a file rather than five digests
 *
 * The amendment needs to show that the replacement candidate was verified —
 * by runs that passed, about this commit, against this Core release. Five hex
 * strings cannot show any of that; they show that the author once had five
 * files. This tool reads the five reports, re-judges each one, records the
 * producer and subject commit, and emits a bundle that carries the bytes.
 *
 * The amendment then pins one digest — the bundle's — and a reader who has the
 * tag has the reports.
 *
 * ## Usage
 *
 * ```text
 * tsx scripts/release/write-evidence-bundle.ts \
 *   --version 0.2.0-rc.8 \
 *   --core-commit <sha> --ui-commit <sha> --ui-tree <sha> --lockfile <path> \
 *   --core-registry-report <path> --ui-candidate-report <path> \
 *   --template-acceptance <path> --browser-acceptance <path> \
 *   --ui-registry-preflight <path> \
 *   [--producer-kind workflow --workflow release.yml --run-id 123 --run-attempt 1] \
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
  EVIDENCE_REPORT_IDS,
  EVIDENCE_REPORT_SCHEMAS,
  evidenceBundleFile,
  evidenceSha256,
  evidenceSourceCommit,
  judgeEvidenceReport,
  RELEASE_EVIDENCE_BUNDLE_SCHEMA,
} from './evidence-bundle'

const CORE_REPOSITORY = 'baicie/zeus'

/** Reads a report and refuses one that is absent rather than inventing a digest. */
function readReport(file: string, flag: string): string {
  if (!fs.existsSync(file)) {
    throw new Error(
      `--${flag} ${file} does not exist; a bundle of absent reports is not evidence`,
    )
  }
  return fs.readFileSync(file, 'utf8')
}

function main(): void {
  const { values } = parseArgs({
    options: {
      version: { type: 'string' },
      'core-commit': { type: 'string' },
      'ui-commit': { type: 'string' },
      'ui-tree': { type: 'string' },
      lockfile: { type: 'string' },
      'core-registry-report': { type: 'string' },
      'ui-candidate-report': { type: 'string' },
      'template-acceptance': { type: 'string' },
      'browser-acceptance': { type: 'string' },
      'ui-registry-preflight': { type: 'string' },
      'producer-kind': { type: 'string', default: 'local' },
      workflow: { type: 'string' },
      'run-id': { type: 'string' },
      'run-attempt': { type: 'string' },
      'head-sha': { type: 'string' },
      command: { type: 'string' },
      out: { type: 'string' },
    },
  })

  const version = values.version
  const coreCommitRaw = values['core-commit']
  const uiCommitRaw = values['ui-commit']
  const uiTreeRaw = values['ui-tree']
  const lockfilePath = values.lockfile

  if (!version) throw new Error('--version is required')
  for (const [name, value] of [
    ['core-commit', coreCommitRaw],
    ['ui-commit', uiCommitRaw],
    ['ui-tree', uiTreeRaw],
  ] as const) {
    if (!value || !/^[0-9a-f]{40}$/i.test(value)) {
      throw new Error(`--${name} must be a full 40-character SHA`)
    }
  }
  /* Narrowed once, so the bundle below cannot be built from a partial value. */
  const coreCommit = coreCommitRaw!.toLowerCase()
  const uiCommit = uiCommitRaw!.toLowerCase()
  const uiTree = uiTreeRaw!.toLowerCase()
  if (!lockfilePath) throw new Error('--lockfile is required')
  const lockfileRaw = readReport(lockfilePath, 'lockfile')
  const lockfileSha256 = createHash('sha256')
    .update(Buffer.from(lockfileRaw, 'utf8'))
    .digest('hex')

  const kind = values['producer-kind']
  if (kind !== 'workflow' && kind !== 'local') {
    throw new Error("--producer-kind must be 'workflow' or 'local'")
  }

  let producer: EvidenceProducer
  if (kind === 'workflow') {
    const runId = Number(values['run-id'])
    if (!Number.isInteger(runId) || runId <= 0) {
      throw new Error('--run-id is required for a workflow producer')
    }
    if (!values.workflow) {
      throw new Error('--workflow is required for a workflow producer')
    }
    if (!values['head-sha'] || !/^[0-9a-f]{40}$/i.test(values['head-sha'])) {
      throw new Error('--head-sha is required for a workflow producer')
    }
    /*
     * The run is looked up rather than believed. A bundle that names a run id
     * which does not exist, or whose head commit is not the one claimed, is
     * claiming CI provenance it does not have — and the whole point of
     * recording the run is that a reader can follow it.
     */
    let run: {
      head_sha?: string
      name?: string
      conclusion?: string
      status?: string
      path?: string
    }
    try {
      run = JSON.parse(
        execFileSync(
          'gh',
          ['api', `repos/${CORE_REPOSITORY}/actions/runs/${runId}`],
          {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
            timeout: 30_000,
          },
        ) as string,
      ) as typeof run
    } catch (error) {
      throw new Error(
        `run ${runId} could not be read from ${CORE_REPOSITORY}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
    if (run.head_sha !== values['head-sha']) {
      throw new Error(
        `run ${runId} checked out ${String(run.head_sha)}, not ${values['head-sha']}`,
      )
    }
    if (run.status !== 'completed' || run.conclusion !== 'success') {
      throw new Error(
        `run ${runId} is ${String(run.status)}/${String(run.conclusion)}; evidence must come from a successful run`,
      )
    }
    producer = {
      kind: 'workflow',
      repository: CORE_REPOSITORY,
      workflow: values.workflow,
      runId,
      ...(values['run-attempt']
        ? { runAttempt: Number(values['run-attempt']) }
        : {}),
      headSha: values['head-sha'],
    }
  } else {
    if (!values.command) {
      throw new Error(
        '--command is required for a local producer: with no run to look up, the command is the only way a reader reproduces the report',
      )
    }
    producer = {
      kind: 'local',
      repository: CORE_REPOSITORY,
      command: values.command,
    }
  }

  const files: Record<EvidenceReportId, string | undefined> = {
    'core-registry-report': values['core-registry-report'],
    'ui-candidate-report': values['ui-candidate-report'],
    'template-acceptance': values['template-acceptance'],
    'browser-acceptance': values['browser-acceptance'],
    'ui-registry-preflight': values['ui-registry-preflight'],
  }

  const expected = {
    coreVersion: version,
    uiVersion: version,
    uiCommit,
  }

  const reports: EvidenceReport[] = []
  for (const id of EVIDENCE_REPORT_IDS) {
    const file = files[id]
    if (!file) throw new Error(`--${id} is required`)
    const content = readReport(file, id)
    const judged = judgeEvidenceReport(id, content, expected)
    if (judged.verdict !== 'PASS') {
      for (const problem of judged.problems)
        console.error(`  ${id}: ${problem}`)
      throw new Error(
        `${id} does not pass; a bundle cannot record a failed report as evidence`,
      )
    }
    reports.push({
      id,
      schema: EVIDENCE_REPORT_SCHEMAS[id],
      sha256: evidenceSha256(content),
      producer,
      sourceCommit: evidenceSourceCommit(id, {
        coreCommit,
        uiCommit,
      }),
      verdict: judged.verdict,
      content,
    })
  }

  const bundle: ReleaseEvidenceBundle = {
    schema: RELEASE_EVIDENCE_BUNDLE_SCHEMA,
    version,
    core: { version, tag: `v${version}`, commit: coreCommit },
    ui: {
      version,
      commit: uiCommit,
      tree: uiTree,
      lockfileSha256,
    },
    reports,
  }

  const out = values.out ?? evidenceBundleFile(version)
  fs.mkdirSync(path.dirname(out), { recursive: true })

  /*
   * A bundle is written once per candidate. Overwriting one with different
   * reports would invalidate the amendment that pinned it — and the amendment
   * is immutable once tagged, so the bundle it points at must be too.
   */
  if (fs.existsSync(out)) {
    const existing = JSON.parse(fs.readFileSync(out, 'utf8')) as {
      ui?: { commit?: string }
    }
    const previous = existing.ui?.commit
    if (typeof previous === 'string' && previous.toLowerCase() !== uiCommit) {
      throw new Error(
        `${out} already records candidate ${previous}; a bundle describes one candidate, so replacing it needs an explicit decision`,
      )
    }
  }

  fs.writeFileSync(out, `${JSON.stringify(bundle, null, 2)}\n`)
  const digest = evidenceSha256(fs.readFileSync(out, 'utf8'))
  console.log(`wrote ${out}`)
  console.log(`bundle sha256 ${digest}`)
  /*
   * The digest is over the exact bytes on disk. Printing it here is safe (the
   * file was just written and nothing else has touched it), and the amendment
   * writer recomputes it anyway.
   */
  const relative = path.relative(process.cwd(), out)
  if (!relative.startsWith('..')) console.log(`bundle path ${relative}`)
}

main()
