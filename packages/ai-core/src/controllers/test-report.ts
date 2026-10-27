/**
 * Test report model (AI2-406).
 *
 * A test report arrives as a `structured` content part or artifact with
 * schema `zeus.test-report/v1`. The summary and failure locations are small
 * and shown immediately; raw output lives behind an `AssetRef` and is only
 * loaded when the user expands a case.
 */

import type { AssetRef } from '../domain/types'
import type { Controller } from './view-store'

import { isRecord } from '../internal/stable'
import { isSafeRelativePath } from '../protocol/validation'
import { createViewStore } from './view-store'

export const TEST_REPORT_SCHEMA = 'zeus.test-report/v1'

export type TestCaseStatus = 'passed' | 'failed' | 'skipped'

export interface TestCaseLocation {
  file: string
  line?: number
  column?: number
}

export interface TestCase {
  id: string
  name: string
  status: TestCaseStatus
  durationMs?: number
  location?: TestCaseLocation
  /** One-line failure message, already redacted by the host. */
  message?: string
  /** Full output, loaded on demand. */
  output?: AssetRef
}

export interface TestReport {
  schema: typeof TEST_REPORT_SCHEMA
  summary: {
    passed: number
    failed: number
    skipped: number
    durationMs?: number
  }
  cases: readonly TestCase[]
}

export type ParseTestReportResult =
  | { ok: true; report: TestReport }
  | { ok: false; message: string }

const STATUSES: readonly TestCaseStatus[] = ['passed', 'failed', 'skipped']

function count(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

export function parseTestReport(value: unknown): ParseTestReportResult {
  if (!isRecord(value) || value.schema !== TEST_REPORT_SCHEMA) {
    return { ok: false, message: `expected schema ${TEST_REPORT_SCHEMA}` }
  }

  const summary = value.summary
  if (
    !isRecord(summary) ||
    !count(summary.passed) ||
    !count(summary.failed) ||
    !count(summary.skipped)
  ) {
    return { ok: false, message: 'summary needs passed/failed/skipped counts' }
  }

  if (!Array.isArray(value.cases)) {
    return { ok: false, message: 'cases must be an array' }
  }

  const cases: TestCase[] = []

  for (const [index, entry] of value.cases.entries()) {
    if (
      !isRecord(entry) ||
      typeof entry.id !== 'string' ||
      typeof entry.name !== 'string' ||
      !STATUSES.includes(entry.status as TestCaseStatus)
    ) {
      return { ok: false, message: `cases[${index}] is malformed` }
    }

    const location = entry.location
    if (
      location !== undefined &&
      (!isRecord(location) ||
        typeof location.file !== 'string' ||
        !isSafeRelativePath(location.file))
    ) {
      return {
        ok: false,
        message: `cases[${index}].location is not a safe path`,
      }
    }

    cases.push(entry as unknown as TestCase)
  }

  return { ok: true, report: { ...(value as unknown as TestReport), cases } }
}

export type CaseOutputStatus = 'collapsed' | 'loading' | 'ready' | 'error'

export interface CaseOutputState {
  status: CaseOutputStatus
  text?: string
  error?: string
}

export interface TestReportViewState {
  report: TestReport
  /** Failed cases first, then the rest in report order. */
  orderedCaseIds: readonly string[]
  expanded: Readonly<Record<string, CaseOutputState>>
}

export interface TestReportControllerOptions {
  report: TestReport
  loadOutput: (asset: AssetRef) => Promise<string>
  /** Cap the shown output; the rest stays in the asset. Default 64 KiB. */
  maxOutputChars?: number
}

export interface TestReportController extends Controller<TestReportViewState> {
  toggle: (caseId: string) => Promise<void>
}

export function createTestReportController(
  options: TestReportControllerOptions,
): TestReportController {
  const maxChars = options.maxOutputChars ?? 64 * 1024
  const cases = options.report.cases
  const view = createViewStore<TestReportViewState>({
    report: options.report,
    orderedCaseIds: [
      ...cases.filter(entry => entry.status === 'failed'),
      ...cases.filter(entry => entry.status !== 'failed'),
    ].map(entry => entry.id),
    expanded: {},
  })

  function set(caseId: string, state: CaseOutputState | undefined): void {
    view.update(current => {
      const expanded = { ...current.expanded }
      if (state) expanded[caseId] = state
      else delete expanded[caseId]
      return { expanded }
    })
  }

  return {
    getSnapshot: view.getSnapshot,
    subscribe: view.subscribe,
    get disposed(): boolean {
      return view.disposed
    },
    async toggle(caseId): Promise<void> {
      const entry = cases.find(item => item.id === caseId)
      if (!entry) return

      if (view.getSnapshot().expanded[caseId]) {
        set(caseId, undefined)
        return
      }

      if (!entry.output) {
        set(caseId, { status: 'ready', text: entry.message ?? '' })
        return
      }

      set(caseId, { status: 'loading' })

      try {
        const text = await options.loadOutput(entry.output)
        if (!view.getSnapshot().expanded[caseId]) return
        set(caseId, {
          status: 'ready',
          text:
            text.length > maxChars
              ? `${text.slice(0, maxChars)}\n… output truncated`
              : text,
        })
      } catch (error) {
        if (!view.getSnapshot().expanded[caseId]) return
        set(caseId, {
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        })
      }
    },
    dispose(): void {
      view.dispose()
    },
  }
}
