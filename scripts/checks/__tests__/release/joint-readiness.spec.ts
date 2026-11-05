import type { JointReadinessInput } from '../../release/joint-readiness'

import { describe, expect, it } from 'vitest'
import {
  evaluateJointReadiness,
  evaluateJointReportEvidence,
} from '../../release/joint-readiness'

const pass = (evidence: string) => ({ status: 'pass' as const, evidence })

const products = [
  {
    id: 'webc-studio',
    localEvidence: pass('Playground editor local evidence passed'),
    onlineUrl: 'https://a.test',
  },
  {
    id: 'native-lab',
    localEvidence: pass('Playground editor local evidence passed'),
    onlineUrl: 'https://b.test',
  },
  {
    id: 'admin',
    localEvidence: pass('Admin report passed for current HEAD'),
    onlineUrl: 'https://c.test',
  },
  {
    id: 'ai-workbench',
    localEvidence: pass('AI Workbench report passed for current HEAD'),
    onlineUrl: 'https://d.test',
  },
] as const

const ready: JointReadinessInput = {
  coreVersion: '0.2.0',
  uiVersion: '0.2.0',
  coreCommit: 'core123',
  uiCommit: 'ui456',
  cleanWorktrees: true,
  zeusAlignment: true,
  aiPack: true,
  aiWorkbench: pass('AI Workbench report passed for current HEAD'),
  dataGridFramework: pass('DataGrid framework report passed for current HEAD'),
  manualA11y: true,
  crossPlatform: true,
  releaseApproved: true,
  products,
}

describe('evaluateJointReadiness', () => {
  it('accepts a complete joint matrix', () => {
    const report = evaluateJointReadiness(ready)

    expect(report.decision).toBe('READY_FOR_JOINT_RELEASE_REVIEW')
    expect(report.blockers).toEqual([])
    expect(report.core).toEqual({ version: '0.2.0', commit: 'core123' })
  })

  it('keeps online URLs and approval as hard blockers', () => {
    const report = evaluateJointReadiness({
      ...ready,
      cleanWorktrees: false,
      releaseApproved: false,
      products: products.map(product => ({
        ...product,
        onlineUrl: product.id === 'admin' ? undefined : product.onlineUrl,
      })),
    })

    expect(report.decision).toBe('NOT_READY')
    expect(report.blockers).toEqual([
      'clean-worktrees: uncommitted changes exist',
      'release-approval: joint release approval not granted',
      'product:admin:online: online URL missing',
    ])
  })

  it('reports an AI Workbench failure and a missing product', () => {
    const report = evaluateJointReadiness({
      ...ready,
      aiWorkbench: {
        status: 'fail',
        evidence: 'AI Workbench report is bound to old-commit, expected ui456',
      },
      products: products.filter(product => product.id !== 'native-lab'),
    })

    expect(report.blockers).toEqual([
      'ai-workbench: AI Workbench report is bound to old-commit, expected ui456',
      'product:native-lab:present: product is absent from the joint matrix',
    ])
  })

  it('rejects non-HTTPS and duplicate online URLs', () => {
    const report = evaluateJointReadiness({
      ...ready,
      products: products.map(product => ({
        ...product,
        onlineUrl:
          product.id === 'webc-studio'
            ? 'https://a.test/'
            : product.id === 'native-lab'
              ? 'https://a.test/'
              : product.id === 'admin'
                ? 'http://admin.test'
                : product.onlineUrl,
      })),
    })

    expect(report.blockers).toEqual([
      'product:native-lab:online: online URL duplicates webc-studio',
      'product:admin:online: online URL must be an HTTPS URL without credentials',
    ])
  })
})

describe('evaluateJointReportEvidence', () => {
  it('requires the report to be bound to the current HEAD', () => {
    expect(
      evaluateJointReportEvidence(
        {
          sourceCommit: 'old-commit',
          results: [{ status: 'passed' }],
        },
        'AI Workbench',
        'ui456',
      ),
    ).toEqual({
      status: 'fail',
      evidence: 'AI Workbench report is bound to old-commit, expected ui456',
    })

    expect(
      evaluateJointReportEvidence(
        { results: [{ status: 'passed' }] },
        'AI Workbench',
        'ui456',
      ),
    ).toEqual({
      status: 'fail',
      evidence: 'AI Workbench report is missing sourceCommit',
    })
  })

  it('accepts a passing report with the current commit', () => {
    expect(
      evaluateJointReportEvidence(
        {
          sourceCommit: 'ui456',
          results: [{ status: 'passed' }],
        },
        'AI Workbench',
        'ui456',
      ),
    ).toEqual({
      status: 'pass',
      evidence: 'AI Workbench report passed for current HEAD',
    })
  })
})
