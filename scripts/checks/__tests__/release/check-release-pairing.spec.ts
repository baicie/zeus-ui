import type { OnlinePairingInput } from '../../release/check-release-pairing'
/**
 * The Core-anchored pairing protocol, tested against real git commits.
 *
 * ## Why these use a real repository
 *
 * The previous protocol's tests all passed while the protocol was impossible to
 * satisfy. Every case supplied its own `uiCommit` and its own record, so the
 * self-reference — a commit writing its own SHA into itself — could not appear.
 * Mocking the inputs is exactly what hid the defect.
 *
 * So the constructibility test builds two throwaway git repositories, commits a
 * UI candidate, then commits Core's record naming that candidate's real SHA,
 * and asks the checker whether the pair verifies. If the protocol cannot be
 * constructed that way, the test fails.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'

import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'
import {
  buildPairingReport,
  compareExpectedCoreCommit,
  CORE_PAIRING_SCHEMA,
  evaluatePairing,
  evaluateStatic,
  listCorePins,
} from '../../release/check-release-pairing'

const VERSION = '0.2.0-rc.0'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

function temporary(prefix: string): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  roots.push(directory)
  return directory
}

/** A UI tree with one package pinning Core at `version`. */
function uiTree(version = VERSION, pins: Record<string, string> = {}): string {
  const root = temporary('zeus-ui-pairing-')
  fs.mkdirSync(path.join(root, 'packages/primitives/button'), {
    recursive: true,
  })
  fs.writeFileSync(
    path.join(root, 'packages/primitives/button/package.json'),
    `${JSON.stringify(
      {
        name: '@zeus-web/button',
        version,
        dependencies: {
          '@zeus-js/runtime-dom': version,
          '@zeus-js/vite-plugin': '0.0.5',
          ...pins,
        },
        peerDependencies: { '@zeus-js/zeus': version },
      },
      null,
      2,
    )}\n`,
  )
  return root
}

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
}

function initRepo(directory: string): void {
  git(directory, ['init', '-q'])
  git(directory, ['config', 'user.email', 'test@example.com'])
  git(directory, ['config', 'user.name', 'test'])
}

function coreRecord(overrides: Record<string, unknown> = {}): string {
  return `${JSON.stringify(
    {
      schema: CORE_PAIRING_SCHEMA,
      coreVersion: VERSION,
      uiCommit: 'a'.repeat(40),
      uiVersion: VERSION,
      verifiedAt: '2026-11-16T00:00:00.000Z',
      ...overrides,
    },
    null,
    2,
  )}\n`
}

/** A full online input with the network replaced by explicit answers. */
function onlineInput(
  overrides: Partial<OnlinePairingInput> = {},
): OnlinePairingInput {
  const uiCommit = 'c'.repeat(40)
  return {
    uiRoot: uiTree(),
    uiVersion: VERSION,
    /*
     * Required since Protocol v2: the Core version is its own input and is
     * never defaulted from the UI version. Here the two coincide, which v2
     * allows.
     */
    coreVersion: VERSION,
    uiCommit,
    resolveCoreTag: () => 'd'.repeat(40),
    readCoreFile: () => coreRecord({ uiCommit }),
    ...overrides,
  }
}

/*
 * The half that runs in a pull request. It must not need a Core tag, because
 * the tag does not exist until after the Core release, which is after this PR.
 */
describe('static checks need no network', () => {
  it('passes a tree whose pins match the version line', () => {
    const result = evaluateStatic({
      uiRoot: uiTree(),
      uiVersion: VERSION,
      coreVersion: VERSION,
    })
    expect(result.errors).toEqual([])
    expect(result.ok).toBe(true)
    expect(result.channel).toBe('rc')
  })

  it('fails a pinned package at the wrong version, without asking GitHub', () => {
    const result = evaluateStatic({
      uiRoot: uiTree(VERSION, { '@zeus-js/router': '0.1.1-beta.20' }),
      uiVersion: VERSION,
      coreVersion: VERSION,
    })
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/@zeus-js\/router/)
  })

  /*
   * Protocol v2 reversed this assertion.
   *
   * v1 required `coreVersion === uiVersion` and this test pinned that as
   * correct. Core and UI are separate version lines — Core is 0.2.0-rc.5, UI
   * is 0.1.0-beta.35 — so the requirement rejected every real release. What
   * the check must do instead is hold the pins to the Core version the release
   * names.
   *
   * The fixture's pins are at VERSION, so naming a different Core version is
   * a pin mismatch. The message must say *that*, not "one version line".
   */
  it('holds the pins to the Core version the release names', () => {
    const result = evaluateStatic({
      uiRoot: uiTree(),
      uiVersion: VERSION,
      coreVersion: '0.2.0',
    })

    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/paired Core version 0\.2\.0/)
    expect(result.errors.join(' ')).not.toMatch(/one version line/)
  })

  it('accepts a Core version that differs from the UI version when pins match', () => {
    // The real pair: UI on its own line, pins on Core's.
    const result = evaluateStatic({
      uiRoot: uiTree(),
      uiVersion: '0.1.0-beta.35',
      coreVersion: VERSION,
    })

    expect(result.errors.join(' ')).not.toMatch(/one version line/)
    expect(result.errors.join(' ')).not.toMatch(/paired Core version/)
  })

  it('requires a Core version rather than assuming the UI one', () => {
    const result = evaluateStatic({
      uiRoot: uiTree(),
      uiVersion: VERSION,
    } as never)

    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/must name the Core version/)
  })

  it('ignores the independent vite-plugin pin', () => {
    const result = evaluateStatic({
      uiRoot: uiTree(),
      uiVersion: VERSION,
      coreVersion: VERSION,
    })
    expect(result.errors.join(' ')).not.toMatch(/vite-plugin/)
  })
})

/*
 * The half that runs at release time. Every failure mode is an error; none of
 * them degrades to a pass.
 */
describe('online pairing', () => {
  it('passes when Core names this release commit', () => {
    const result = evaluatePairing(onlineInput())
    expect(result.errors).toEqual([])
    expect(result.ok).toBe(true)
  })

  it('fails when Core names a different UI commit', () => {
    const result = evaluatePairing(
      onlineInput({
        readCoreFile: () => coreRecord({ uiCommit: 'e'.repeat(40) }),
      }),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/names UI commit/)
  })

  it('fails when the Core tag cannot be resolved', () => {
    const result = evaluatePairing(
      onlineInput({ resolveCoreTag: () => undefined }),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/cannot be resolved/)
  })

  it('fails when the tagged commit has no record', () => {
    const result = evaluatePairing(
      onlineInput({ readCoreFile: () => undefined }),
    )
    expect(result.ok).toBe(false)
    /*
     * Both directories, because Core moved the record to `meta/release/pairing`
     * and the tags created before the move carry the old path permanently.
     */
    expect(result.errors.join(' ')).toMatch(/has no meta\/release\/pairing/)
    expect(result.errors.join(' ')).toMatch(
      /release-pairing\/v0\.2\.0-rc\.0\.json/,
    )
  })

  it('fails when the record is not JSON', () => {
    const result = evaluatePairing(
      onlineInput({ readCoreFile: () => '{not json' }),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/not valid JSON/)
  })

  it('fails when the record has the wrong schema', () => {
    const result = evaluatePairing(
      onlineInput({
        readCoreFile: () =>
          JSON.stringify({ schema: 'other', uiCommit: 'c'.repeat(40) }),
      }),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/schema/)
  })

  it('fails when the record uiCommit is not a full SHA', () => {
    const result = evaluatePairing(
      onlineInput({ readCoreFile: () => coreRecord({ uiCommit: 'f3b7dce3' }) }),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/40-character SHA/)
  })

  it('fails when the release SHA is not a full SHA', () => {
    const result = evaluatePairing(onlineInput({ uiCommit: 'f3b7dce3' }))
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/release SHA/)
  })

  it('fails when the record version line disagrees', () => {
    const result = evaluatePairing(
      onlineInput({
        readCoreFile: () =>
          coreRecord({ uiVersion: '0.2.0', coreVersion: '0.2.0' }),
      }),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/uiVersion/)
  })

  /*
   * Beta skips the cross-repository pairing RECORD, not the Core release
   * identity. The Core must be an immutable tagged release before its packages
   * can be used by this publishing consumer.
   */
  it('requires an immutable Core tag but no pairing record for beta', () => {
    const coreCommit = 'd'.repeat(40)
    const result = evaluatePairing(
      onlineInput({
        uiVersion: '0.2.0-beta.1',
        uiRoot: uiTree('0.2.0-beta.1'),
        coreVersion: '0.2.0-beta.1',
        resolveCoreTag: tag => {
          expect(tag).toBe('v0.2.0-beta.1')
          return coreCommit
        },
        readCoreFile: () => {
          throw new Error(
            'beta does not require a cross-repository pair record',
          )
        },
      }),
    )
    expect(result.errors).toEqual([])
    expect(result.ok).toBe(true)
    expect(result.coreCommit).toBe(coreCommit)
  })

  it('fails closed if the beta Core tag is missing', () => {
    const result = evaluatePairing(
      onlineInput({
        uiVersion: '0.2.0-beta.1',
        uiRoot: uiTree('0.2.0-beta.1'),
        coreVersion: '0.2.0-beta.1',
        resolveCoreTag: () => undefined,
      }),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/Core tag .* cannot be resolved/)
  })

  it('still checks the pins for a beta version', () => {
    const result = evaluatePairing(
      onlineInput({
        uiVersion: '0.2.0-beta.1',
        uiRoot: uiTree('0.2.0-beta.1', { '@zeus-js/router': '0.1.1-beta.20' }),
        resolveCoreTag: () => undefined,
      }),
    )
    expect(result.ok).toBe(false)
  })
})

describe('publishing dispatch Core commit', () => {
  const verified = {
    ok: true,
    channel: 'beta' as const,
    coreTag: 'v0.2.0-rc.5',
    coreCommit: 'd'.repeat(40),
    errors: [] as string[],
  }

  it('reports the verified Core tag without inventing a beta pair record', () => {
    const report = buildPairingReport({
      result: verified,
      mode: 'online',
      version: '0.1.0-beta.35',
      coreVersion: '0.2.0-rc.5',
      uiCommit: 'f'.repeat(40),
    })
    expect(report.coreTag).toBe('v0.2.0-rc.5')
    expect(report.coreTagCommit).toBe('d'.repeat(40))
    expect(report.coreCommit).toBe('d'.repeat(40))
    expect(report.pairTag).toBeNull()
  })

  it('accepts the commit actually resolved from the Core tag', () => {
    expect(compareExpectedCoreCommit(verified, 'd'.repeat(40)).ok).toBe(true)
  })

  it('refuses a valid-looking but mismatched dispatch SHA', () => {
    const result = compareExpectedCoreCommit(verified, 'a'.repeat(40))
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/does not match publish dispatch/)
  })

  it('refuses a malformed commit even when the pairing checker passed', () => {
    const result = compareExpectedCoreCommit(verified, 'abcd')
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/full 40-character SHA/)
  })
})

/*
 * The real thing, in real git repositories.
 *
 * This is the test the old protocol could not have passed. It commits a UI
 * candidate, reads its SHA from git, writes Core's record naming that SHA, and
 * verifies the pair — with no commit ever containing its own SHA.
 */
describe('the protocol is constructible', () => {
  /*
   * Two real git repositories, several commits each. The default 5s is a
   * budget for pure computation; this test shells out to git on every
   * assertion setup and takes 6-8s on a loaded machine, which made it the one
   * flaky test in this file rather than a wrong one.
   */
  it(
    'verifies a pair built from two real repositories',
    { timeout: 30_000 },
    () => {
      const uiRoot = temporary('zeus-ui-real-')
      initRepo(uiRoot)
      fs.mkdirSync(path.join(uiRoot, 'packages/primitives/button'), {
        recursive: true,
      })
      fs.writeFileSync(
        path.join(uiRoot, 'packages/primitives/button/package.json'),
        `${JSON.stringify(
          {
            name: '@zeus-web/button',
            version: VERSION,
            dependencies: { '@zeus-js/runtime-dom': VERSION },
          },
          null,
          2,
        )}\n`,
      )
      git(uiRoot, ['add', '-A'])
      git(uiRoot, ['commit', '-qm', 'ui candidate'])
      const uiCommit = git(uiRoot, ['rev-parse', 'HEAD'])

      /*
       * The UI tree contains no pairing record and no copy of its own SHA. That
       * is the property the old protocol violated.
       */
      const tracked = git(uiRoot, ['ls-files'])
      expect(tracked).not.toContain('release-pairing')
      expect(
        fs.readFileSync(path.join(uiRoot, tracked.split('\n')[0]!), 'utf8'),
      ).not.toContain(uiCommit)

      const coreRoot = temporary('zeus-core-real-')
      initRepo(coreRoot)
      fs.mkdirSync(path.join(coreRoot, 'release-pairing'), { recursive: true })
      const recordPath = `release-pairing/v${VERSION}.json`
      fs.writeFileSync(
        path.join(coreRoot, recordPath),
        coreRecord({ uiCommit, firstPublish: ['@zeus-js/i18n'] }),
      )
      git(coreRoot, ['add', '-A'])
      git(coreRoot, ['commit', '-qm', 'core pairing'])
      const coreCommit = git(coreRoot, ['rev-parse', 'HEAD'])

      const result = evaluatePairing({
        uiRoot,
        uiVersion: VERSION,
        coreVersion: VERSION,
        uiCommit,
        resolveCoreTag: tag => (tag === `v${VERSION}` ? coreCommit : undefined),
        readCoreFile: (commit, file) => {
          if (commit !== coreCommit) return undefined
          const absolute = path.join(coreRoot, file)
          return fs.existsSync(absolute)
            ? fs.readFileSync(absolute, 'utf8')
            : undefined
        },
      })

      expect(result.errors).toEqual([])
      expect(result.ok).toBe(true)
      expect(result.record?.uiCommit).toBe(uiCommit)
    },
  )

  /*
   * And the property that made the old protocol impossible: committing the
   * record changes nothing about the UI commit, so Core can be written after
   * the UI candidate is final.
   */
  it('lets Core be recorded after the UI commit is final', () => {
    const uiRoot = temporary('zeus-ui-order-')
    initRepo(uiRoot)
    fs.mkdirSync(path.join(uiRoot, 'packages/a'), { recursive: true })
    fs.writeFileSync(
      path.join(uiRoot, 'packages/a/package.json'),
      JSON.stringify({
        name: '@zeus-web/a',
        version: VERSION,
        dependencies: { '@zeus-js/zeus': VERSION },
      }),
    )
    git(uiRoot, ['add', '-A'])
    git(uiRoot, ['commit', '-qm', 'ui'])
    const before = git(uiRoot, ['rev-parse', 'HEAD'])

    /*
     * Writing Core's record in a different repository does not touch the UI
     * tree at all, so the SHA read before is still the SHA released.
     */
    const coreRoot = temporary('zeus-core-order-')
    fs.mkdirSync(path.join(coreRoot, 'release-pairing'), { recursive: true })
    fs.writeFileSync(
      path.join(coreRoot, `release-pairing/v${VERSION}.json`),
      coreRecord({ uiCommit: before }),
    )

    const after = git(uiRoot, ['rev-parse', 'HEAD'])
    expect(after).toBe(before)

    const result = evaluatePairing({
      uiRoot,
      uiVersion: VERSION,
      coreVersion: VERSION,
      uiCommit: after,
      resolveCoreTag: () => 'b'.repeat(40),
      readCoreFile: () =>
        fs.readFileSync(
          path.join(coreRoot, `release-pairing/v${VERSION}.json`),
          'utf8',
        ),
    })
    expect(result.ok).toBe(true)
  })

  /*
   * The failure that motivated the remote-reachability check: a well-formed
   * record naming a commit that only ever existed locally.
   */
  it('rejects a record naming a commit this repository does not have', () => {
    const uiRoot = uiTree()
    const result = evaluatePairing({
      uiRoot,
      uiVersion: VERSION,
      coreVersion: VERSION,
      uiCommit: 'f'.repeat(40),
      resolveCoreTag: () => 'b'.repeat(40),
      readCoreFile: () => coreRecord({ uiCommit: 'e'.repeat(40) }),
    })
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/names UI commit/)
  })
})

describe('pin discovery', () => {
  it('finds pins in every dependency field', () => {
    const pins = listCorePins(uiTree())
    const names = pins.map(pin => pin.name)
    expect(names).toContain('@zeus-js/runtime-dom')
    expect(names).toContain('@zeus-js/zeus')
    expect(names).toContain('@zeus-js/vite-plugin')
  })

  /*
   * `pnpm-workspace.yaml` lists `benchmarks/*`, `apps/*` and `examples/*` as
   * well as `packages/*`. Scanning only `packages/` let a real candidate —
   * `ca8cf2c8`, whose `examples/ai-workbench` still pinned
   * `@zeus-js/zeus@0.1.1-beta.20` while the rest of the tree moved to
   * `0.2.0-rc.0` — report `passed (rc, static)`.
   *
   * The stale pin then surfaced as an unresolvable install against the
   * registry, which names a package rather than the file that was stale.
   */
  it('finds pins outside packages/, in every workspace group', () => {
    const root = temporary('zeus-ui-groups-')
    for (const group of ['benchmarks', 'apps', 'examples']) {
      fs.mkdirSync(path.join(root, group, 'sample'), { recursive: true })
      fs.writeFileSync(
        path.join(root, group, 'sample/package.json'),
        `${JSON.stringify(
          {
            name: `@zeus-web/${group}-sample`,
            version: '0.2.0-rc.0',
            dependencies: { '@zeus-js/zeus': '0.1.1-beta.20' },
          },
          null,
          2,
        )}\n`,
      )
    }

    const pins = listCorePins(root)
    /*
     * `path.relative` returns the platform separator, so comparing against a
     * forward-slash literal passes on POSIX and fails on Windows. Normalise
     * before asserting — the production code reports whatever the platform
     * produces, and the test should not encode one of them.
     */
    const files = pins.map(pin => pin.file.replace(/\\/g, '/'))
    for (const group of ['benchmarks', 'apps', 'examples']) {
      expect(files).toContain(`${group}/sample/package.json`)
    }
  })

  it('fails a release whose stale pin is outside packages/', () => {
    const root = uiTree()
    fs.mkdirSync(path.join(root, 'examples/ai-workbench'), { recursive: true })
    fs.writeFileSync(
      path.join(root, 'examples/ai-workbench/package.json'),
      `${JSON.stringify(
        {
          name: '@zeus-web/example-ai-workbench',
          version: VERSION,
          dependencies: { '@zeus-js/zeus': '0.1.1-beta.20' },
        },
        null,
        2,
      )}\n`,
    )
    const result = evaluateStatic({
      uiRoot: root,
      uiVersion: VERSION,
      coreVersion: VERSION,
    })
    expect(result.ok).toBe(false)
    /* Accept either separator: the message carries the platform's path. */
    expect(result.errors.join(' ')).toMatch(/examples[\\/]ai-workbench/)
  })
})

/*
 * The pair for a bootstrap release.
 *
 * A bootstrap tag cannot name a UI commit and cannot move, so reading only the
 * tagged record would make every bootstrap release permanently unpairable.
 * The pair is recorded afterwards under `pair/v<version>`, and these cases are
 * the checks that make that record trustworthy rather than merely present.
 */
describe('bootstrap → pair', () => {
  const CORE_TAG_COMMIT = 'd'.repeat(40)
  const PAIR_COMMIT = 'e'.repeat(40)
  const UI = 'c'.repeat(40)

  function bootstrapRecord(): string {
    return `${JSON.stringify(
      {
        schema: CORE_PAIRING_SCHEMA,
        coreVersion: VERSION,
        uiCommit: null,
        uiVersion: VERSION,
        verifiedAt: '2026-11-17T00:00:00.000Z',
        bootstrap: true,
      },
      null,
      2,
    )}\n`
  }

  function attestation(overrides: Record<string, unknown> = {}): string {
    return `${JSON.stringify(
      {
        schema: 'zeus.pair-attestation/v1',
        releaseTag: `v${VERSION}`,
        coreCommit: CORE_TAG_COMMIT,
        coreVersion: VERSION,
        uiCommit: UI,
        uiVersion: VERSION,
        bootstrap: true,
        verifiedAt: '2026-11-17T00:00:00.000Z',
        ...overrides,
      },
      null,
      2,
    )}\n`
  }

  function bootstrapInput(
    overrides: Partial<OnlinePairingInput> = {},
  ): OnlinePairingInput {
    return {
      uiRoot: uiTree(),
      uiVersion: VERSION,
      coreVersion: VERSION,
      uiCommit: UI,
      resolveCoreTag: () => CORE_TAG_COMMIT,
      resolvePairTag: () => PAIR_COMMIT,
      readCoreFile: (_commit, file) => {
        /*
         * Both record directories, as the reader now tries them. The fixture
         * answers for either so the test is about the attestation, not the
         * path.
         */
        if (
          file.endsWith('meta/release/pairing/v0.2.0-rc.0.json') ||
          file.endsWith('release-pairing/v0.2.0-rc.0.json')
        ) {
          return bootstrapRecord()
        }
        if (file.includes('attestations')) return attestation()
        return undefined
      },
      ...overrides,
    }
  }

  it('passes when the attestation agrees with the release tag and the UI commit', () => {
    const result = evaluatePairing(bootstrapInput())
    expect(result.errors).toEqual([])
    expect(result.ok).toBe(true)
    expect(result.record?.uiCommit).toBe(UI)
  })

  it('fails when no pair attestation exists', () => {
    const result = evaluatePairing(
      bootstrapInput({ resolvePairTag: () => undefined }),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(
      /no pair\/v0\.2\.0-rc\.0 attestation/,
    )
  })

  /*
   * The failure the whole design turns on: an attestation naming a Core commit
   * other than the one the release tag points at. Accepting it would pair the
   * UI with a tree this version never published.
   */
  it('fails when the attestation names a different Core commit', () => {
    const result = evaluatePairing(
      bootstrapInput({
        readCoreFile: (_commit, file) =>
          /*
           * Match the record path exactly. `includes('release-pairing/v')`
           * also matches `meta/release/pairing/v…`, so the attestation path
           * would answer with the record and this test would assert nothing.
           */
          file.endsWith('pairing/v0.2.0-rc.0.json') &&
          file.includes('/pairing/')
            ? bootstrapRecord()
            : attestation({ coreCommit: 'f'.repeat(40) }),
      }),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/names Core commit/)
  })

  it('fails when the attestation names a different UI commit', () => {
    const result = evaluatePairing(
      bootstrapInput({
        readCoreFile: (_commit, file) =>
          file.endsWith('pairing/v0.2.0-rc.0.json') &&
          file.includes('/pairing/')
            ? bootstrapRecord()
            : attestation({ uiCommit: 'f'.repeat(40) }),
      }),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/names UI commit/)
  })

  it('fails when the attestation version differs', () => {
    const result = evaluatePairing(
      bootstrapInput({
        readCoreFile: (_commit, file) =>
          file.endsWith('pairing/v0.2.0-rc.0.json') &&
          file.includes('/pairing/')
            ? bootstrapRecord()
            : attestation({ uiVersion: '0.2.0-rc.1' }),
      }),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/uiVersion/)
  })

  it('fails when the attestation claims a paired release', () => {
    const result = evaluatePairing(
      bootstrapInput({
        readCoreFile: (_commit, file) =>
          file.endsWith('pairing/v0.2.0-rc.0.json') &&
          file.includes('/pairing/')
            ? bootstrapRecord()
            : attestation({ bootstrap: false }),
      }),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/must record bootstrap: true/)
  })

  it('fails when the pair tag has no attestation file', () => {
    const result = evaluatePairing(
      bootstrapInput({
        readCoreFile: (_commit, file) =>
          file.includes('release-pairing/v') ? bootstrapRecord() : undefined,
      }),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(
      /which has no release-pairing\/attestations/,
    )
  })

  it('fails when the attestation is not JSON', () => {
    const result = evaluatePairing(
      bootstrapInput({
        readCoreFile: (_commit, file) =>
          file.includes('release-pairing/v') ? bootstrapRecord() : '{not json',
      }),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/not valid JSON/)
  })

  it('fails when the attestation schema is unknown', () => {
    const result = evaluatePairing(
      bootstrapInput({
        readCoreFile: (_commit, file) =>
          file.endsWith('pairing/v0.2.0-rc.0.json') &&
          file.includes('/pairing/')
            ? bootstrapRecord()
            : attestation({ schema: 'other/v1' }),
      }),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/schema must be/)
  })

  /*
   * A record that is unpaired but does not declare it is ambiguous, and an
   * ambiguous record must not be read as either state.
   */
  it('refuses a null uiCommit that does not declare bootstrap', () => {
    const result = evaluatePairing(
      bootstrapInput({
        readCoreFile: (_commit, file) =>
          file.endsWith('pairing/v0.2.0-rc.0.json') &&
          file.includes('/pairing/')
            ? JSON.stringify({
                schema: CORE_PAIRING_SCHEMA,
                coreVersion: VERSION,
                uiCommit: null,
                uiVersion: VERSION,
                verifiedAt: '2026-11-17T00:00:00.000Z',
              })
            : attestation(),
      }),
    )
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/does not declare bootstrap/)
  })
})
