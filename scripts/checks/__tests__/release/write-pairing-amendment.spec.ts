import type { EvidenceExpectation } from '../../../release/evidence-bundle'

import type { AmendmentExpectation } from '../../../release/pairing-amendment'
/**
 * The amendment writer's guards, and the validator's negative cases.
 *
 * The tool talks to GitHub, so the parts worth testing without a network are
 * the ones that decide whether a file is even a candidate for acceptance: a
 * bootstrap record cannot be amended, a missing evidence report is not
 * evidence, an amendment that would replace a candidate with itself is a
 * direct pair wearing the wrong name, and an authorization that names no
 * specific review is not an authorization.
 *
 * Those are asserted through the same validator the release uses, so a guard
 * that stops the writer is also proven to stop a hand-written file.
 */
import { describe, expect, it } from 'vitest'
import {
  evidenceBundleFile,
  evidenceSha256,
  judgeEvidenceReport,
  verifyEvidenceBundle,
} from '../../../release/evidence-bundle'
import {
  amendmentFile,
  amendmentTag,
  validatePairingAmendment,
  verifyAmendmentEvidence,
} from '../../../release/pairing-amendment'
import {
  authorizationProblems,
  verifyAuthorization,
} from '../../../release/pairing-authorization'

const VERSION = '0.2.0-rc.8'
const HEX64 = 'a'.repeat(64)
const CORE_COMMIT = 'c'.repeat(40)
const UI_COMMIT = '2'.repeat(40)
const UI_TREE = '3'.repeat(40)
const APPROVAL_COMMIT = '4'.repeat(40)

const file = amendmentFile(VERSION)
const bundlePath = evidenceBundleFile(VERSION)

const REPORTS: Readonly<Record<string, string>> = {
  'core-registry-report': `${JSON.stringify({
    schema: 'zeus.core-registry-verification/v1',
    version: VERSION,
    checked: 32,
    exactVersion: 32,
    rcTag: 32,
    platformBinaries: 7,
    prereleaseLatestCount: 16,
    integrityRecorded: 32,
  })}\n`,
  'ui-candidate-report': `${JSON.stringify({
    schema: 'zeus.create-zeus-candidate/v2',
    coreVersion: VERSION,
    uiVersion: VERSION,
    templates: [{ template: 'basic-ts', pinMatch: true, passed: true }],
    passed: true,
  })}\n`,
  'template-acceptance': `${JSON.stringify({
    schema: 'zeus.template-acceptance/v1',
    version: VERSION,
    uiCommit: UI_COMMIT,
    templates: 6,
    passed: 6,
  })}\n`,
  'browser-acceptance': `${JSON.stringify({
    schema: 'zeus.browser-acceptance/v1',
    version: VERSION,
    uiCommit: UI_COMMIT,
    probes: 5,
    passed: 5,
  })}\n`,
  'ui-registry-preflight': `${JSON.stringify({
    schema: 'zeus-ui.publish-preflight/v1',
    version: VERSION,
    tag: 'rc',
    registry: 'https://registry.npmjs.org/',
    packages: [{ name: '@zeus-web/button', state: 'ABSENT' }],
    published: [],
    absent: Array.from({ length: 46 }, (_, index) => `@zeus-web/pkg-${index}`),
    failed: [],
    ok: true,
  })}\n`,
}

const SCHEMAS: Readonly<Record<string, string>> = {
  'core-registry-report': 'zeus.core-registry-verification/v1',
  'ui-candidate-report': 'zeus.create-zeus-candidate/v2',
  'template-acceptance': 'zeus.template-acceptance/v1',
  'browser-acceptance': 'zeus.browser-acceptance/v1',
  'ui-registry-preflight': 'zeus-ui.publish-preflight/v1',
}

function bundle(overrides: Record<string, unknown> = {}): string {
  return `${JSON.stringify(
    {
      schema: 'zeus.release-evidence-bundle/v1',
      version: VERSION,
      core: { version: VERSION, tag: `v${VERSION}`, commit: CORE_COMMIT },
      ui: {
        version: VERSION,
        commit: UI_COMMIT,
        tree: UI_TREE,
        lockfileSha256: HEX64,
      },
      reports: Object.entries(REPORTS).map(([id, content]) => ({
        id,
        schema: SCHEMAS[id],
        sha256: evidenceSha256(content),
        producer: {
          kind: 'workflow',
          repository: 'baicie/zeus',
          workflow: 'release.yml',
          runId: 46005757777,
          headSha: CORE_COMMIT,
        },
        sourceCommit: id === 'core-registry-report' ? CORE_COMMIT : UI_COMMIT,
        verdict: 'PASS',
        content,
      })),
      ...overrides,
    },
    null,
    2,
  )}\n`
}

function amendment(
  overrides: Record<string, unknown> = {},
  bundleRaw = bundle(),
): Record<string, unknown> {
  return {
    schema: 'zeus.pairing-amendment/v2',
    releaseTag: `v${VERSION}`,
    coreVersion: VERSION,
    coreCommit: CORE_COMMIT,
    uiVersion: VERSION,
    originalPairing: {
      uiCommit: '1'.repeat(40),
      recordSha256: HEX64,
    },
    replacement: {
      uiCommit: UI_COMMIT,
      uiTree: UI_TREE,
      lockfileSha256: HEX64,
    },
    authorization: {
      repository: 'baicie/zeus',
      pullRequest: 999,
      approver: 'baicie',
      reviewId: 4242,
      approvedCommit: APPROVAL_COMMIT,
      approvedAt: '2026-11-28T00:00:00.000Z',
    },
    evidence: {
      bundleSha256: evidenceSha256(bundleRaw),
      bundlePath,
      reports: Object.fromEntries(
        Object.entries(REPORTS).map(([id, content]) => [
          id,
          evidenceSha256(content),
        ]),
      ),
    },
    reason: 'the original candidate was never published',
    verifiedAt: '2026-11-28T00:00:00.000Z',
    ...overrides,
  }
}

const expectation: AmendmentExpectation = { version: VERSION }

const evidenceExpectation: EvidenceExpectation = {
  version: VERSION,
  coreVersion: VERSION,
  coreCommit: CORE_COMMIT,
  uiVersion: VERSION,
  uiCommit: UI_COMMIT,
  uiTree: UI_TREE,
  lockfileSha256: HEX64,
}

describe('amendment writer guards', () => {
  it('computes the path and tag the release looks for', () => {
    expect(file).toBe(`meta/release/pairing/amendments/v${VERSION}.json`)
    expect(amendmentTag(VERSION)).toBe(`pair-amendment/v${VERSION}`)
    expect(bundlePath).toBe(`meta/release/evidence/v${VERSION}/bundle.json`)
  })

  it('accepts a well-formed amendment', () => {
    expect(validatePairingAmendment(amendment(), file, expectation)).toEqual([])
  })

  it('refuses an amendment that would replace a candidate with itself', () => {
    const problems = validatePairingAmendment(
      amendment({
        replacement: {
          uiCommit: '1'.repeat(40),
          uiTree: UI_TREE,
          lockfileSha256: HEX64,
        },
      }),
      file,
      expectation,
    )
    expect(problems.map(p => p.message).join(' ')).toMatch(
      /direct pair, not an amendment/,
    )
  })

  it('refuses an amendment whose replacement has no lockfile digest', () => {
    /*
     * The field is what closed the fail-open: without it there is nothing to
     * compare, and v1's reader read that absence as a pass.
     */
    const problems = validatePairingAmendment(
      amendment({
        replacement: { uiCommit: UI_COMMIT, uiTree: UI_TREE },
      }),
      file,
      expectation,
    )
    expect(problems.map(p => p.message).join(' ')).toMatch(
      /replacement\.lockfileSha256/,
    )
  })

  it('refuses an amendment with no evidence report digests', () => {
    const problems = validatePairingAmendment(
      amendment({
        evidence: {
          bundleSha256: HEX64,
          bundlePath,
          reports: { 'core-registry-report': HEX64 },
        },
      }),
      file,
      expectation,
    )
    expect(problems.map(p => p.message).join(' ')).toMatch(
      /evidence\.reports\.ui-candidate-report/,
    )
  })

  it('refuses an amendment whose authorization names no specific review', () => {
    const problems = validatePairingAmendment(
      amendment({
        authorization: {
          repository: 'baicie/zeus',
          pullRequest: 999,
          approver: 'baicie',
          reviewId: 0,
          approvedCommit: 'not-a-sha',
          approvedAt: '2026-11-28T00:00:00.000Z',
        },
      }),
      file,
      expectation,
    )
    const messages = problems.map(p => p.message).join(' ')
    expect(messages).toMatch(/authorization\.reviewId/)
    expect(messages).toMatch(/authorization\.approvedCommit/)
  })

  it('refuses an amendment filed under another version', () => {
    const problems = validatePairingAmendment(
      amendment(),
      amendmentFile('0.2.0-rc.9'),
      expectation,
    )
    expect(problems.map(p => p.message).join(' ')).toMatch(/file name must be/)
  })
})

describe('the evidence bundle must describe this release', () => {
  it('accepts the bundle the amendment pins', () => {
    expect(
      verifyAmendmentEvidence(
        amendment() as never,
        bundle(),
        bundlePath,
        evidenceExpectation,
      ),
    ).toEqual([])
  })

  it('refuses a bundle whose digest the amendment does not record', () => {
    const problems = verifyAmendmentEvidence(
      amendment({
        evidence: {
          bundleSha256: HEX64,
          bundlePath,
          reports: {},
        },
      }) as never,
      bundle(),
      bundlePath,
      evidenceExpectation,
    )
    expect(problems.map(p => p.message).join(' ')).toMatch(
      /bundleSha256 .* hashes to/,
    )
  })

  it('refuses a bundle built for another UI commit', () => {
    const other = bundle({
      ui: {
        version: VERSION,
        commit: '9'.repeat(40),
        tree: UI_TREE,
        lockfileSha256: HEX64,
      },
    })
    const problems = verifyAmendmentEvidence(
      amendment({}, other) as never,
      other,
      bundlePath,
      evidenceExpectation,
    )
    expect(problems.map(p => p.message).join(' ')).toMatch(/ui\.commit is/)
  })

  it('refuses a bundle built for another Core commit', () => {
    const other = bundle({
      core: { version: VERSION, tag: `v${VERSION}`, commit: '9'.repeat(40) },
    })
    const problems = verifyAmendmentEvidence(
      amendment({}, other) as never,
      other,
      bundlePath,
      evidenceExpectation,
    )
    expect(problems.map(p => p.message).join(' ')).toMatch(/core\.commit is/)
  })

  it('refuses a bundle with a different lockfile digest', () => {
    const other = bundle({
      ui: {
        version: VERSION,
        commit: UI_COMMIT,
        tree: UI_TREE,
        lockfileSha256: 'b'.repeat(64),
      },
    })
    const problems = verifyAmendmentEvidence(
      amendment({}, other) as never,
      other,
      bundlePath,
      evidenceExpectation,
    )
    expect(problems.map(p => p.message).join(' ')).toMatch(
      /ui\.lockfileSha256 is/,
    )
  })

  it('refuses a bundle that omits a report', () => {
    const parsed = JSON.parse(bundle()) as {
      reports: Array<{ id: string }>
    }
    parsed.reports = parsed.reports.filter(
      item => item.id !== 'browser-acceptance',
    )
    const raw = `${JSON.stringify(parsed, null, 2)}\n`
    const problems = verifyEvidenceBundle(
      JSON.parse(raw),
      bundlePath,
      evidenceExpectation,
    )
    expect(problems.map(p => p.message).join(' ')).toMatch(
      /report browser-acceptance is missing/,
    )
  })

  it('refuses a report whose recorded digest is not its bytes', () => {
    const parsed = JSON.parse(bundle()) as {
      reports: Array<{ id: string; sha256: string }>
    }
    parsed.reports[0]!.sha256 = HEX64
    const problems = verifyEvidenceBundle(
      parsed,
      bundlePath,
      evidenceExpectation,
    )
    expect(problems.map(p => p.message).join(' ')).toMatch(/hashes to/)
  })

  it('refuses a report filed under the wrong subject commit', () => {
    const parsed = JSON.parse(bundle()) as {
      reports: Array<{ id: string; sourceCommit: string }>
    }
    const entry = parsed.reports.find(
      item => item.id === 'template-acceptance',
    )!
    entry.sourceCommit = '9'.repeat(40)
    const problems = verifyEvidenceBundle(
      parsed,
      bundlePath,
      evidenceExpectation,
    )
    expect(problems.map(p => p.message).join(' ')).toMatch(
      /sourceCommit is 9{40}/,
    )
  })

  it('refuses a workflow producer with no run id', () => {
    const parsed = JSON.parse(bundle()) as {
      reports: Array<{ producer: Record<string, unknown> }>
    }
    delete parsed.reports[0]!.producer.runId
    const problems = verifyEvidenceBundle(
      parsed,
      bundlePath,
      evidenceExpectation,
    )
    expect(problems.map(p => p.message).join(' ')).toMatch(/runId/)
  })

  it('refuses a local producer that does not say how to reproduce it', () => {
    const parsed = JSON.parse(bundle()) as {
      reports: Array<{ producer: Record<string, unknown> }>
    }
    parsed.reports[0]!.producer = {
      kind: 'local',
      repository: 'baicie/zeus',
    }
    const problems = verifyEvidenceBundle(
      parsed,
      bundlePath,
      evidenceExpectation,
    )
    expect(problems.map(p => p.message).join(' ')).toMatch(/command/)
  })
})

describe('a report is judged on its own numbers', () => {
  it('fails a registry report that checked nothing', () => {
    const judged = judgeEvidenceReport(
      'core-registry-report',
      JSON.stringify({
        schema: 'zeus.core-registry-verification/v1',
        version: VERSION,
        checked: 0,
        exactVersion: 0,
        rcTag: 0,
        integrityRecorded: 0,
        platformBinaries: 0,
      }),
      evidenceExpectation,
    )
    expect(judged.verdict).toBe('FAIL')
  })

  it('fails a registry report missing a platform binary', () => {
    const judged = judgeEvidenceReport(
      'core-registry-report',
      JSON.stringify({
        schema: 'zeus.core-registry-verification/v1',
        version: VERSION,
        checked: 32,
        exactVersion: 32,
        rcTag: 31,
        integrityRecorded: 32,
        platformBinaries: 7,
      }),
      evidenceExpectation,
    )
    expect(judged.verdict).toBe('FAIL')
    expect(judged.problems.join(' ')).toMatch(/rcTag is 31, expected 32/)
  })

  it('fails a template acceptance that skipped a template', () => {
    const judged = judgeEvidenceReport(
      'template-acceptance',
      JSON.stringify({
        schema: 'zeus.template-acceptance/v1',
        version: VERSION,
        uiCommit: UI_COMMIT,
        templates: 6,
        passed: 5,
      }),
      evidenceExpectation,
    )
    expect(judged.verdict).toBe('FAIL')
  })

  it('fails a preflight that found packages already published', () => {
    /*
     * Read from the shape the producer actually emits: `published`,
     * `absent`, `failed` and `ok`. A partial publish is the one state that
     * must never be published over, so a non-empty `published` is a refusal
     * even when `ok` was computed from `failed` alone.
     */
    const judged = judgeEvidenceReport(
      'ui-registry-preflight',
      JSON.stringify({
        schema: 'zeus-ui.publish-preflight/v1',
        version: VERSION,
        packages: [],
        published: ['@zeus-web/button', '@zeus-web/input', '@zeus-web/badge'],
        absent: Array.from({ length: 43 }, (_, index) => `p${index}`),
        failed: [],
        ok: true,
      }),
      evidenceExpectation,
    )
    expect(judged.verdict).toBe('FAIL')
    expect(judged.problems.join(' ')).toMatch(
      /3 package\(s\) were already published: @zeus-web\/button/,
    )
  })

  it('fails a preflight that could not query every package', () => {
    const judged = judgeEvidenceReport(
      'ui-registry-preflight',
      JSON.stringify({
        schema: 'zeus-ui.publish-preflight/v1',
        version: VERSION,
        packages: [],
        published: [],
        absent: ['@zeus-web/button'],
        failed: ['@zeus-web/input'],
        ok: false,
      }),
      evidenceExpectation,
    )
    expect(judged.verdict).toBe('FAIL')
    expect(judged.problems.join(' ')).toMatch(/could not be queried/)
  })

  it('fails a candidate report whose template did not match its pins', () => {
    const judged = judgeEvidenceReport(
      'ui-candidate-report',
      JSON.stringify({
        schema: 'zeus.create-zeus-candidate/v2',
        coreVersion: VERSION,
        uiVersion: VERSION,
        templates: [{ template: 'basic-ts', pinMatch: false, passed: true }],
        passed: true,
      }),
      evidenceExpectation,
    )
    expect(judged.verdict).toBe('FAIL')
    expect(judged.problems.join(' ')).toMatch(/did not match its pins/)
  })

  it('fails a report filed under the wrong schema', () => {
    const judged = judgeEvidenceReport(
      'browser-acceptance',
      JSON.stringify({ schema: 'zeus.template-acceptance/v1' }),
      evidenceExpectation,
    )
    expect(judged.verdict).toBe('FAIL')
    expect(judged.problems.join(' ')).toMatch(/schema is/)
  })
})

describe('an approval is checked against GitHub', () => {
  const claim = {
    repository: 'baicie/zeus',
    pullRequest: 999,
    approver: 'baicie',
    reviewId: 4242,
    approvedCommit: APPROVAL_COMMIT,
    approvedAt: '2026-11-28T00:00:00.000Z',
  }

  const facts = {
    merged: true,
    headSha: APPROVAL_COMMIT,
    review: {
      id: 4242,
      login: 'baicie',
      state: 'APPROVED',
      commitId: APPROVAL_COMMIT,
      submittedAt: '2026-11-28T00:00:00.000Z',
    },
    permission: 'admin',
  }

  it('accepts an approval of this commit by a maintainer', () => {
    expect(
      verifyAuthorization(claim, { state: 'FOUND', facts }, APPROVAL_COMMIT),
    ).toEqual([])
  })

  it('refuses an approval whose pull request is not merged', () => {
    expect(
      verifyAuthorization(
        claim,
        { state: 'FOUND', facts: { ...facts, merged: false } },
        APPROVAL_COMMIT,
      ).join(' '),
    ).toMatch(/is not merged/)
  })

  it('refuses a review that was dismissed or changed', () => {
    expect(
      verifyAuthorization(
        claim,
        {
          state: 'FOUND',
          facts: { ...facts, review: { ...facts.review, state: 'DISMISSED' } },
        },
        APPROVAL_COMMIT,
      ).join(' '),
    ).toMatch(/is DISMISSED, not APPROVED/)
  })

  it('refuses an approval attributed to someone else', () => {
    expect(
      verifyAuthorization(
        claim,
        {
          state: 'FOUND',
          facts: { ...facts, review: { ...facts.review, login: 'someone' } },
        },
        APPROVAL_COMMIT,
      ).join(' '),
    ).toMatch(/submitted by someone, not baicie/)
  })

  it('refuses an approval by a reader', () => {
    expect(
      verifyAuthorization(
        claim,
        { state: 'FOUND', facts: { ...facts, permission: 'read' } },
        APPROVAL_COMMIT,
      ).join(' '),
    ).toMatch(/write access or better/)
  })

  it('refuses an approval given for older bytes', () => {
    expect(
      verifyAuthorization(
        claim,
        {
          state: 'FOUND',
          facts: {
            ...facts,
            review: { ...facts.review, commitId: '9'.repeat(40) },
          },
        },
        APPROVAL_COMMIT,
      ).join(' '),
    ).toMatch(/approval covers different bytes/)
  })

  it('refuses a recorded timestamp that GitHub did not record', () => {
    expect(
      verifyAuthorization(
        { ...claim, approvedAt: '2026-01-01T00:00:00.000Z' },
        { state: 'FOUND', facts },
        APPROVAL_COMMIT,
      ).join(' '),
    ).toMatch(/GitHub recorded the approval at/)
  })

  it('refuses when the approval cannot be looked up', () => {
    expect(
      verifyAuthorization(
        claim,
        { state: 'ERROR', message: 'HTTP 502' },
        APPROVAL_COMMIT,
      ).join(' '),
    ).toMatch(/could not verify the approval/)
  })

  it('refuses when the approval does not exist', () => {
    expect(
      verifyAuthorization(
        claim,
        { state: 'MISSING', message: 'review 4242 does not exist' },
        APPROVAL_COMMIT,
      ).join(' '),
    ).toMatch(/does not exist/)
  })

  it('refuses a structurally impossible claim before asking GitHub', () => {
    expect(authorizationProblems({ ...claim, reviewId: 0 }).join(' ')).toMatch(
      /reviewId must be a review id/,
    )
  })
})
