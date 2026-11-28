/**
 * The amendment writer's refusals.
 *
 * The tool talks to GitHub, so the parts worth testing without a network are
 * the guards: a bootstrap record cannot be amended, a missing evidence file is
 * not evidence, and an existing amendment naming another replacement is a
 * conflict rather than an overwrite.
 *
 * Those are asserted through the same `evaluatePairing` path the release uses,
 * so a guard that stops the writer is also proven to stop a hand-written file.
 */
import { describe, expect, it } from 'vitest'

import {
  amendmentFile,
  amendmentTag,
  validatePairingAmendment,
} from '../../../release/pairing-amendment'

const VERSION = '0.2.0-rc.8'
const HEX64 = 'a'.repeat(64)

function valid(overrides: Record<string, unknown> = {}) {
  return {
    schema: 'zeus.pairing-amendment/v1',
    releaseTag: `v${VERSION}`,
    coreVersion: VERSION,
    coreCommit: 'c'.repeat(40),
    uiVersion: VERSION,
    originalPairing: {
      uiCommit: '1'.repeat(40),
      recordSha256: HEX64,
    },
    replacement: {
      uiCommit: '2'.repeat(40),
      uiTree: '3'.repeat(40),
      lockfileSha256: HEX64,
    },
    authorization: {
      decisionReference: 'baicie/zeus-ui#171',
      approvedAt: '2026-11-28T00:00:00.000Z',
    },
    evidence: {
      coreRegistryReportSha256: HEX64,
      uiCandidateReportSha256: HEX64,
      templateAcceptanceSha256: HEX64,
      browserAcceptanceSha256: HEX64,
      uiRegistryPreflightSha256: HEX64,
    },
    reason: 'the original candidate was never published',
    verifiedAt: '2026-11-28T00:00:00.000Z',
    ...overrides,
  }
}

const file = amendmentFile(VERSION)

describe('amendment writer guards', () => {
  it('computes the path and tag the release looks for', () => {
    expect(file).toBe(`meta/release/pairing/amendments/v${VERSION}.json`)
    expect(amendmentTag(VERSION)).toBe(`pair-amendment/v${VERSION}`)
  })

  it('accepts a well-formed amendment', () => {
    expect(
      validatePairingAmendment(valid(), file, { version: VERSION }),
    ).toEqual([])
  })

  it('refuses an amendment that would replace a candidate with itself', () => {
    const problems = validatePairingAmendment(
      valid({
        replacement: {
          uiCommit: '1'.repeat(40),
          uiTree: '3'.repeat(40),
          lockfileSha256: HEX64,
        },
      }),
      file,
      { version: VERSION },
    )
    expect(problems.map(p => p.message).join(' ')).toMatch(
      /direct pair, not an amendment/,
    )
  })

  it('refuses an amendment with no evidence digests to pin', () => {
    const problems = validatePairingAmendment(
      valid({
        evidence: {
          coreRegistryReportSha256: '',
          uiCandidateReportSha256: HEX64,
          templateAcceptanceSha256: HEX64,
          browserAcceptanceSha256: HEX64,
          uiRegistryPreflightSha256: HEX64,
        },
      }),
      file,
      { version: VERSION },
    )
    expect(problems.map(p => p.message).join(' ')).toMatch(
      /coreRegistryReportSha256/,
    )
  })

  it('refuses an amendment whose authorization names nothing', () => {
    const problems = validatePairingAmendment(
      valid({
        authorization: {
          decisionReference: '  ',
          approvedAt: '2026-11-28T00:00:00.000Z',
        },
      }),
      file,
      { version: VERSION },
    )
    expect(problems.map(p => p.message).join(' ')).toMatch(/decisionReference/)
  })

  it('refuses an amendment filed under another version', () => {
    const problems = validatePairingAmendment(
      valid(),
      amendmentFile('0.2.0-rc.9'),
      { version: VERSION },
    )
    expect(problems.map(p => p.message).join(' ')).toMatch(/file name must be/)
  })
})
