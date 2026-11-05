/**
 * Pure joint-release evaluator for the Zeus Core + Zeus UI compatibility
 * matrix. It never publishes, tags or deploys; it only reports evidence.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { checkZeusBetaAlignment } from '../contract/check-zeus-beta-alignment'

export type JointReadinessStatus = 'pass' | 'fail' | 'not_run'

export interface JointEvidence {
  readonly status: JointReadinessStatus
  readonly evidence: string
}

export interface JointProductEvidence {
  readonly id: 'webc-studio' | 'native-lab' | 'admin' | 'ai-workbench'
  readonly localEvidence: JointEvidence
  readonly onlineUrl?: string
}

export interface JointReadinessInput {
  readonly coreVersion: string
  readonly uiVersion: string
  readonly coreCommit: string
  readonly uiCommit: string
  readonly cleanWorktrees: boolean
  readonly zeusAlignment: boolean
  readonly aiPack: boolean
  readonly aiWorkbench: JointEvidence
  readonly dataGridFramework: JointEvidence
  readonly manualA11y: boolean
  readonly crossPlatform: boolean
  readonly releaseApproved: boolean
  readonly products: readonly JointProductEvidence[]
}

export interface JointReadinessCheck {
  readonly id: string
  readonly status: JointReadinessStatus
  readonly evidence: string
}

export interface JointReadinessReport {
  readonly schema: 'zeus-ui.joint-readiness/v1'
  readonly decision: 'READY_FOR_JOINT_RELEASE_REVIEW' | 'NOT_READY'
  readonly core: { readonly version: string; readonly commit: string }
  readonly ui: { readonly version: string; readonly commit: string }
  readonly checks: readonly JointReadinessCheck[]
  readonly blockers: readonly string[]
}

const PRODUCT_IDS = [
  'webc-studio',
  'native-lab',
  'admin',
  'ai-workbench',
] as const

export function evaluateJointReadiness(
  input: JointReadinessInput,
): JointReadinessReport {
  const checks: JointReadinessCheck[] = [
    passOrNotRun(
      'clean-worktrees',
      input.cleanWorktrees,
      input.cleanWorktrees
        ? 'both worktrees are clean'
        : 'uncommitted changes exist',
    ),
    passOrNotRun(
      'zeus-alignment',
      input.zeusAlignment,
      input.zeusAlignment
        ? 'UI packages align with the Core version'
        : 'Core version alignment failed',
    ),
    passOrNotRun(
      'ai-pack',
      input.aiPack,
      input.aiPack
        ? 'AI package entry/pack checks passed'
        : 'AI package check missing or failed',
    ),
    evidenceCheck('ai-workbench', input.aiWorkbench),
    evidenceCheck('data-grid-framework', input.dataGridFramework),
    passOrNotRun(
      'manual-a11y',
      input.manualA11y,
      input.manualA11y
        ? 'VoiceOver/NVDA acceptance recorded'
        : 'manual screen-reader acceptance missing',
    ),
    passOrNotRun(
      'cross-platform',
      input.crossPlatform,
      input.crossPlatform
        ? 'Windows/Linux matrix recorded'
        : 'only the local platform is verified',
    ),
    passOrNotRun(
      'release-approval',
      input.releaseApproved,
      input.releaseApproved
        ? 'joint release approval recorded'
        : 'joint release approval not granted',
    ),
  ]

  const seenUrls = new Map<string, string>()
  for (const product of input.products) {
    checks.push(
      evidenceCheck(`product:${product.id}:local`, product.localEvidence),
    )
    checks.push(
      evidenceCheck(
        `product:${product.id}:online`,
        onlineEvidence(product, seenUrls),
      ),
    )
  }

  const missingProducts = PRODUCT_IDS.filter(
    id => !input.products.some(product => product.id === id),
  )
  for (const id of missingProducts) {
    checks.push({
      id: `product:${id}:present`,
      status: 'not_run',
      evidence: 'product is absent from the joint matrix',
    })
  }

  const blockers = checks
    .filter(check => check.status !== 'pass')
    .map(check => `${check.id}: ${check.evidence}`)

  return {
    schema: 'zeus-ui.joint-readiness/v1',
    decision:
      blockers.length === 0 ? 'READY_FOR_JOINT_RELEASE_REVIEW' : 'NOT_READY',
    core: { version: input.coreVersion, commit: input.coreCommit },
    ui: { version: input.uiVersion, commit: input.uiCommit },
    checks,
    blockers,
  }
}

function passOrNotRun(
  id: string,
  passed: boolean,
  evidence: string,
): JointReadinessCheck {
  return { id, status: passed ? 'pass' : 'not_run', evidence }
}

function evidenceCheck(
  id: string,
  evidence: JointEvidence,
): JointReadinessCheck {
  return { id, status: evidence.status, evidence: evidence.evidence }
}

function onlineEvidence(
  product: JointProductEvidence,
  seenUrls: Map<string, string>,
): JointEvidence {
  if (!product.onlineUrl) {
    return { status: 'not_run', evidence: 'online URL missing' }
  }

  const url = parseHttpsUrl(product.onlineUrl)
  if (!url) {
    return {
      status: 'fail',
      evidence: 'online URL must be an HTTPS URL without credentials',
    }
  }

  const duplicate = seenUrls.get(url)
  if (duplicate) {
    return {
      status: 'fail',
      evidence: `online URL duplicates ${duplicate}`,
    }
  }
  seenUrls.set(url, product.id)
  return { status: 'pass', evidence: product.onlineUrl }
}

function parseHttpsUrl(value: string): string | undefined {
  try {
    const url = new URL(value)
    if (
      url.protocol !== 'https:' ||
      url.hostname.length === 0 ||
      url.username.length > 0 ||
      url.password.length > 0
    ) {
      return undefined
    }
    return url.href
  } catch {
    return undefined
  }
}

interface BrowserReport {
  readonly results?: readonly { readonly status?: string }[]
  readonly passed?: boolean
  readonly sourceCommit?: string
  readonly commit?: string
  readonly products?: readonly {
    readonly id: string
    readonly status: string
  }[]
}

interface JsonReadResult {
  readonly value?: unknown
  readonly missing: boolean
  readonly error?: string
}

function readJson(file: string | undefined): JsonReadResult {
  if (!file) return { missing: true }
  try {
    return {
      value: JSON.parse(readFileSync(file, 'utf8')) as unknown,
      missing: false,
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { missing: true }
    }
    return {
      missing: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function readCoreJson(
  coreRoot: string | undefined,
  relative: string,
): JsonReadResult {
  return readJson(coreRoot ? path.join(coreRoot, relative) : undefined)
}

export function evaluateJointReportEvidence(
  value: unknown,
  label: string,
  expectedCommit: string,
): JointEvidence {
  if (!isRecord(value)) {
    return { status: 'fail', evidence: `${label} report must be an object` }
  }

  const report = value as BrowserReport
  const commit = report.sourceCommit ?? report.commit
  if (typeof commit !== 'string' || commit.length === 0) {
    return {
      status: 'fail',
      evidence: `${label} report is missing sourceCommit`,
    }
  }
  if (commit !== expectedCommit) {
    return {
      status: 'fail',
      evidence: `${label} report is bound to ${commit}, expected ${expectedCommit}`,
    }
  }
  if (!allPassed(report)) {
    return { status: 'fail', evidence: `${label} report failed` }
  }
  return {
    status: 'pass',
    evidence: `${label} report passed for current HEAD`,
  }
}

function reportEvidence(
  result: JsonReadResult,
  label: string,
  expectedCommit: string,
): JointEvidence {
  if (result.missing) {
    return { status: 'not_run', evidence: `${label} report missing` }
  }
  if (result.error) {
    return { status: 'fail', evidence: `${label} report is invalid JSON` }
  }
  return evaluateJointReportEvidence(result.value, label, expectedCommit)
}

function productEvidence(
  report: JointEvidence,
  result: JsonReadResult,
  label: string,
  id: JointProductEvidence['id'],
): JointEvidence {
  if (report.status !== 'pass') return report
  const products =
    isRecord(result.value) && Array.isArray(result.value.products)
      ? (result.value.products as BrowserReport['products'])
      : undefined
  const passed = products?.some(
    product => product.id === id && product.status === 'passed',
  )
  return passed
    ? {
        status: 'pass',
        evidence: `${label} local evidence passed for current HEAD`,
      }
    : {
        status: 'fail',
        evidence: `${label} report has no passing ${id} evidence`,
      }
}

function allPassed(report: BrowserReport): boolean {
  if (report.passed !== undefined) return report.passed
  return Boolean(
    report.results?.length &&
    report.results.every(entry => entry.status === 'passed'),
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function git(root: string, args: readonly string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
}

function readVersion(root: string): string {
  return String(
    JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version,
  )
}

function productUrl(id: JointProductEvidence['id']): string | undefined {
  const key = `ZEUS_${productKey(id)}_URL`
  return process.env[key] || undefined
}

function productKey(id: string): string {
  return id.split('-').join('_').toUpperCase()
}

export function readJointReadinessInput(
  uiRoot = process.cwd(),
  coreRoot = process.env.ZEUS_CORE_ROOT ?? defaultCoreRoot(uiRoot),
): JointReadinessInput {
  const uiCommit = git(uiRoot, ['rev-parse', 'HEAD'])
  const coreCommit = coreRoot ? git(coreRoot, ['rev-parse', 'HEAD']) : undefined
  const aiPack = readJson(path.join(uiRoot, 'temp/ai-pack-report.json'))
  const aiWorkbenchResult = readJson(
    path.join(uiRoot, 'temp/ai-workbench/report.json'),
  )
  const dataGridResult = readJson(
    path.join(uiRoot, 'temp/data-grid-framework-e2e/report.json'),
  )
  const webcStudioResult = readCoreJson(
    coreRoot,
    'temp/playground-editor/report.json',
  )
  const nativeLabResult = webcStudioResult
  const adminResult = readCoreJson(coreRoot, 'temp/admin/report.json')

  const aiWorkbench = reportEvidence(
    aiWorkbenchResult,
    'AI Workbench',
    uiCommit,
  )
  const dataGridFramework = reportEvidence(
    dataGridResult,
    'DataGrid framework',
    uiCommit,
  )
  const playgroundReport = coreCommit
    ? reportEvidence(webcStudioResult, 'Playground editor', coreCommit)
    : { status: 'not_run' as const, evidence: 'Core checkout is unavailable' }
  const adminReport = coreCommit
    ? reportEvidence(adminResult, 'Admin', coreCommit)
    : { status: 'not_run' as const, evidence: 'Core checkout is unavailable' }

  const explicitProductEvidence = new Set(
    (process.env.ZEUS_PRODUCT_LOCAL_EVIDENCE ?? '')
      .split(',')
      .map(value => value.trim())
      .filter(Boolean),
  )
  const localByProduct: Record<JointProductEvidence['id'], JointEvidence> = {
    'webc-studio': productEvidence(
      playgroundReport,
      webcStudioResult,
      'Playground editor',
      'webc-studio',
    ),
    'native-lab': productEvidence(
      playgroundReport,
      nativeLabResult,
      'Playground editor',
      'native-lab',
    ),
    admin: adminReport,
    'ai-workbench': aiWorkbench,
  }
  const products: JointProductEvidence[] = PRODUCT_IDS.map(id => {
    const evidence = localByProduct[id]
    return {
      id,
      localEvidence:
        evidence.status === 'pass'
          ? evidence
          : explicitProductEvidence.has(id)
            ? { status: 'pass', evidence: 'explicit local evidence recorded' }
            : evidence,
      onlineUrl: productUrl(id),
    }
  })

  const status = git(uiRoot, ['status', '--porcelain'])
  const coreStatus = coreRoot ? git(coreRoot, ['status', '--porcelain']) : ''

  return {
    coreVersion: coreRoot ? readVersion(coreRoot) : 'unresolved',
    uiVersion: readVersion(uiRoot),
    coreCommit: coreRoot
      ? git(coreRoot, ['rev-parse', '--short', 'HEAD'])
      : 'unresolved',
    uiCommit: git(uiRoot, ['rev-parse', '--short', 'HEAD']),
    cleanWorktrees:
      status.length === 0 && Boolean(coreRoot) && coreStatus.length === 0,
    zeusAlignment: checkZeusBetaAlignment({ root: uiRoot }).ok,
    aiPack: Boolean(
      aiPack.value &&
      isRecord(aiPack.value) &&
      Object.keys(aiPack.value).length > 0,
    ),
    aiWorkbench,
    dataGridFramework,
    manualA11y: process.env.ZEUS_MANUAL_A11Y === 'passed',
    crossPlatform: process.env.ZEUS_CROSS_PLATFORM === 'passed',
    releaseApproved: process.env.ZEUS_JOINT_RELEASE_APPROVED === 'true',
    products,
  }
}

function defaultCoreRoot(uiRoot: string): string | undefined {
  const sibling = path.resolve(uiRoot, '../zeus')
  return existsSync(path.join(sibling, 'package.json')) ? sibling : undefined
}

function main(): void {
  const report = evaluateJointReadiness(readJointReadinessInput())
  const output = path.resolve('temp/release/joint-readiness.json')
  mkdirSync(path.dirname(output), { recursive: true })
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`)
  console.log(`${report.decision}: ${path.relative(process.cwd(), output)}`)
  for (const blocker of report.blockers) console.log(`- ${blocker}`)
  if (report.decision !== 'READY_FOR_JOINT_RELEASE_REVIEW') {
    process.exitCode = 1
  }
}

if (import.meta.url === `file://${path.resolve(process.argv[1] ?? '')}`) {
  main()
}
