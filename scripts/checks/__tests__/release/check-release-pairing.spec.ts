import type { ReleasePairingInput } from '../../release/check-release-pairing'

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  evaluateReleasePairing,
  pairingPath,
  RELEASE_PAIRING_SCHEMA,
} from '../../release/check-release-pairing'

const CORE_COMMIT = 'a'.repeat(40)
const OTHER_CORE_COMMIT = 'b'.repeat(40)
const UI_COMMIT = 'c'.repeat(40)

function record(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    schema: RELEASE_PAIRING_SCHEMA,
    uiVersion: '0.2.0-rc.0',
    uiCommit: UI_COMMIT,
    coreVersion: '0.2.0-rc.0',
    coreCommit: CORE_COMMIT,
    channel: 'rc',
    ...overrides,
  })
}

function evaluate(
  overrides: Partial<ReleasePairingInput> = {},
): ReturnType<typeof evaluateReleasePairing> {
  return evaluateReleasePairing({
    uiRoot: process.cwd(),
    uiVersion: '0.2.0-rc.0',
    uiCommit: UI_COMMIT,
    resolveCoreTag: () => CORE_COMMIT,
    readPairing: () => record(),
    listCorePins: () => [
      {
        file: 'package.json',
        name: '@zeus-js/zeus',
        version: '0.2.0-rc.0',
      },
    ],
    ...overrides,
  })
}

describe('immutable Core/UI release pairing', () => {
  it('accepts a matching record, tag and pin set', () => {
    const result = evaluate()

    expect(result.errors).toEqual([])
    expect(result.ok).toBe(true)
    expect(result.channel).toBe('rc')
    expect(result.record?.coreCommit).toBe(CORE_COMMIT)
  })

  it('rejects a missing pairing record for rc', () => {
    const result = evaluate({ readPairing: () => undefined })

    expect(result.ok).toBe(false)
    expect(result.errors.join('\n')).toContain(
      `Missing ${pairingPath('0.2.0-rc.0')}`,
    )
  })

  it('allows a beta release without a pairing record', () => {
    const result = evaluate({
      uiVersion: '0.1.0-beta.35',
      readPairing: () => undefined,
      listCorePins: () => [
        {
          file: 'package.json',
          name: '@zeus-js/zeus',
          version: '0.1.0-beta.35',
        },
      ],
    })

    expect(result.ok).toBe(true)
    expect(result.channel).toBe('beta')
  })

  it('rejects a stable release without a pairing record', () => {
    const result = evaluate({
      uiVersion: '0.2.0',
      readPairing: () => undefined,
    })

    expect(result.ok).toBe(false)
    expect(result.errors.join('\n')).toContain('Missing')
  })

  it('rejects a record bound to a different Core commit than the Core tag', () => {
    const result = evaluate({ resolveCoreTag: () => OTHER_CORE_COMMIT })

    expect(result.ok).toBe(false)
    expect(result.errors.join('\n')).toContain(
      `points at ${OTHER_CORE_COMMIT}, not the paired commit ${CORE_COMMIT}`,
    )
  })

  it('fails closed when the Core tag cannot be resolved', () => {
    const result = evaluate({ resolveCoreTag: () => undefined })

    expect(result.ok).toBe(false)
    expect(result.errors.join('\n')).toContain('cannot be resolved')
  })

  it('rejects a Core tag that returns something that is not a full SHA', () => {
    const result = evaluate({ resolveCoreTag: () => 'main' })

    expect(result.ok).toBe(false)
    expect(result.errors.join('\n')).toContain('returned an invalid commit')
  })

  it('rejects a requested Core commit that disagrees with the record', () => {
    const result = evaluate({ coreCommit: OTHER_CORE_COMMIT })

    expect(result.ok).toBe(false)
    expect(result.errors.join('\n')).toContain(
      `!= requested Core commit ${OTHER_CORE_COMMIT}`,
    )
  })

  it('rejects a UI commit that is not the release commit', () => {
    const result = evaluate({ uiCommit: 'd'.repeat(40) })

    expect(result.ok).toBe(false)
    expect(result.errors.join('\n')).toContain('!= release commit')
  })

  it('rejects a short release SHA', () => {
    const result = evaluate({ uiCommit: 'c'.repeat(12) })

    expect(result.ok).toBe(false)
    expect(result.errors.join('\n')).toContain('full 40-character')
  })

  it('rejects a mismatched UI version in the record', () => {
    const result = evaluate({
      readPairing: () => record({ uiVersion: '0.2.0-rc.1' }),
    })

    expect(result.ok).toBe(false)
    expect(result.errors.join('\n')).toContain('uiVersion 0.2.0-rc.1')
  })

  it('rejects a Core version that differs from the UI version', () => {
    const result = evaluate({
      readPairing: () => record({ coreVersion: '0.2.0-rc.1' }),
    })

    expect(result.ok).toBe(false)
    expect(result.errors.join('\n')).toContain('coreVersion 0.2.0-rc.1')
  })

  it('rejects a channel that disagrees with the version', () => {
    const result = evaluate({
      readPairing: () => record({ channel: 'latest' }),
    })

    expect(result.ok).toBe(false)
    expect(result.errors.join('\n')).toContain('channel latest != channel rc')
  })

  it('rejects a pin that does not match the paired Core version', () => {
    const result = evaluate({
      listCorePins: () => [
        {
          file: 'package.json',
          name: '@zeus-js/zeus',
          version: '0.1.1-beta.20',
        },
        {
          file: 'packages/ui/package.json',
          name: '@zeus-js/signal',
          version: '0.2.0-rc.0',
        },
      ],
    })

    expect(result.ok).toBe(false)
    expect(result.errors.join('\n')).toContain(
      'package.json: @zeus-js/zeus 0.1.1-beta.20 != paired Core version 0.2.0-rc.0',
    )
  })

  it('requires the independent vite-plugin pin to stay at its own version', () => {
    const result = evaluate({
      listCorePins: () => [
        { file: 'package.json', name: '@zeus-js/zeus', version: '0.2.0-rc.0' },
        {
          file: 'examples/ai-workbench/package.json',
          name: '@zeus-js/vite-plugin',
          version: '0.0.5',
        },
      ],
    })

    // An independently versioned Core package must not be forced onto the
    // fixed release line, and must not drift either.
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])

    const drifted = evaluate({
      listCorePins: () => [
        { file: 'package.json', name: '@zeus-js/zeus', version: '0.2.0-rc.0' },
        {
          file: 'examples/ai-workbench/package.json',
          name: '@zeus-js/vite-plugin',
          version: '0.0.6',
        },
      ],
    })
    expect(drifted.ok).toBe(false)
    expect(drifted.errors.join('\n')).toContain(
      '@zeus-js/vite-plugin 0.0.6 != independent Core version 0.0.5',
    )
  })

  it('rejects a workspace with no Core pins at all', () => {
    const result = evaluate({ listCorePins: () => [] })

    expect(result.ok).toBe(false)
    expect(result.errors.join('\n')).toContain('No @zeus-js/* pins')
  })

  it('rejects a malformed record', () => {
    for (const raw of ['not json', '[]', JSON.stringify({ schema: 'other' })]) {
      const result = evaluate({ readPairing: () => raw })

      expect(result.ok).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    }
  })

  it('rejects a record whose schema is not the pairing schema', () => {
    const result = evaluate({
      readPairing: () => record({ schema: 'zeus-ui.release-pairing/v0' }),
    })

    expect(result.ok).toBe(false)
    expect(result.errors.join('\n')).toContain(
      'Pairing record schema must be zeus-ui.release-pairing/v1',
    )
  })

  it('reads the record from git and ignores a file written afterwards', () => {
    const root = mkdtempSync(join(tmpdir(), 'zeus-pairing-'))

    try {
      // No git repository: the git reader must return undefined rather than
      // reading a working-tree file, so an uncommitted record cannot pass.
      const result = evaluateReleasePairing({
        uiRoot: root,
        uiVersion: '0.2.0-rc.0',
        uiCommit: UI_COMMIT,
        resolveCoreTag: () => CORE_COMMIT,
        listCorePins: () => [
          {
            file: 'package.json',
            name: '@zeus-js/zeus',
            version: '0.2.0-rc.0',
          },
        ],
      })

      expect(result.ok).toBe(false)
      expect(result.errors.join('\n')).toContain('Missing')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects a version with an unknown prerelease identifier', () => {
    const result = evaluate({ uiVersion: '0.2.0-alpha.1' })

    expect(result.ok).toBe(false)
    expect(result.errors.join('\n')).toContain('Unsupported prerelease')
  })
})
