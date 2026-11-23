import type { ReleaseIdentity } from '../../../release/release-protocol'

/**
 * Release Protocol v2: the three channels and the four scenarios.
 *
 * These replace v1's "fails when the Core version differs from the UI version",
 * which asserted the defect. Core and UI release on separate version lines —
 * today Core is 0.2.0-rc.5 and UI is 0.1.0-beta.35 — so a check that requires
 * the strings to match refuses every real release.
 *
 * The contract that does pair them: a UI release names the Core version it was
 * verified against, and for rc/latest also the immutable Core commit.
 */
import { describe, expect, it } from 'vitest'

import {
  channelRule,
  coreTagFor,
  planPairing,
} from '../../../release/release-protocol'

const CORE_RC5 = '0.2.0-rc.5'
const UI_BETA35 = '0.1.0-beta.35'
const CORE_COMMIT = 'a'.repeat(40)
const UI_COMMIT = 'b'.repeat(40)

function identity(overrides: Partial<ReleaseIdentity> = {}): ReleaseIdentity {
  return {
    uiVersion: UI_BETA35,
    coreVersion: CORE_RC5,
    uiCommit: UI_COMMIT,
    coreCommit: CORE_COMMIT,
    ...overrides,
  }
}

describe('the real version pair is accepted', () => {
  it('accepts Core 0.2.0-rc.5 with UI 0.1.0-beta.35', () => {
    // The exact combination v1 rejected with "one version line".
    const plan = planPairing(identity())

    expect(plan.ok).toBe(true)
    expect(plan.channel).toBe('beta')
    expect(plan.coreTag).toBe('v0.2.0-rc.5')
  })

  it('allows the two lines to coincide without deriving one from the other', () => {
    const plan = planPairing(
      identity({ uiVersion: '0.2.0-rc.5', coreVersion: '0.2.0-rc.5' }),
    )

    expect(plan.ok).toBe(true)
    expect(plan.channel).toBe('rc')
  })
})

describe('coreVersion is required, never defaulted', () => {
  it('refuses an empty Core version instead of assuming the UI one', () => {
    const plan = planPairing(identity({ coreVersion: '' }))

    expect(plan.ok).toBe(false)
    expect(plan.errors.join(' ')).toMatch(/must name the Core version/)
  })

  it('refuses a Core version that is not an exact version', () => {
    const plan = planPairing(identity({ coreVersion: 'latest' }))

    expect(plan.ok).toBe(false)
    expect(plan.errors.join(' ')).toMatch(/not an exact version/)
  })
})

describe('the static half never demands a commit', () => {
  it('an rc plan without commits passes offline', () => {
    // A pull request runs the static half; the Core tag may not exist yet.
    const plan = planPairing(
      identity({ uiVersion: '0.2.0-rc.6', uiCommit: null, coreCommit: null }),
    )

    expect(plan.ok).toBe(true)
    expect(plan.coreTag).toBe('v0.2.0-rc.5')
  })
})

describe('beta: the pre-contract channel', () => {
  it('needs no Core commit and no pairing record', () => {
    const plan = planPairing(identity({ uiCommit: null, coreCommit: null }))

    expect(plan.ok).toBe(true)
    expect(plan.rule?.requiresPairing).toBe(false)
    expect(plan.rule?.rationale).toMatch(/pre-contract/)
  })

  it('still names the Core tag it targets', () => {
    const plan = planPairing(identity({ coreCommit: null }))

    expect(plan.coreTag).toBe('v0.2.0-rc.5')
  })
})

describe('rc: a named immutable Core commit', () => {
  const rc = { uiVersion: '0.2.0-rc.6' }

  it('requires a Core commit in the online half', () => {
    const plan = planPairing(identity({ ...rc, coreCommit: null }), {
      online: true,
    })

    expect(plan.ok).toBe(false)
    expect(plan.errors.join(' ')).toMatch(/requires the Core commit/)
  })

  it('requires a UI commit in the online half', () => {
    const plan = planPairing(identity({ ...rc, uiCommit: null }), {
      online: true,
    })

    expect(plan.ok).toBe(false)
    expect(plan.errors.join(' ')).toMatch(/requires the UI release commit/)
  })

  it('rejects a short Core commit', () => {
    const plan = planPairing(identity({ ...rc, coreCommit: 'abc123' }), {
      online: true,
    })

    expect(plan.ok).toBe(false)
    expect(plan.errors.join(' ')).toMatch(/not a full 40-character SHA/)
  })

  it('allows bootstrap for a version line’s first publication', () => {
    expect(channelRule('rc').allowsBootstrap).toBe(true)
  })

  it('passes with both commits', () => {
    const plan = planPairing(identity({ ...rc }))

    expect(plan.ok).toBe(true)
    expect(plan.coreTag).toBe('v0.2.0-rc.5')
  })
})

describe('latest: stable, and never a bootstrap', () => {
  it('requires a Core commit in the online half', () => {
    const plan = planPairing(
      identity({ uiVersion: '0.2.0', coreVersion: '0.2.0', coreCommit: null }),
      { online: true },
    )

    expect(plan.ok).toBe(false)
  })

  it('refuses bootstrap', () => {
    expect(channelRule('latest').allowsBootstrap).toBe(false)
  })
})

describe('the Core tag comes from the Core version, never the UI version', () => {
  it('builds v<coreVersion>', () => {
    expect(coreTagFor('0.2.0-rc.5')).toBe('v0.2.0-rc.5')
  })

  it('does not use the UI version for the Core tag', () => {
    // The v1 dispatch looked up `v$VERSION` where VERSION was the UI version,
    // which is a Core tag that cannot exist.
    const plan = planPairing(identity())

    expect(plan.coreTag).not.toBe(`v${UI_BETA35}`)
  })
})

describe('scenario: first publication', () => {
  it('beta first publish needs only the Core version', () => {
    const plan = planPairing(
      identity({ uiVersion: '0.3.0-beta.0', coreCommit: null, uiCommit: null }),
    )

    expect(plan.ok).toBe(true)
  })
})

describe('scenario: failure recovery', () => {
  it('a re-cut version plans the same way as the original', () => {
    const original = planPairing(identity({ uiVersion: '0.1.0-beta.35' }))
    const recut = planPairing(identity({ uiVersion: '0.1.0-beta.36' }))

    expect(original.ok).toBe(true)
    expect(recut.ok).toBe(true)
    expect(recut.coreTag).toBe(original.coreTag)
  })
})

describe('scenario: repeated dispatch', () => {
  it('the same inputs always produce the same plan', () => {
    const a = planPairing(identity())
    const b = planPairing(identity())

    expect(a).toEqual(b)
  })
})

describe('scenario: version mismatch', () => {
  it('an unknown prerelease identifier is refused', () => {
    const plan = planPairing(identity({ uiVersion: '0.1.0-preview.1' }))

    expect(plan.ok).toBe(false)
    expect(plan.errors.join(' ')).toMatch(/Cannot derive a release channel/)
  })

  it('a UI version with no Core version fails before any network call', () => {
    const plan = planPairing(identity({ coreVersion: '' }))

    expect(plan.ok).toBe(false)
    expect(plan.coreTag).toBeUndefined()
  })
})
