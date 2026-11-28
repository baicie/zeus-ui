/**
 * The evidence a pairing amendment is allowed to lean on.
 *
 * ## Why a bundle rather than five digests
 *
 * The first version of the amendment pinned five sha256 strings and nothing
 * else. A digest of a file nobody can produce is a claim, not evidence: it
 * proves the writer once held some bytes, never that those bytes came from a
 * run that verified this candidate, never that the run passed, and never that
 * the file described the same commits. Anyone able to write the amendment
 * could also write five plausible hex strings.
 *
 * So the reports travel with the record. Each one carries who produced it
 * (repository, workflow, run id, head commit), which commit it is about, the
 * verdict it reached, and its own bytes. The amendment pins the bundle's
 * digest, and the bundle carries the reports — so a reader holds the exact
 * documents, not a promise that they existed.
 *
 * ## What is deliberately still not here
 *
 * There is no evidence service, no index, and no signing infrastructure. The
 * bundle is a committed JSON file produced by a command that also runs in CI;
 * a reader with `gh` and a checkout can reproduce every check. Building a
 * platform for five JSON files would be a bigger system than the thing it
 * guards.
 */
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'

const FULL_SHA = /^[0-9a-f]{40}$/i
const SHA256 = /^[0-9a-f]{64}$/i

/** The schema a bundle declares. */
export const RELEASE_EVIDENCE_BUNDLE_SCHEMA = 'zeus.release-evidence-bundle/v1'

/** Where bundles live inside the Core repository. */
export const EVIDENCE_BUNDLE_DIRECTORY = 'meta/release/evidence'

/** The file a bundle for a version lives in. */
export function evidenceBundleFile(version: string): string {
  return `${EVIDENCE_BUNDLE_DIRECTORY}/v${version}/bundle.json`
}

/**
 * The report schema each evidence slot must carry.
 *
 * Pinned here rather than trusted from the bundle: a bundle that declared its
 * own idea of what a registry report looks like could satisfy every check by
 * describing a different document.
 */
export const EVIDENCE_REPORT_SCHEMAS = {
  'core-registry-report': 'zeus.core-registry-verification/v1',
  'ui-candidate-report': 'zeus.create-zeus-candidate/v2',
  'template-acceptance': 'zeus.template-acceptance/v1',
  'browser-acceptance': 'zeus.browser-acceptance/v1',
  'ui-registry-preflight': 'zeus-ui.publish-preflight/v1',
} as const

export type EvidenceReportId = keyof typeof EVIDENCE_REPORT_SCHEMAS

/** Every report a complete bundle must carry, in a stable order. */
export const EVIDENCE_REPORT_IDS = [
  'core-registry-report',
  'ui-candidate-report',
  'template-acceptance',
  'browser-acceptance',
  'ui-registry-preflight',
] as const satisfies readonly EvidenceReportId[]

/**
 * Who produced a report.
 *
 * `workflow` says a GitHub Actions run did it, and the run id is checkable
 * against the API. `local` is honest about the other case rather than dressing
 * a laptop run as CI: the command is recorded so the reader can rerun it, and
 * the reader can see that no run exists to corroborate it. A `local` producer
 * is therefore never accepted on its own authority — the amendment's
 * maintainer approval is what a reviewer gives against these exact bytes.
 */
export interface EvidenceProducer {
  readonly kind: 'workflow' | 'local'
  readonly repository: string
  readonly workflow?: string
  readonly runId?: number
  readonly runAttempt?: number
  /** The commit the producing run checked out. */
  readonly headSha?: string
  /** The command, so a reader can reproduce a `local` report. */
  readonly command?: string
}

/** One report, with the bytes it was judged on. */
export interface EvidenceReport {
  readonly id: EvidenceReportId
  readonly schema: string
  /** sha256 over `content` as UTF-8 bytes. */
  readonly sha256: string
  readonly producer: EvidenceProducer
  /** The commit this report is evidence about. */
  readonly sourceCommit: string
  readonly verdict: 'PASS' | 'FAIL'
  /** The report exactly as produced. */
  readonly content: string
}

/** The bundle a release is accepted on. */
export interface ReleaseEvidenceBundle {
  readonly schema: typeof RELEASE_EVIDENCE_BUNDLE_SCHEMA
  readonly version: string
  readonly core: {
    readonly version: string
    readonly tag: string
    readonly commit: string
  }
  readonly ui: {
    readonly version: string
    readonly commit: string
    readonly tree: string
    readonly lockfileSha256: string
  }
  readonly reports: readonly EvidenceReport[]
}

export interface EvidenceProblem {
  readonly file: string
  readonly message: string
}

/** What the caller already established independently of the bundle. */
/**
 * What a complete acceptance covers, as a controlled contract.
 *
 * ## Why the expected set is an input, not a number in the report
 *
 * The first version of these checks compared a report's counts against each
 * other: `passed === templates`, `passed === probes`. That is arithmetic the
 * report does on itself, and it holds just as well for a run that covered one
 * template as for one that covered six. "6 of 6" and "1 of 1" are the same
 * statement to a reader who does not know how many exist.
 *
 * The expected set therefore comes from the contract — the candidate matrix,
 * the package inventory — and the report is required to match it exactly:
 * nothing missing, nothing duplicated, nothing invented.
 */
export interface AcceptanceCoverage {
  /** Every template the release is contracted to verify. */
  readonly templates?: readonly string[]
  /** Templates that ship no page, so no browser probe exists for them. */
  readonly templatesWithoutProbe?: readonly string[]
  /** Every @zeus-web package the release publishes. */
  readonly packages?: readonly string[]
}

export interface EvidenceExpectation {
  readonly version: string
  readonly coreVersion: string
  readonly coreCommit: string
  readonly uiVersion: string
  readonly uiCommit: string
  readonly uiTree: string
  readonly lockfileSha256: string
  /**
   * Where the Core artifacts came from.
   *
   * `registry` is the artifact users install; `workspace` is a build of the
   * same tree; `candidate` is a tarball. They are not interchangeable —
   * rc.8's joint acceptance ran against a workspace build of the release tree,
   * which is a weaker claim than the published artifact and says so.
   */
  readonly coreSource?: 'registry' | 'workspace' | 'candidate' | 'unknown'
  readonly coverage?: AcceptanceCoverage
}

/**
 * Compares the identifiers a report covered with the ones the contract expects.
 *
 * All four failure modes matter and none is visible from a count:
 *
 * - **missing** — a template or package the release promised to verify and did
 *   not. This is the one a `passed === templates` check lets through, because
 *   dropping the template from the report also drops it from the count.
 * - **duplicated** — the same id twice, which inflates a count without
 *   covering anything new.
 * - **unexpected** — an id the contract does not know. Usually a renamed
 *   template, which means the "missing" id is silently gone.
 * - **failed** — covered, but did not pass.
 */
export function coverageProblems(
  label: string,
  observed: readonly string[],
  expected: readonly string[] | undefined,
): string[] {
  /*
   * No contract, no completeness claim.
   *
   * The verdict still rests on internal consistency, and the caller records
   * that this bundle carried less than a full coverage proof. Asserting a
   * complete set here without a contract would be inventing one.
   */
  if (expected === undefined) return []

  const problems: string[] = []
  const counts = new Map<string, number>()
  for (const id of observed) counts.set(id, (counts.get(id) ?? 0) + 1)

  for (const id of expected) {
    const seen = counts.get(id) ?? 0
    if (seen === 0) problems.push(`${label}: ${id} is missing from the report`)
    else if (seen > 1) problems.push(`${label}: ${id} appears ${seen} times`)
  }
  const known = new Set(expected)
  for (const id of counts.keys()) {
    if (!known.has(id)) {
      problems.push(
        `${label}: ${id} is not in the contract's expected set (renamed or invented?)`,
      )
    }
  }
  return problems
}

/** The sha256 of a report's bytes, which is how a report is pinned. */
export function evidenceSha256(content: string): string {
  return createHash('sha256').update(Buffer.from(content, 'utf8')).digest('hex')
}

/**
 * Which commit a report is evidence *about*.
 *
 * The registry report describes the published Core release; everything else
 * describes the UI candidate that was tested against it. Naming this as a
 * function keeps the producer and the verifier from disagreeing.
 */
export function evidenceSourceCommit(
  id: EvidenceReportId,
  expected: Pick<EvidenceExpectation, 'coreCommit' | 'uiCommit'>,
): string {
  return id === 'core-registry-report'
    ? expected.coreCommit.toLowerCase()
    : expected.uiCommit.toLowerCase()
}

interface JudgedReport {
  readonly verdict: 'PASS' | 'FAIL'
  readonly problems: readonly string[]
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function numberAt(
  report: Record<string, unknown>,
  field: string,
): number | undefined {
  const value = report[field]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/**
 * Reads a report's verdict from the report itself.
 *
 * Used by both the producer (to fill `verdict`) and the verifier (to check it),
 * so the two cannot drift: a bundle cannot claim PASS for a report this
 * function would judge FAIL, because the verifier recomputes it from the bytes.
 *
 * Each case states the acceptance condition in terms of the report's own
 * numbers, not in terms of a threshold someone could lower. "6 of 6 templates
 * passed" and "5 of 5 probes rendered" are counts the report itself carries, so
 * a run that covered half the templates cannot be relabelled as a pass by
 * editing the verdict.
 */
export function judgeEvidenceReport(
  id: EvidenceReportId,
  content: string,
  expected: Pick<
    EvidenceExpectation,
    'coreVersion' | 'uiVersion' | 'uiCommit' | 'coverage'
  >,
): JudgedReport {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    return { verdict: 'FAIL', problems: ['the report is not valid JSON'] }
  }
  const report = asRecord(parsed)
  if (!report) {
    return { verdict: 'FAIL', problems: ['the report is not a JSON object'] }
  }

  const expectedSchema = EVIDENCE_REPORT_SCHEMAS[id]
  if (report.schema !== expectedSchema) {
    return {
      verdict: 'FAIL',
      problems: [
        `schema is ${String(report.schema)}, expected ${expectedSchema}`,
      ],
    }
  }

  const problems: string[] = []
  const requireEqual = (
    field: string,
    actual: unknown,
    wanted: unknown,
  ): void => {
    if (actual !== wanted) {
      problems.push(`${field} is ${String(actual)}, expected ${String(wanted)}`)
    }
  }

  switch (id) {
    case 'core-registry-report': {
      /*
       * "All of them", stated as arithmetic on the report's own fields. A
       * partial publish is the state rc.3 shipped in: 7 packages, none of them
       * the runtime. Counting only published packages would call that progress.
       */
      requireEqual('version', report.version, expected.coreVersion)
      const checked = numberAt(report, 'checked')
      if (checked === undefined || checked <= 0) {
        problems.push('checked must be a positive number')
      } else {
        for (const field of ['exactVersion', 'rcTag', 'integrityRecorded']) {
          requireEqual(field, report[field], checked)
        }
      }
      const binaries = numberAt(report, 'platformBinaries')
      if (binaries === undefined || binaries <= 0) {
        problems.push('platformBinaries must be a positive number')
      }
      break
    }
    case 'ui-candidate-report': {
      requireEqual('passed', report.passed, true)
      requireEqual('coreVersion', report.coreVersion, expected.coreVersion)
      requireEqual('uiVersion', report.uiVersion, expected.uiVersion)
      /*
       * The candidate report proves the templates build against real packages.
       * A run that covered no templates proves nothing, and one that skipped a
       * template silently is the failure the gate exists to catch — so every
       * entry must have passed and there must be at least one.
       */
      const templates = Array.isArray(report.templates) ? report.templates : []
      if (templates.length === 0) {
        problems.push('templates must be a non-empty array')
      }
      const covered: string[] = []
      for (const template of templates) {
        const entry = asRecord(template)
        if (!entry) {
          problems.push('a template entry is not an object')
          continue
        }
        if (typeof entry.template === 'string') covered.push(entry.template)
        if (entry.passed !== true) {
          problems.push(`template ${String(entry.template)} did not pass`)
        }
        if (entry.pinMatch !== true) {
          problems.push(
            `template ${String(entry.template)} did not match its pins`,
          )
        }
      }
      /*
       * The candidate set must be the contracted set.
       *
       * Without this, deleting a template from the run also deletes it from the
       * denominator, and the report still says "all templates passed".
       */
      problems.push(
        ...coverageProblems('templates', covered, expected.coverage?.templates),
      )
      break
    }
    case 'template-acceptance': {
      requireEqual('version', report.version, expected.uiVersion)
      requireEqual('uiCommit', report.uiCommit, expected.uiCommit)
      const templates = numberAt(report, 'templates')
      if (templates === undefined || templates <= 0) {
        problems.push('templates must be a positive number')
      } else {
        requireEqual('passed', report.passed, templates)
        /*
         * The count must be the contracted count.
         *
         * `passed === templates` is satisfied by "1 of 1"; a release that
         * promised six templates and verified one would read as complete.
         */
        const contracted = expected.coverage?.templates?.length
        if (contracted !== undefined && templates !== contracted) {
          problems.push(
            `templates is ${templates}, but the contract expects ${contracted}`,
          )
        }
      }
      break
    }
    case 'browser-acceptance': {
      requireEqual('version', report.version, expected.uiVersion)
      requireEqual('uiCommit', report.uiCommit, expected.uiCommit)
      const probes = numberAt(report, 'probes')
      if (probes === undefined || probes <= 0) {
        problems.push('probes must be a positive number')
      } else {
        /*
         * Probes are templates minus the ones that ship no page. Derived from
         * the same contract rather than a literal, so adding a page-less
         * template does not make every future run look incomplete.
         */
        const contracted =
          expected.coverage?.templates === undefined
            ? undefined
            : expected.coverage.templates.filter(
                name =>
                  !(expected.coverage?.templatesWithoutProbe ?? []).includes(
                    name,
                  ),
              ).length
        if (contracted !== undefined && probes !== contracted) {
          problems.push(
            `probes is ${probes}, but the contract expects ${contracted} templates with a page`,
          )
        }
        requireEqual('passed', report.passed, probes)
      }
      break
    }
    case 'ui-registry-preflight': {
      requireEqual('version', report.version, expected.uiVersion)
      /*
       * The preflight must have found the candidate unpublished, which is what
       * `published` being empty means.
       *
       * This is read from the fields the producer actually writes —
       * `published`/`absent`/`failed` arrays and `ok` — not from an invented
       * `alreadyPublished` counter. An earlier version of this check looked for
       * that counter, which no report has ever carried, so against a real
       * preflight it would have compared `undefined` to `0` and failed for the
       * wrong reason. Matching the producer's real shape is the difference
       * between a check and a guess.
       */
      const published = Array.isArray(report.published)
        ? report.published
        : undefined
      const absent = Array.isArray(report.absent) ? report.absent : undefined
      if (published === undefined || absent === undefined) {
        problems.push('published and absent must be arrays')
        break
      }
      if (published.length !== 0) {
        problems.push(
          `${published.length} package(s) were already published: ${published.slice(0, 5).join(', ')}`,
        )
      }
      if (absent.length === 0) {
        problems.push('the preflight found no packages to publish')
      }
      if (Array.isArray(report.failed) && report.failed.length > 0) {
        problems.push(
          `${report.failed.length} package(s) could not be queried: ${report.failed.join(', ')}`,
        )
      }
      requireEqual('ok', report.ok, true)
      /*
       * The three buckets must partition the contracted package set.
       *
       * A preflight that queried 46 packages out of a 46-package release and a
       * preflight that queried 12 out of 12 both report "0 already published",
       * and only one of them is about the release that ships.
       */
      const contracted = expected.coverage?.packages
      if (contracted !== undefined) {
        const seen = [
          ...published,
          ...absent,
          ...(Array.isArray(report.failed) ? report.failed : []),
        ].filter((name): name is string => typeof name === 'string')
        problems.push(...coverageProblems('packages', seen, contracted))
      }
      break
    }
  }

  return {
    verdict: problems.length === 0 ? 'PASS' : 'FAIL',
    problems,
  }
}

/**
 * Checks a bundle against facts established elsewhere.
 *
 * Structural and internal-consistency only: the network checks (does the run
 * exist, was it successful, was the PR approved) live with the caller that can
 * make them. What this guarantees is that a caller which verified those three
 * things is not holding a bundle whose other fields describe a different
 * release, a different candidate, or a failed report relabelled as a pass.
 */
export function verifyEvidenceBundle(
  value: unknown,
  file: string,
  expected: EvidenceExpectation,
): EvidenceProblem[] {
  const problems: EvidenceProblem[] = []
  const push = (message: string): void => {
    problems.push({ file, message })
  }

  const bundle = asRecord(value)
  if (!bundle) {
    push('not a JSON object')
    return problems
  }

  if (bundle.schema !== RELEASE_EVIDENCE_BUNDLE_SCHEMA) {
    push(`schema must be ${RELEASE_EVIDENCE_BUNDLE_SCHEMA}`)
  }

  const requireEqual = (
    field: string,
    actual: unknown,
    wanted: unknown,
  ): void => {
    if (actual !== wanted) {
      push(`${field} is ${String(actual)}, expected ${String(wanted)}`)
    }
  }

  requireEqual('version', bundle.version, expected.version)

  const core = asRecord(bundle.core)
  if (!core) {
    push('core must be an object')
  } else {
    requireEqual('core.version', core.version, expected.coreVersion)
    requireEqual('core.tag', core.tag, `v${expected.coreVersion}`)
    requireEqual(
      'core.commit',
      typeof core.commit === 'string' ? core.commit.toLowerCase() : core.commit,
      expected.coreCommit.toLowerCase(),
    )
  }

  const ui = asRecord(bundle.ui)
  if (!ui) {
    push('ui must be an object')
  } else {
    requireEqual('ui.version', ui.version, expected.uiVersion)
    requireEqual(
      'ui.commit',
      typeof ui.commit === 'string' ? ui.commit.toLowerCase() : ui.commit,
      expected.uiCommit.toLowerCase(),
    )
    requireEqual(
      'ui.tree',
      typeof ui.tree === 'string' ? ui.tree.toLowerCase() : ui.tree,
      expected.uiTree.toLowerCase(),
    )
    requireEqual(
      'ui.lockfileSha256',
      typeof ui.lockfileSha256 === 'string'
        ? ui.lockfileSha256.toLowerCase()
        : ui.lockfileSha256,
      expected.lockfileSha256.toLowerCase(),
    )
  }

  const rawReports = Array.isArray(bundle.reports) ? bundle.reports : undefined
  if (!rawReports) {
    push('reports must be an array')
    return problems
  }

  const seen = new Map<string, number>()
  for (const report of rawReports) {
    const entry = asRecord(report)
    const id = entry?.id
    if (typeof id === 'string') {
      seen.set(id, (seen.get(id) ?? 0) + 1)
    }
  }
  for (const id of EVIDENCE_REPORT_IDS) {
    const count = seen.get(id) ?? 0
    if (count === 0) push(`report ${id} is missing`)
    else if (count > 1) push(`report ${id} appears ${count} times`)
  }
  for (const id of seen.keys()) {
    if (!EVIDENCE_REPORT_IDS.includes(id as EvidenceReportId)) {
      push(`report ${id} is not one of the five required evidence types`)
    }
  }

  for (const report of rawReports) {
    const entry = asRecord(report)
    if (!entry) {
      push('a report entry is not an object')
      continue
    }
    const id = entry.id
    if (
      typeof id !== 'string' ||
      !EVIDENCE_REPORT_IDS.includes(id as EvidenceReportId)
    ) {
      continue
    }
    const typedId = id as EvidenceReportId
    const label = `reports[${typedId}]`

    requireEqual(
      `${label}.schema`,
      entry.schema,
      EVIDENCE_REPORT_SCHEMAS[typedId],
    )

    const content = entry.content
    if (typeof content !== 'string' || content.length === 0) {
      push(`${label}.content must carry the report itself, not a reference`)
      continue
    }
    const digest = evidenceSha256(content)
    if (
      typeof entry.sha256 !== 'string' ||
      !SHA256.test(entry.sha256) ||
      entry.sha256.toLowerCase() !== digest
    ) {
      push(
        `${label}.sha256 is ${String(entry.sha256)}, but the content it carries hashes to ${digest}`,
      )
    }

    /*
     * The verdict is recomputed, never read. A bundle that marks a failed
     * report as PASS is the exact failure this check exists for, and trusting
     * its own `verdict` field would make the check decorative.
     */
    const judged = judgeEvidenceReport(typedId, content, expected)
    for (const problem of judged.problems) push(`${label}: ${problem}`)
    if (entry.verdict !== judged.verdict && entry.verdict === 'PASS') {
      push(
        `${label}.verdict claims PASS, but the report fails: ${judged.problems.join('; ')}`,
      )
    }
    if (entry.verdict !== 'PASS') {
      push(
        `${label}.verdict is ${String(entry.verdict)}; evidence must have passed`,
      )
    }

    requireEqual(
      `${label}.sourceCommit`,
      typeof entry.sourceCommit === 'string'
        ? entry.sourceCommit.toLowerCase()
        : entry.sourceCommit,
      evidenceSourceCommit(typedId, expected),
    )

    const producer = asRecord(entry.producer)
    if (!producer) {
      push(`${label}.producer must be an object`)
    } else {
      if (producer.kind !== 'workflow' && producer.kind !== 'local') {
        push(`${label}.producer.kind must be workflow or local`)
      }
      if (
        typeof producer.repository !== 'string' ||
        !/^[\w.-]+\/[\w.-]+$/.test(producer.repository)
      ) {
        push(`${label}.producer.repository must name the repository`)
      }
      if (producer.kind === 'workflow') {
        if (
          typeof producer.runId !== 'number' ||
          !Number.isInteger(producer.runId) ||
          producer.runId <= 0
        ) {
          push(`${label}.producer.runId must be the workflow run id`)
        }
        if (
          typeof producer.headSha !== 'string' ||
          !FULL_SHA.test(producer.headSha)
        ) {
          push(`${label}.producer.headSha must be the run's commit`)
        }
        if (
          typeof producer.workflow !== 'string' ||
          producer.workflow.length === 0
        ) {
          push(`${label}.producer.workflow must name the workflow file`)
        }
      } else if (
        typeof producer.command !== 'string' ||
        producer.command.trim().length === 0
      ) {
        /*
         * A local report has no run to look up, so the only way a reader can
         * reproduce it is the command. Without one, "local" would be an
         * unaccountable source.
         */
        push(`${label}.producer.command must say how to reproduce the report`)
      }
    }
  }

  return problems
}
